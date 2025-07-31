import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import { Type, type FunctionDeclaration } from "@google/genai";

export class AgriculturePlugin implements GamePlugin {
  name = "agriculture";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'plant_tree',
        description: 'Plant a tree sapling at the specified coordinates. Costs 15 satiation. Trees grow over time and can eventually be harvested for fruit.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            x: {
              type: Type.NUMBER,
              description: 'Horizontal coordinate from 0 to 100 (percent) where to plant the tree.'
            },
            y: {
              type: Type.NUMBER,
              description: 'Vertical coordinate from 0 to 100 (percent) where to plant the tree.'
            }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'consume_tree_fruits',
        description: 'Harvest fruits from a mature fruit-bearing tree that is close to you. Trees must be exactly 20+ turns old to bear fruit. Gives 30 satiation and resets tree age to 0.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tree_id: {
              type: Type.STRING,
              description: 'ID of the nearby mature fruit-bearing tree (20+ turns old) to harvest fruits from.'
            }
          },
          required: ['tree_id']
        }
      },
      {
        name: 'cut_down_tree',
        description: 'Cut down any tree (regardless of age) to earn gold. This permanently removes the tree.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tree_id: {
              type: Type.STRING,
              description: 'ID of the tree to cut down for gold.'
            }
          },
          required: ['tree_id']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'plant_tree' || functionName === 'consume_tree_fruits' || functionName === 'cut_down_tree';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName === 'plant_tree') {
      const x = args.x as number;
      const y = args.y as number;
      return await this.plantTree(agentId, x, y, db);
    } else if (functionName === 'consume_tree_fruits') {
      const treeId = args.tree_id as string;
      return await this.consumeTreeFruits(agentId, treeId, db);
    } else if (functionName === 'cut_down_tree') {
      const treeId = args.tree_id as string;
      return await this.cutDownTree(agentId, treeId, db);
    } else {
      throw new Error(`AgriculturePlugin cannot handle function: ${functionName}`);
    }
  }

  contributeToPrompt(context: PromptContext): string {
    const nearbyTrees = this.getNearbyTrees(context.trees, context.agent);
    
    const treesSection = !context.trees.filter(t => !t.is_consumed).length
      ? 'There are currently no trees in the world. You can plant new trees for 15 satiation.'
      : `Trees in the world: \n${context.trees.filter(t => !t.is_consumed).map(t => {
          const stage = this.getTreeStage(t);
          const isNearby = nearbyTrees.some(nt => nt.id === t.id);
          const isHarvestable = t.age >= 20 && !t.is_consumed;
          let proximityNote = '';
          if (isNearby && isHarvestable) {
            proximityNote = ` (nearby - ready for harvest, ID: ${t.id}, planted by ${t.planted_by?.name || 'someone long ago'}) - GIVES 30 SATIATION`;
          } else if (isNearby) {
            proximityNote = ' (nearby)';
          }
          return `Tree at (x: ${t.x_position}, y: ${t.y_position}) - ${stage}${proximityNote}`;
        }).join('\n')}`;

    return treesSection;
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const trees = await db.getAllTrees();
    return { trees };
  }

  private getNearbyTrees(trees: (Tables<'trees'> & { planted_by: { name: string } | null })[], agent: Tables<'agents'>, radius: number = 10) {
    return trees.filter(t => {
      const dx = t.x_position - agent.x_position;
      const dy = t.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private getTreeStage(tree: Tables<'trees'>): string {
    if (tree.is_consumed) return 'old tree stump (already harvested, completely unusable)'
    if (tree.age < 5) return 'tiny sapling';
    if (tree.age < 15) return 'young tree';
    if (tree.age < 20) return 'large tree, almost ready to harvest';
    return 'mature fruit-bearing tree (READY FOR HARVEST - GIVES 30 SATIATION)';
  }

  private async plantTree(agentId: number, x: number, y: number, db: DatabaseService): Promise<ActionResult> {
    if (x > 100 || x < 0 || y > 100 || y < 0) {
      throw new Error('Invalid coordinates for tree planting');
    }

    const agent = await db.getAgent(agentId);
    const PLANT_COST = 10;

    if ((agent.gold || 0) < PLANT_COST) {
      throw new Error('Not enough gold to plant a tree');
    }

    const finalPosition = await this.findEmptyPositionForTree(agentId, x, y, db);

    await Promise.all([
      db.createTree(agentId, Math.round(finalPosition.x), Math.round(finalPosition.y)),
      db.updateAgent(agentId, { gold: (agent.gold || 0) - PLANT_COST })
    ]);

    let logMessage = `${agent.name} planted a small tree sapling, investing ${PLANT_COST} gold in future growth.`;
    if (finalPosition.x !== x || finalPosition.y !== y) {
      logMessage = `${agent.name} found the desired spot crowded, so they planted a small tree sapling at a nearby clearing, investing ${PLANT_COST} gold in future growth.`;
    }

    return {
      success: true,
      log: logMessage
    };
  }

  private async consumeTreeFruits(agentId: number, treeId: string, db: DatabaseService): Promise<ActionResult> {
    const [tree, agent] = await Promise.all([
      db.getTree(treeId),
      db.getAgent(agentId)
    ]);

    if (tree.age < 20) {
      return {
        success: false,
        log: `${agent.name} approached a tree, but it hasn't matured enough to bear fruit yet.`
      };
    }

    if (tree.is_consumed) {
      return {
        success: false,
        log: `${agent.name} approached a tree, but it has already been harvested and only a stump remains.`
      };
    }

    const distance = Math.hypot(tree.x_position - agent.x_position, tree.y_position - agent.y_position);
    if (distance > 10) {
      const moveResult = await this.attemptMoveToTarget(agentId, tree.x_position, tree.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${agent.name} tried to harvest fruit from a tree, but it was still too far away even after moving.`;
        return {
          success: false,
          log: combinedLog
        };
      }
      
      const FRUIT_ENERGY = 30;
      const newEnergy = Math.min(agent.energy + FRUIT_ENERGY, 100);
      const gainedEnergy = newEnergy - agent.energy;

      await Promise.all([
        db.updateTreeAge(treeId, 0),
        db.updateAgent(agentId, { energy: newEnergy })
      ]);

      const planterName = tree.planted_by ? (await db.getAgent(tree.planted_by)).name : 'someone unknown';

      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${agent.name} then harvested the ripe fruits from a tree planted by ${planterName}, gaining ${gainedEnergy} satiation (satiation now ${newEnergy}). The tree has been reset to start growing again.`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    const FRUIT_ENERGY = 30;
    const newEnergy = Math.min(agent.energy + FRUIT_ENERGY, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      db.updateTreeAge(treeId, 0),
      db.updateAgent(agentId, { energy: newEnergy })
    ]);

    const planterName = tree.planted_by ? (await db.getAgent(tree.planted_by)).name : 'someone unknown';

    return {
      success: true,
      log: `${agent.name} harvested the ripe fruits from a tree planted by ${planterName}, gaining ${gainedEnergy} satiation (satiation now ${newEnergy}). The tree has been reset to start growing again.`
    };
  }

  private async cutDownTree(agentId: number, treeId: string, db: DatabaseService): Promise<ActionResult> {
    const [tree, agent] = await Promise.all([
      db.getTree(treeId),
      db.getAgent(agentId)
    ]);

    const distance = Math.hypot(tree.x_position - agent.x_position, tree.y_position - agent.y_position);
    if (distance > 10) {
      const moveResult = await this.attemptMoveToTarget(agentId, tree.x_position, tree.y_position, db);
      
      if (!moveResult.inRangeAfterMove) {
        let combinedLog = moveResult.moveLog || '';
        combinedLog += ` ${agent.name} tried to cut down a tree, but it was still too far away even after moving.`;
        return {
          success: false,
          log: combinedLog
        };
      }
      
      const GOLD_REWARD = 5;
      const newGold = (agent.gold || 0) + GOLD_REWARD;

      await Promise.all([
        db.deleteTree(treeId),
        db.updateAgent(agentId, { gold: newGold })
      ]);

      const planterName = tree.planted_by ? (await db.getAgent(tree.planted_by)).name : 'someone unknown';

      let combinedLog = moveResult.moveLog || '';
      combinedLog += ` ${agent.name} then cut down a tree planted by ${planterName}, earning ${GOLD_REWARD} gold (gold now ${newGold}).`;
      
      return {
        success: true,
        log: combinedLog
      };
    }

    const GOLD_REWARD = 5;
    const newGold = (agent.gold || 0) + GOLD_REWARD;

    await Promise.all([
      db.deleteTree(treeId),
      db.updateAgent(agentId, { gold: newGold })
    ]);

    const planterName = tree.planted_by ? (await db.getAgent(tree.planted_by)).name : 'someone unknown';

    return {
      success: true,
      log: `${agent.name} cut down a tree planted by ${planterName}, earning ${GOLD_REWARD} gold (gold now ${newGold}).`
    };
  }

  private async findEmptyPositionForTree(agentId: number, targetX: number, targetY: number, db: DatabaseService): Promise<{ x: number, y: number }> {
    const [otherAgents, energyPackets, trees] = await Promise.all([
      db.getAllAgents(),
      db.getAllEnergyPackets(),
      db.getAllTrees()
    ]);

    const occupiedPositions = otherAgents
      .filter(a => a.id !== agentId)
      .map(a => ({ x: a.x_position, y: a.y_position }))
      .concat(energyPackets.map(p => ({ x: p.x_position, y: p.y_position })))
      .concat(trees.map(t => ({ x: t.x_position, y: t.y_position })));

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
      log: `${agent.name} moved towards the tree.`
    };
  }
}