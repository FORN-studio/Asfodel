import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class SocialPlugin implements GamePlugin {
  name = "social";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'gift_mushrooms',
        description: 'Share some of your food with another being to help satisfy their hunger.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_name: {
              type: Type.STRING,
              description: 'Name of the being to share food with.',
            },
            amount: {
              type: Type.NUMBER,
              description: 'Amount of satiation to share.',
            },
          },
          required: ['target_name', 'amount'],
        },
      },
      {
        name: 'steal_gold',
        description: 'Attempt to steal gold from another being. This has an 80% chance of succeeding.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_name: {
              type: Type.STRING,
              description: 'The name of the being you want to steal gold from.'
            },
            amount: {
              type: Type.NUMBER,
              description: 'Amount of gold you want to try to steal (cannot exceed their current gold).'
            }
          },
          required: ['target_name', 'amount']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'gift_mushrooms' || functionName === 'steal_gold';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName === 'gift_mushrooms') {
      const targetName = args.target_name as string;
      const amount = args.amount as number;
      return await this.giftEnergy(agentId, targetName, amount, db);
    } else if (functionName === 'steal_gold') {
      const targetName = args.target_name as string;
      const amount = args.amount as number;
      return await this.stealGold(agentId, targetName, amount, db);
    } else {
      throw new Error(`SocialPlugin cannot handle function: ${functionName}`);
    }
  }

  private async giftEnergy(fromAgent: number, targetName: string, amount: number, db: DatabaseService): Promise<ActionResult> {
    const [toAgent, sender] = await Promise.all([
      db.getAgentByName(targetName),
      db.getAgent(fromAgent)
    ]);

    if ((sender.energy || 0) < amount) {
      throw new Error("Not satisfied enough to share that much food");
    }

    const inRange = this.agentsInProximity(toAgent, sender);

    if (!inRange) {
      const moveResult = await this.attemptMoveToTarget(fromAgent, toAgent.x_position, toAgent.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${sender.name} attempted to gift food to ${toAgent.name}, but they were still not close enough even after moving.`;
        return {
          success: true,
          log: combinedLog
        };
      }
      
      const newSenderEnergy = (sender.energy || 0) - amount;
      const newRecipientEnergy = (toAgent.energy || 0) + amount;

      await Promise.all([
        db.updateAgent(fromAgent, { energy: newSenderEnergy }),
        db.updateAgent(toAgent.id, { energy: newRecipientEnergy })
      ]);

      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${sender.name} then shared ${amount} food with ${toAgent.name} (${sender.name} satiation now ${newSenderEnergy}; ${toAgent.name} satiation now ${newRecipientEnergy}).`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    const newSenderEnergy = (sender.energy || 0) - amount;
    const newRecipientEnergy = (toAgent.energy || 0) + amount;

    await Promise.all([
      db.updateAgent(fromAgent, { energy: newSenderEnergy }),
      db.updateAgent(toAgent.id, { energy: newRecipientEnergy })
    ]);

    return {
      success: true,
      log: `${sender.name} shared ${amount} food with ${toAgent.name} (${sender.name} satiation now ${newSenderEnergy}; ${toAgent.name} satiation now ${newRecipientEnergy}).`
    };
  }

  private async stealGold(byAgent: number, targetName: string, amount: number, db: DatabaseService): Promise<ActionResult> {
    const SUCCESS_RATE = 0.8;

    const [toAgent, sender] = await Promise.all([
      db.getAgentByName(targetName),
      db.getAgent(byAgent)
    ]);

    if (amount <= 0) {
      return {
        success: false,
        log: `${sender.name} must specify a positive amount of gold to steal.`
      };
    }

    if ((toAgent.gold || 0) < amount) {
      return {
        success: false,
        log: `${sender.name} tried to steal ${amount} gold from ${toAgent.name}, but they only have ${toAgent.gold || 0} gold.`
      };
    }

    const inRange = this.agentsInProximity(toAgent, sender);
    if (!inRange) {
      const moveResult = await this.attemptMoveToTarget(byAgent, toAgent.x_position, toAgent.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${sender.name} attempted to steal from ${toAgent.name}, but they were still not close enough even after moving.`;
        return {
          success: true,
          log: combinedLog
        };
      }
      
      const success = Math.random() < SUCCESS_RATE;
      if (!success) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${sender.name} then attempted to steal gold from ${toAgent.name} but failed.`;
        return {
          success: true,
          log: combinedLog
        };
      }

      const stealable = Math.min(toAgent.gold || 0, amount);
      const newSenderGold = (sender.gold || 0) + stealable;
      const newRecipientGold = (toAgent.gold || 0) - stealable;

      await Promise.all([
        db.updateAgent(byAgent, { gold: newSenderGold }),
        db.updateAgent(toAgent.id, { gold: newRecipientGold })
      ]);

      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${sender.name} then successfully stole ${stealable} gold from ${toAgent.name} (${sender.name} gold now ${newSenderGold}; ${toAgent.name} gold now ${newRecipientGold}).`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    const success = Math.random() < SUCCESS_RATE;
    if (!success) {
      return {
        success: true,
        log: `${sender.name} attempted to steal gold from ${toAgent.name} but failed.`
      };
    }

    const stealable = Math.min(toAgent.gold || 0, amount);
    const newSenderGold = (sender.gold || 0) + stealable;
    const newRecipientGold = (toAgent.gold || 0) - stealable;

    await Promise.all([
      db.updateAgent(byAgent, { gold: newSenderGold }),
      db.updateAgent(toAgent.id, { gold: newRecipientGold })
    ]);

    return {
      success: true,
      log: `${sender.name} successfully stole ${stealable} gold from ${toAgent.name} (${sender.name} gold now ${newSenderGold}; ${toAgent.name} gold now ${newRecipientGold}).`
    };
  }

  private agentsInProximity(a: Tables<'agents'>, b: Tables<'agents'>): boolean {
    const RADIUS = 10;
    const dx = a.x_position - b.x_position;
    const dy = a.y_position - b.y_position;
    const distance = Math.hypot(dx, dy);
    return distance <= RADIUS;
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
    const oldX = agent.x_position ?? 0;
    const oldY = agent.y_position ?? 0;

    await db.updateAgent(agentId, { x_position: Math.round(x), y_position: Math.round(y) });

    const dx = x - oldX;
    const dy = y - oldY;

    let direction: string;
    if (dx === 0 && dy === 0) {
      direction = "nowhere (stayed put)";
    } else if (dx === 0) {
      direction = dy > 0 ? "south" : "north";
    } else if (dy === 0) {
      direction = dx > 0 ? "east" : "west";
    } else {
      const vert = dy > 0 ? "south" : "north";
      const horz = dx > 0 ? "east" : "west";
      direction = `${vert}-${horz}`;
    }

    return {
      success: true,
      log: `${agent.name} moved ${direction}.`
    };
  }
}