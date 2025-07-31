import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class MovementPlugin implements GamePlugin {
  name = "movement";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [{
      name: 'move',
      description: 'Move to the given coordinates.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          x: {
            type: Type.NUMBER,
            description: 'Horizontal coordinate from 0 to 100 (percent).',
          },
          y: {
            type: Type.NUMBER,
            description: 'Vertical coordinate from 0 to 100 (percent).',
          },
        },
        required: ['x', 'y'],
      },
    }];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'move';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName !== 'move') {
      throw new Error(`MovementPlugin cannot handle function: ${functionName}`);
    }

    const x = args.x as number;
    const y = args.y as number;

    return await this.move(agentId, x, y, db);
  }

  private async move(agentId: number, x: number, y: number, db: DatabaseService): Promise<ActionResult> {
    if (x > 100 || x < 0 || y > 100 || y < 0) {
      throw new Error('Invalid coordinates');
    }

    const agent = await db.getAgent(agentId);
    const oldX = agent.x_position ?? 0;
    const oldY = agent.y_position ?? 0;

    const finalPosition = await this.findEmptyPosition(agentId, x, y, db);
    const finalX = finalPosition.x;
    const finalY = finalPosition.y;

    const dx = finalX - oldX;
    const dy = finalY - oldY;

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

    await db.updateAgent(agentId, { x_position: Math.round(finalX), y_position: Math.round(finalY) });

    let logMessage = `${agent.name} set out on a journey towards ${direction}.`;
    if (finalX !== x || finalY !== y) {
      logMessage += ` They found a clear spot nearby to settle in.`;
    }

    return {
      success: true,
      log: logMessage
    };
  }

  private async findEmptyPosition(agentId: number, targetX: number, targetY: number, db: DatabaseService): Promise<{ x: number, y: number }> {
    const [otherAgents, energyPackets] = await Promise.all([
      db.getAllAgents(),
      db.getAllEnergyPackets()
    ]);

    const occupiedPositions = otherAgents
      .filter(a => a.id !== agentId)
      .map(a => ({ x: a.x_position, y: a.y_position }))
      .concat(energyPackets.map(p => ({ x: p.x_position, y: p.y_position })));

    const minDistance = 3;

    const isPositionOccupied = (x: number, y: number): boolean => {
      return occupiedPositions.some(pos => {
        const distance = Math.hypot(x - pos.x, y - pos.y);
        return distance < minDistance;
      });
    };

    if (!isPositionOccupied(targetX, targetY)) {
      return { x: targetX, y: targetY };
    }

    const maxSearchRadius = 15;
    const stepSize = 1;

    for (let radius = stepSize; radius <= maxSearchRadius; radius += stepSize) {
      const pointsToCheck = Math.max(8, Math.floor(2 * Math.PI * radius / stepSize));
      
      for (let i = 0; i < pointsToCheck; i++) {
        const angle = (2 * Math.PI * i) / pointsToCheck;
        const candidateX = Math.max(0, Math.min(100, targetX + radius * Math.cos(angle)));
        const candidateY = Math.max(0, Math.min(100, targetY + radius * Math.sin(angle)));
        
        if (!isPositionOccupied(candidateX, candidateY)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    return { x: targetX, y: targetY };
  }
}