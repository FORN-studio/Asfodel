import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class ReproductionPlugin implements GamePlugin {
  name = "reproduction";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'lay_egg',
        description: 'Lay an egg to create offspring. Costs 40 satiation - a significant investment in creating new life. The egg will need to be nurtured by other agents 5 times before it hatches. It is strongly recommended to have an agreement with another agent before laying an egg to ensure someone will care for it.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            egg_name: {
              type: Type.STRING,
              description: 'The name you want to give to your future offspring when they hatch.'
            }
          },
          required: ['egg_name']
        }
      },
      {
        name: 'nurture_egg',
        description: 'Care for an egg to help it develop and eventually hatch into a new agent. You cannot nurture your own eggs. Once you nurture an egg for the first time, only you can continue nurturing it. After 5 nurtures from you alone, the egg will hatch.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            egg_id: {
              type: Type.NUMBER,
              description: 'ID of the nearby egg you want to nurture and care for.'
            }
          },
          required: ['egg_id']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'lay_egg' || functionName === 'nurture_egg';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName === 'lay_egg') {
      const eggName = args.egg_name as string;
      return await this.layEgg(agentId, eggName, db);
    } else if (functionName === 'nurture_egg') {
      const eggId = args.egg_id as number;
      return await this.nurtureEgg(agentId, eggId, db);
    } else {
      throw new Error(`ReproductionPlugin cannot handle function: ${functionName}`);
    }
  }

  contributeToPrompt(context: PromptContext): string {
    const nearbyEggs = this.getNearbyEggs(context.eggs, context.agent);

    const eggsSection = !context.eggs.length
      ? 'There are currently no eggs in the world. You can lay eggs for 50 satiation to create offspring.'
      : `Eggs in the world: \n${context.eggs.map(e => {
          const stage = e.nurtured_times === 0 ? 'newly laid' 
            : e.nurtured_times >= 5 ? 'ready to hatch' 
            : `nurtured ${e.nurtured_times}/5 times`;
          const layerName = e.laid_by?.name || 'unknown';
          const caretakerName = e.nurtured_by?.name || 'none yet';
          const isNearby = nearbyEggs.some(ne => ne.id === e.id);
          
          let proximityNote = '';
          if (isNearby) {
            if (e.laid_by?.id === context.agent.id) {
              proximityNote = ` (nearby - your own egg, ID: ${e.id}) - you cannot nurture your own offspring`;
            } else if (e.nurtured_times > 0 && e.nurtured_by?.name !== context.agent.name) {
              proximityNote = ` (nearby - ID: ${e.id}) - being cared for exclusively by ${e.nurtured_by?.name}, you cannot nurture this egg`;
            } else {
              const availabilityStatus = e.nurtured_times === 0 ? 'available for nurturing' : `nurtured ${e.nurtured_times}/5 times by you`;
              proximityNote = ` (nearby - ${availabilityStatus}, ID: ${e.id})`;
            }
          }
          
          return `Egg "${e.name}" at (x: ${e.x_position}, y: ${e.y_position}) - ${stage}, laid by ${layerName}, cared for by ${caretakerName}${proximityNote}`;
        }).join('\n')}`;

    return eggsSection;
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const eggs = await db.getUnhatchedEggs();
    return { eggs };
  }

  private getNearbyEggs(eggs: (Tables<'eggs'> & { laid_by: { id: number, name: string, x_position: number, y_position: number } | null, nurtured_by: { name: string } | null })[], agent: Tables<'agents'>, radius: number = 10) {
    return eggs.filter(e => {
      const dx = e.x_position - agent.x_position;
      const dy = e.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private async layEgg(agentId: number, eggName: string, db: DatabaseService): Promise<ActionResult> {
    const agent = await db.getAgent(agentId);
    const EGG_COST = 40;

    if (agent.energy < EGG_COST) {
      return {
        success: false,
        log: `${agent.name} tried to lay an egg but doesn't have enough satiation (needs ${EGG_COST}, has ${agent.energy}).`
      };
    }

    await Promise.all([
      db.createEgg(agentId, eggName, agent.x_position, agent.y_position),
      db.updateAgent(agentId, { energy: agent.energy - EGG_COST })
    ]);

    return {
      success: true,
      log: `${agent.name} laid an egg that will become "${eggName}", investing ${EGG_COST} satiation in creating new life.`
    };
  }

  private async nurtureEgg(agentId: number, eggId: number, db: DatabaseService): Promise<ActionResult> {
    const [egg, agent] = await Promise.all([
      db.getEgg(eggId),
      db.getAgent(agentId)
    ]);

    if (egg.laid_by === agentId) {
      return {
        success: false,
        log: `${agent.name} tried to nurture their own egg, but cannot care for their own offspring.`
      };
    }

    if (egg.hatched) {
      return {
        success: false,
        log: `${agent.name} approached an egg, but it has already hatched.`
      };
    }

    const distance = Math.hypot(egg.x_position - agent.x_position, egg.y_position - agent.y_position);
    if (distance > 10) {
      const moveResult = await this.attemptMoveToTarget(agentId, egg.x_position, egg.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${agent.name} tried to nurture an egg, but it was still too far away even after moving.`;
        return {
          success: false,
          log: combinedLog
        };
      }
      
      if (egg.nurtured_times > 0 && egg.nurtured_by !== agentId) {
        const originalNurturer = await db.getAgent(egg.nurtured_by!);
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${agent.name} then tried to nurture an egg, but ${originalNurturer.name} has already begun caring for it and must continue.`;
        return {
          success: false,
          log: combinedLog
        };
      }

      const newNurturedTimes = egg.nurtured_times + 1;
      
      await db.updateEgg(eggId, { 
        nurtured_times: newNurturedTimes, 
        nurtured_by: agentId 
      });

      if (newNurturedTimes >= 5) {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newAgentId = await db.createAgent(egg.name, randomColor, egg.x_position, egg.y_position);
        
        const parentName = (await db.getAgent(egg.laid_by!)).name;
        const caretakerName = agent.name;
        const initialMemory = `${parentName} is my parent, and ${caretakerName} is my primary caretaker. They worked hard to bring me into this world.`;
        await db.createMemory(newAgentId, initialMemory);
        
        await db.updateEgg(eggId, { hatched: true });

        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${agent.name} then provided the final care needed for the egg. ${egg.name} has hatched and entered the world, remembering both their parent and caretaker.`;
        
        return {
          success: true,
          log: combinedLog
        };
      }

      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${agent.name} then nurtured an egg (${newNurturedTimes}/5 times cared for). The egg grows stronger under their care.`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    if (egg.nurtured_times > 0 && egg.nurtured_by !== agentId) {
      const originalNurturer = await db.getAgent(egg.nurtured_by!);
      return {
        success: false,
        log: `${agent.name} tried to nurture an egg, but ${originalNurturer.name} has already begun caring for it and must continue.`
      };
    }

    const newNurturedTimes = egg.nurtured_times + 1;
    
    await db.updateEgg(eggId, { 
      nurtured_times: newNurturedTimes, 
      nurtured_by: agentId 
    });

    if (newNurturedTimes >= 5) {
      const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newAgentId = await db.createAgent(egg.name, randomColor, egg.x_position, egg.y_position);
      
      const parentName = (await db.getAgent(egg.laid_by!)).name;
      const caretakerName = agent.name;
      const initialMemory = `${parentName} is my parent, and ${caretakerName} is my primary caretaker. They worked hard to bring me into this world.`;
      await db.createMemory(newAgentId, initialMemory);
      
      await db.updateEgg(eggId, { hatched: true });

      return {
        success: true,
        log: `${agent.name} provided the final care needed for the egg. ${egg.name} has hatched and entered the world, remembering both their parent and caretaker.`
      };
    }

    return {
      success: true,
      log: `${agent.name} nurtured an egg (${newNurturedTimes}/5 times cared for). The egg grows stronger under their care.`
    };
  }

  private async attemptMoveToTarget(agentId: number, targetX: number, targetY: number, db: DatabaseService): Promise<{ moved: boolean; moveLog?: string; inRangeAfterMove: boolean }> {
    const agent = await db.getAgent(agentId);
    const RADIUS = 10;
    const APPROACH_DISTANCE = 8;
    
    const currentX = agent.x_position;
    const currentY = agent.y_position;
    
    const currentDistance = Math.hypot(currentX - targetX, currentY - targetY);
    
    if (currentDistance <= RADIUS) {
      return { moved: false, inRangeAfterMove: true };
    }
    
    const direction = Math.atan2(targetY - currentY, targetX - currentX);
    const moveToX = targetX - Math.cos(direction) * APPROACH_DISTANCE;
    const moveToY = targetY - Math.sin(direction) * APPROACH_DISTANCE;
    
    const clampedX = Math.max(0, Math.min(100, moveToX));
    const clampedY = Math.max(0, Math.min(100, moveToY));
    
    const moveResult = await this.moveAgent(agentId, clampedX, clampedY, db);
    
    const newAgent = await db.getAgent(agentId);
    const newDistance = Math.hypot(newAgent.x_position - targetX, newAgent.y_position - targetY);
    const inRangeAfterMove = newDistance <= RADIUS;
    
    return {
      moved: true,
      moveLog: moveResult.log,
      inRangeAfterMove
    };
  }

  private async moveAgent(agentId: number, x: number, y: number, db: DatabaseService): Promise<ActionResult> {
    const agent = await db.getAgent(agentId);
    await db.updateAgent(agentId, { x_position: Math.round(x), y_position: Math.round(y) });
    return {
      success: true,
      log: `${agent.name} moved towards the egg.`
    };
  }
}