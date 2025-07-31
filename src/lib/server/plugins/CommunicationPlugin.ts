import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class CommunicationPlugin implements GamePlugin {
  name = "communication";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [{
      name: 'speak',
      description: 'Say something to another being. If they aren\'t close to you, they won\'t hear you.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          target_name: {
            type: Type.STRING,
            description: 'Name of the being you want to speak to.',
          },
          message: {
            type: Type.STRING,
            description: 'What you want to say to them.',
          },
        },
        required: ['target_name', 'message'],
      },
    }];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'speak';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName !== 'speak') {
      throw new Error(`CommunicationPlugin cannot handle function: ${functionName}`);
    }

    const targetName = args.target_name as string;
    const message = args.message as string;

    return await this.speak(agentId, targetName, message, db);
  }

  contributeToPrompt(context: PromptContext): string {
    const conversationSection = `
      Here is some recent conversation involving you:
      ${context.messages.map((m, i) => this.formatMessage(m, i, context.agent.name)).join('\n')}
    `;

    return conversationSection;
  }

  private formatMessage(msg: any, index: number, agentName: string): string {
    if (!msg.from_agent) {
      return `${index} days ago, someone who's now deceased said: ${msg.content}`;
    } else if (!msg.to_agent) {
      return `${index} days ago: You said to yourself: "${msg.content}"`;
    } else {
      return `${index} days ago: ${msg.from_agent.name} said to you: "${msg.content}"`;
    }
  }

  private async speak(fromAgent: number, targetName: string, message: string, db: DatabaseService): Promise<ActionResult> {
    const [sender, recipient] = await Promise.all([
      db.getAgent(fromAgent),
      db.getAgentByName(targetName)
    ]);

    const inRange = this.agentsInProximity(sender, recipient);

    if (!inRange) {
      const moveResult = await this.attemptMoveToTarget(fromAgent, recipient.x_position, recipient.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${sender.name} attempted to speak to ${recipient.name}, but they were still not close enough even after moving.`;
        return {
          success: true,
          log: combinedLog
        };
      }
      
      await db.createMessage(fromAgent, recipient.id, message);
      
      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${sender.name} then spoke to ${recipient.name} and said: "${message}".`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    await db.createMessage(fromAgent, recipient.id, message);

    return {
      success: true,
      log: `${sender.name} spoke to ${recipient.name} and said: "${message}".`
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