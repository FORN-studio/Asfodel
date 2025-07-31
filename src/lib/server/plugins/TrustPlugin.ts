import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import { Type, type FunctionDeclaration } from "@google/genai";

export class TrustPlugin implements GamePlugin {
  name = "trust";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [{
      name: 'update_other_being_trustworthiness',
      description: 'Update how much you trust another being. This is your personal assessment of their reliability, honesty, and trustworthiness. Use this to track your relationships and inform future decisions about cooperation, alliances, or caution.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          target_name: {
            type: Type.STRING,
            description: 'The name of the other being whose trustworthiness you want to assess.'
          },
          trustworthiness: {
            type: Type.NUMBER,
            description: 'Your trust level for this being from 0 to 100. 0 = completely untrustworthy, 50 = neutral/unknown, 100 = absolute trust.'
          }
        },
        required: ['target_name', 'trustworthiness']
      }
    }];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'update_other_being_trustworthiness';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName !== 'update_other_being_trustworthiness') {
      throw new Error(`TrustPlugin cannot handle function: ${functionName}`);
    }

    const targetName = args.target_name as string;
    const trustworthiness = args.trustworthiness as number;

    return await this.updateOtherBeingTrustworthiness(agentId, targetName, trustworthiness, db);
  }

  contributeToPrompt(context: PromptContext): string {
    const trustSection = !context.trustRelationships.length
      ? 'You have not yet assessed the trustworthiness of any other beings.'
      : `Your trust assessments of other beings: \n${context.trustRelationships.map(tr => `${tr.other_agent_name}: ${tr.trustworthiness}/100 trust`).join('\n')}`;

    return trustSection;
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const trustRelationships = await db.getAgentTrustRelationships(agentId);
    return { trustRelationships };
  }

  private async updateOtherBeingTrustworthiness(agentId: number, targetName: string, trustworthiness: number, db: DatabaseService): Promise<ActionResult> {
    if (trustworthiness < 0 || trustworthiness > 100) {
      return {
        success: false,
        log: `${(await db.getAgent(agentId)).name} tried to set trustworthiness to an invalid value. Trustworthiness must be between 0 and 100.`
      };
    }

    const [agent, targetAgent] = await Promise.all([
      db.getAgent(agentId),
      db.getAgentByName(targetName)
    ]);

    if (!targetAgent) {
      return {
        success: false,
        log: `${agent.name} tried to update trustworthiness for "${targetName}", but no such being exists.`
      };
    }

    if (targetAgent.id === agentId) {
      return {
        success: false,
        log: `${agent.name} tried to set their own trustworthiness, but beings cannot rate themselves.`
      };
    }

    await db.upsertAgentTrust(agentId, targetAgent.id, trustworthiness);

    return {
      success: true,
      log: `${agent.name} updated their assessment of how much they trust ${targetAgent.name} (${trustworthiness}/100).`
    };
  }
}