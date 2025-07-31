import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class CombatPlugin implements GamePlugin {
  name = "combat";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [{
      name: 'attack_other_being',
      description: 'Attack another being to deal significant damage to them. Costs 5 satiation and deals 40 damage. An extreme measure for extreme times.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          target_name: {
            type: Type.STRING,
            description: 'The name of the being you want to attack.'
          }
        },
        required: ['target_name']
      }
    }];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'attack_other_being';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName !== 'attack_other_being') {
      throw new Error(`CombatPlugin cannot handle function: ${functionName}`);
    }

    const targetName = args.target_name as string;
    return await this.attackOtherBeing(agentId, targetName, db);
  }

  private async attackOtherBeing(byAgent: number, targetName: string, db: DatabaseService): Promise<ActionResult> {
    const ATTACK_COST = 5;
    const ATTACK_DAMAGE = 40;

    const [toAgent, sender] = await Promise.all([
      db.getAgentByName(targetName),
      db.getAgent(byAgent)
    ]);

    if ((sender.energy || 0) < ATTACK_COST) {
      throw new Error("Not enough energy to attack");
    }

    if (toAgent.id === byAgent) {
      throw new Error("Cannot attack yourself");
    }

    const inRange = this.agentsInProximity(toAgent, sender);
    if (!inRange) {
      const moveResult = await this.attemptMoveToTarget(byAgent, toAgent.x_position, toAgent.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${sender.name} attempted to attack ${toAgent.name}, but they were still not close enough even after moving.`;
        return {
          success: true,
          log: combinedLog
        };
      }
      
      const attackResult = await this.performAttack(byAgent, toAgent.id, sender.name, toAgent.name, ATTACK_COST, ATTACK_DAMAGE, sender.energy || 0, toAgent.energy || 0, db);
      
      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${sender.name} then ${attackResult.logMessage.substring(sender.name.length + 1)}`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    const attackResult = await this.performAttack(byAgent, toAgent.id, sender.name, toAgent.name, ATTACK_COST, ATTACK_DAMAGE, sender.energy || 0, toAgent.energy || 0, db);

    return {
      success: true,
      log: attackResult.logMessage
    };
  }

  private async performAttack(senderId: number, targetId: number, senderName: string, targetName: string, attackCost: number, attackDamage: number, senderEnergy: number, targetEnergy: number, db: DatabaseService): Promise<{ newSenderEnergy: number; newTargetEnergy: number; logMessage: string }> {
    const newSenderEnergy = senderEnergy - attackCost;
    const newTargetEnergy = Math.max(0, targetEnergy - attackDamage);

    await Promise.all([
      db.updateAgent(senderId, { energy: newSenderEnergy }),
      db.updateAgent(targetId, { energy: newTargetEnergy })
    ]);

    return {
      newSenderEnergy,
      newTargetEnergy,
      logMessage: `${senderName} attacked ${targetName}, dealing ${attackDamage} damage (${senderName} satiation now ${newSenderEnergy}; ${targetName} satiation now ${newTargetEnergy}).`
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