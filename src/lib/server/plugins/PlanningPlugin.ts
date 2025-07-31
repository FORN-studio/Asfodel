import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import { Type, type FunctionDeclaration } from "@google/genai";

export class PlanningPlugin implements GamePlugin {
  name = "planning";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'add_plan',
        description: 'Add a new plan to your personal to-do list for future goals or multi-step objectives.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            plan: {
              type: Type.STRING,
              description: 'Description of the plan or goal you want to remember and work towards.'
            }
          },
          required: ['plan']
        }
      },
      {
        name: 'remove_plan',
        description: 'Remove a completed plan from your to-do list.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            plan_id: {
              type: Type.NUMBER,
              description: 'ID of the plan you want to remove (shown in your plans list).'
            }
          },
          required: ['plan_id']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'add_plan' || functionName === 'remove_plan';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName === 'add_plan') {
      const plan = args.plan as string;
      return await this.addPlan(agentId, plan, db);
    } else if (functionName === 'remove_plan') {
      const planId = args.plan_id as number;
      return await this.removePlan(agentId, planId, db);
    } else {
      throw new Error(`PlanningPlugin cannot handle function: ${functionName}`);
    }
  }

  contributeToPrompt(context: PromptContext): string {
    const plansSection = !context.plans.length
      ? 'You currently have no plans.'
      : `You currently have ${context.plans.length} plans: \n${context.plans.map(p => `Plan ${p.id}: "${p.plan}"`).join('\n')}`;

    return plansSection;
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const plans = await db.getPlans(agentId);
    return { plans };
  }

  private async addPlan(agentId: number, plan: string, db: DatabaseService): Promise<ActionResult> {
    const agent = await db.createPlan(agentId, plan);
    return {
      success: true,
      log: `${agent.name} added a new plan: "${plan}"`
    };
  }

  private async removePlan(agentId: number, planId: number, db: DatabaseService): Promise<ActionResult> {
    try {
      await db.deletePlan(planId);
      const agent = await db.getAgent(agentId);
      return {
        success: true,
        log: `${agent.name} removed a plan.`
      };
    } catch (error) {
      const agent = await db.getAgent(agentId);
      return {
        success: false,
        log: `${agent.name} tried to remove a plan, but it was not found.`
      };
    }
  }
}