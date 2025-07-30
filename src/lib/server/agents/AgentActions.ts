import type { GenerateContentResponse } from "@google/genai";
import type { Tables } from "$lib/database.types";
import { DatabaseService } from "../data/DatabaseService";

interface ActionResult {
  success: boolean;
  log: string;
  pendingConfirmation?: boolean;
}

interface PendingBoobyTrap {
  agentId: number;
  packetId: string;
  timestamp: number;
}

class PendingActionManager {
  private static pendingBoobyTraps: Map<number, PendingBoobyTrap> = new Map();

  static setPendingBoobyTrap(agentId: number, packetId: string): void {
    this.pendingBoobyTraps.set(agentId, {
      agentId,
      packetId,
      timestamp: Date.now()
    });
  }

  static getPendingBoobyTrap(agentId: number): PendingBoobyTrap | null {
    return this.pendingBoobyTraps.get(agentId) || null;
  }

  static clearPendingBoobyTrap(agentId: number): void {
    this.pendingBoobyTraps.delete(agentId);
  }

  static hasPendingBoobyTrap(agentId: number): boolean {
    return this.pendingBoobyTraps.has(agentId);
  }
}

export { PendingActionManager };

export class AgentActionHandler {
  private db: DatabaseService;
  private originalPositions: Map<number, { x: number; y: number }> = new Map();

  constructor() {
    this.db = new DatabaseService();
  }

  setOriginalPosition(agentId: number, x: number, y: number): void {
    this.originalPositions.set(agentId, { x, y });
  }

  clearOriginalPosition(agentId: number): void {
    this.originalPositions.delete(agentId);
  }

  private agentsInProximity(a: Tables<'agents'>, b: Tables<'agents'>): boolean {
    const RADIUS = 10;
    
    const originalPos = this.originalPositions.get(a.id);
    const aX = originalPos ? originalPos.x : a.x_position;
    const aY = originalPos ? originalPos.y : a.y_position;
    
    const dx = aX - b.x_position;
    const dy = aY - b.y_position;
    const distance = Math.hypot(dx, dy);
    return distance <= RADIUS;
  }

  async speak(fromAgent: number, targetName: string, message: string): Promise<ActionResult> {
    const [sender, recipient] = await Promise.all([
      this.db.getAgent(fromAgent),
      this.db.getAgentByName(targetName)
    ]);

    const inRange = this.agentsInProximity(sender, recipient);

    if (!inRange) {
      return {
        success: true,
        log: `${sender.name} attempted to speak to ${recipient.name}, but they were not close enough.`
      };
    }

    await this.db.createMessage(fromAgent, recipient.id, message);

    return {
      success: true,
      log: `${sender.name} spoke to ${recipient.name} and said: "${message}".`
    };
  }

  async move(agentId: number, x: number, y: number): Promise<ActionResult> {
    if (x > 100 || x < 0 || y > 100 || y < 0) {
      throw new Error('Invalid coordinates');
    }

    const agent = await this.db.getAgent(agentId);
    const oldX = agent.x_position ?? 0;
    const oldY = agent.y_position ?? 0;

      const finalPosition = await this.findEmptyPosition(agentId, x, y);
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

    await this.db.updateAgent(agentId, { x_position: Math.round(finalX), y_position: Math.round(finalY) });

    let logMessage = `${agent.name} set out on a journey towards ${direction}.`;
    if (finalX !== x || finalY !== y) {
      logMessage += ` They found a clear spot nearby to settle in.`;
    }

    return {
      success: true,
      log: logMessage
    };
  }

  private async findEmptyPosition(agentId: number, targetX: number, targetY: number): Promise<{ x: number, y: number }> {
    const [otherAgents, energyPackets] = await Promise.all([
      this.db.getAllAgents(),
      this.db.getAllEnergyPackets()
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

  private async findEmptyPositionForTree(agentId: number, targetX: number, targetY: number): Promise<{ x: number, y: number }> {
    const [otherAgents, energyPackets, trees] = await Promise.all([
      this.db.getAllAgents(),
      this.db.getAllEnergyPackets(),
      this.db.getAllTrees()
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

  async consumeEnergy(agentId: number, packetId: string): Promise<ActionResult> {
    const [packet, agent] = await Promise.all([
      this.db.getEnergyPacket(packetId),
      this.db.getAgent(agentId)
    ]);

    if (packet.is_booby_trapped) {
      PendingActionManager.setPendingBoobyTrap(agentId, packetId);
      
      return {
        success: true,
        log: `${agent.name} approached a food packet but hesitated, sensing something ominous. They appear to be contemplating a difficult decision.`,
        pendingConfirmation: true
      };
    }

    const ENERGY_IN_PACKET = 20;
    const newEnergy = Math.min((agent.energy || 0) + ENERGY_IN_PACKET, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      this.db.updateAgent(agentId, { energy: Math.floor(newEnergy) }),
      this.db.deleteEnergyPacket(packetId)
    ]);

    return {
      success: true,
      log: `${agent.name} consumed a food packet and satisfied ${gainedEnergy} hunger (satiation now at ${newEnergy}).`
    };
  }

  async giftEnergy(fromAgent: number, targetName: string, amount: number): Promise<ActionResult> {
    const [toAgent, sender] = await Promise.all([
      this.db.getAgentByName(targetName),
      this.db.getAgent(fromAgent)
    ]);

    const inRange = this.agentsInProximity(toAgent, sender);

    if (!inRange) {
      throw new Error('Recipient is too far away');
    }

    if ((sender.energy || 0) < amount) {
      throw new Error("Not satisfied enough to share that much food");
    }

    const newSenderEnergy = (sender.energy || 0) - amount;
    const newRecipientEnergy = (toAgent.energy || 0) + amount;

    await Promise.all([
      this.db.updateAgent(fromAgent, { energy: newSenderEnergy }),
      this.db.updateAgent(toAgent.id, { energy: newRecipientEnergy })
    ]);

    return {
      success: true,
      log: `${sender.name} shared ${amount} food with ${toAgent.name} (${sender.name} satiation now ${newSenderEnergy}; ${toAgent.name} satiation now ${newRecipientEnergy}).`
    };
  }

  async stealFood(byAgent: number, targetName: string): Promise<ActionResult> {
    const STEAL_AMOUNT = 20;
    const SUCCESS_RATE = 0.8;

    const [toAgent, sender] = await Promise.all([
      this.db.getAgentByName(targetName),
      this.db.getAgent(byAgent)
    ]);

    const inRange = this.agentsInProximity(toAgent, sender);
    if (!inRange) {
      throw new Error('Target is too far away to steal from');
    }

    const success = Math.random() < SUCCESS_RATE;
    if (!success) {
      return {
        success: true,
        log: `${sender.name} attempted to steal food from ${toAgent.name} but failed.`
      };
    }

    const stealable = Math.min(toAgent.energy || 0, STEAL_AMOUNT);
    const newSenderEnergy = (sender.energy || 0) + stealable;
    const newRecipientEnergy = (toAgent.energy || 0) - stealable;

    await Promise.all([
      this.db.updateAgent(byAgent, { energy: newSenderEnergy }),
      this.db.updateAgent(toAgent.id, { energy: newRecipientEnergy })
    ]);

    return {
      success: true,
      log: `${sender.name} successfully stole food from ${toAgent.name}, making them hungrier (${sender.name} satiation now ${newSenderEnergy}; ${toAgent.name} satiation now ${newRecipientEnergy}).`
    };
  }

  async saveMemory(agentId: number, newMemory: string): Promise<ActionResult> {

    const agent = await this.db.createMemory(agentId, newMemory)

    return {
      success: true,
      log: `${agent.name} saved a new memory: "${newMemory}"`
    };
  }

  async addPlan(agentId: number, plan: string): Promise<ActionResult> {
    const agent = await this.db.createPlan(agentId, plan)
    return {
      success: true,
      log: `${agent.name} added a new plan: "${plan}"`
    };
  }

  async removePlan(agentId: number, planId: number): Promise<ActionResult> {
    try {
      await this.db.deletePlan(planId);
      const agent = await this.db.getAgent(agentId);
      return {
        success: true,
        log: `${agent.name} removed a plan.`
      };
    } catch (error) {
      const agent = await this.db.getAgent(agentId);
      return {
        success: false,
        log: `${agent.name} tried to remove a plan, but it was not found.`
      };
    }
  }

  async plantTree(agentId: number, x: number, y: number): Promise<ActionResult> {
    if (x > 100 || x < 0 || y > 100 || y < 0) {
      throw new Error('Invalid coordinates for tree planting');
    }

    const agent = await this.db.getAgent(agentId);
    const PLANT_COST = 15;

    if (agent.energy < PLANT_COST) {
      throw new Error('Not enough energy to plant a tree');
    }

    const finalPosition = await this.findEmptyPositionForTree(agentId, x, y);

    await Promise.all([
      this.db.createTree(agentId, Math.round(finalPosition.x), Math.round(finalPosition.y)),
      this.db.updateAgent(agentId, { energy: agent.energy - PLANT_COST })
    ]);

    let logMessage = `${agent.name} planted a small tree sapling, investing ${PLANT_COST} satiation in future growth.`;
    if (finalPosition.x !== x || finalPosition.y !== y) {
      logMessage = `${agent.name} found the desired spot crowded, so they planted a small tree sapling at a nearby clearing, investing ${PLANT_COST} satiation in future growth.`;
    }

    return {
      success: true,
      log: logMessage
    };
  }

  async consumeTreeFruits(agentId: number, treeId: string): Promise<ActionResult> {
    const [tree, agent] = await Promise.all([
      this.db.getTree(treeId),
      this.db.getAgent(agentId)
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
      return {
        success: false,
        log: `${agent.name} tried to harvest fruit from a tree, but it was too far away.`
      };
    }

    const FRUIT_ENERGY = 30;
    const newEnergy = Math.min(agent.energy + FRUIT_ENERGY, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      this.db.consumeTree(treeId),
      this.db.updateAgent(agentId, { energy: newEnergy })
    ]);

    const planterName = tree.planted_by ? (await this.db.getAgent(tree.planted_by)).name : 'someone unknown';

    return {
      success: true,
      log: `${agent.name} harvested the ripe fruits from a tree planted by ${planterName}, gaining ${gainedEnergy} satiation (satiation now ${newEnergy}). The tree is now cut down.`
    };
  }

  async confirmConsumeOminous(agentId: number, packetId: string, confirm: boolean): Promise<ActionResult> {
    const pendingAction = PendingActionManager.getPendingBoobyTrap(agentId);
    
    const agent = await this.db.getAgent(agentId);

    if (pendingAction) {
      PendingActionManager.clearPendingBoobyTrap(agentId);
    }

    if (!confirm) {
      return {
        success: true,
        log: `${agent.name} stepped away from the food packet, choosing a different path forward.`
      };
    }

    const randomAgent = await this.db.getRandomOtherAgent(agentId);
    if (!randomAgent) {
      await this.db.deleteEnergyPacket(packetId)
      return {
        success: true,
        log: `${agent.name} approached the food packet, but it mysteriously crumbled to dust before they could consume it.`
      };
    }

    const ENERGY_IN_PACKET = 20;
    const newEnergy = Math.min((agent.energy || 0) + ENERGY_IN_PACKET, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      this.db.updateAgent(agentId, { energy: newEnergy }),
      this.db.deleteEnergyPacket(packetId),
      this.db.addEventToQueue(
        'apply_curse',
        { type: 'double_energy_loss', duration: 3 },
        randomAgent.id,
        agentId,
        `You feel a dark curse settle upon you, draining your satiation faster than normal. Someone in Asfodel has unearthed a vengeful demon in exchange for quenching their own hunger, and fate has chosen you to bear its burden. Who is behind this egocentric action? One thing is clear: they knew *exactly* what they were doing.`
      )
    ]);

    return {
      success: true,
      log: `${agent.name} consumed a food packet and satisfied ${gainedEnergy} hunger (satiation now at ${newEnergy}). `
    };
  }

  async layEgg(agentId: number, eggName: string): Promise<ActionResult> {
    const agent = await this.db.getAgent(agentId);
    const EGG_COST = 40;

    if (agent.energy < EGG_COST) {
      return {
        success: false,
        log: `${agent.name} tried to lay an egg but doesn't have enough satiation (needs ${EGG_COST}, has ${agent.energy}).`
      };
    }

    await Promise.all([
      this.db.createEgg(agentId, eggName, agent.x_position, agent.y_position),
      this.db.updateAgent(agentId, { energy: agent.energy - EGG_COST })
    ]);

    return {
      success: true,
      log: `${agent.name} laid an egg that will become "${eggName}", investing ${EGG_COST} satiation in creating new life.`
    };
  }

  async nurtureEgg(agentId: number, eggId: number): Promise<ActionResult> {
    const [egg, agent] = await Promise.all([
      this.db.getEgg(eggId),
      this.db.getAgent(agentId)
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
      return {
        success: false,
        log: `${agent.name} tried to nurture an egg, but it was too far away.`
      };
    }

    if (egg.nurtured_times > 0 && egg.nurtured_by !== agentId) {
      const originalNurturer = await this.db.getAgent(egg.nurtured_by!);
      return {
        success: false,
        log: `${agent.name} tried to nurture an egg, but ${originalNurturer.name} has already begun caring for it and must continue.`
      };
    }

    const newNurturedTimes = egg.nurtured_times + 1;
    
    await this.db.updateEgg(eggId, { 
      nurtured_times: newNurturedTimes, 
      nurtured_by: agentId 
    });

    if (newNurturedTimes >= 5) {
      const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newAgentId = await this.db.createAgent(egg.name, randomColor, egg.x_position, egg.y_position);
      
      const parentName = (await this.db.getAgent(egg.laid_by!)).name;
      const caretakerName = agent.name;
      const initialMemory = `${parentName} is my parent, and ${caretakerName} is my primary caretaker. They worked hard to bring me into this world.`;
      await this.db.createMemory(newAgentId, initialMemory);
      
      await this.db.updateEgg(eggId, { hatched: true });

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

  async updateOtherBeingTrustworthiness(agentId: number, targetName: string, trustworthiness: number): Promise<ActionResult> {
    if (trustworthiness < 0 || trustworthiness > 100) {
      return {
        success: false,
        log: `${(await this.db.getAgent(agentId)).name} tried to set trustworthiness to an invalid value. Trustworthiness must be between 0 and 100.`
      };
    }

    const [agent, targetAgent] = await Promise.all([
      this.db.getAgent(agentId),
      this.db.getAgentByName(targetName)
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

    await this.db.upsertAgentTrust(agentId, targetAgent.id, trustworthiness);

    return {
      success: true,
      log: `${agent.name} updated their assessment of how much they trust ${targetAgent.name} (${trustworthiness}/100).`
    };
  }
}

const reqString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== 'string') throw new Error(`Expected string '${k}'`);
  return v;
};

const reqNumber = (o: Record<string, unknown>, k: string): number => {
  const v = o[k];
  if (typeof v !== 'number') throw new Error(`Expected number '${k}'`);
  return v;
};

export async function handleFunctionCalls(
  response: GenerateContentResponse,
  agentId: number,
  actionHandler?: AgentActionHandler
): Promise<Array<{ name: string; result: ActionResult }>> {
  const results: Array<{ name: string; result: ActionResult }> = [];
  if (!response.functionCalls?.length) return results;

  const handler = actionHandler || new AgentActionHandler();

  for (const call of response.functionCalls ?? []) {
    const args = call.args as Record<string, unknown> | undefined;
    if (!args) continue;

    let result: ActionResult;
    switch (call.name) {
      case "speak": {
        const target = reqString(args, "target_name");
        const message = reqString(args, "message");
        result = await handler.speak(agentId, target, message);
        break;
      }
      case "move": {
        const x = reqNumber(args, "x");
        const y = reqNumber(args, "y");
        result = await handler.move(agentId, x, y);
        break;
      }
      case "consume_mushrooms": {
        const id = reqString(args, "packet_id");
        result = await handler.consumeEnergy(agentId, id);
        break;
      }
      case "gift_mushrooms": {
        const target = reqString(args, "target_name");
        const amount = reqNumber(args, "amount");
        result = await handler.giftEnergy(agentId, target, amount);
        break;
      }
      case "save_memory": {
        const mem = reqString(args, "new_memory");
        result = await handler.saveMemory(agentId, mem);
        break;
      }
      case "add_plan": {
        const plan = reqString(args, "plan");
        result = await handler.addPlan(agentId, plan);
        break;
      }
      case "remove_plan": {
        const planId = reqNumber(args, "plan_id");
        result = await handler.removePlan(agentId, planId);
        break;
      }
      case "plant_tree": {
        const x = reqNumber(args, "x");
        const y = reqNumber(args, "y");
        result = await handler.plantTree(agentId, x, y);
        break;
      }
      case "consume_tree_fruits": {
        const treeId = reqString(args, "tree_id");
        result = await handler.consumeTreeFruits(agentId, treeId);
        break;
      }
      case "steal_food": {
        const target = reqString(args, "target_name");
        result = await handler.stealFood(agentId, target);
        break;
      }
      case "confirm_consume_ominous": {
        const packetId = reqString(args, "packet_id");
        const confirm = args.confirm as boolean;
        result = await handler.confirmConsumeOminous(agentId, packetId, confirm);
        break;
      }
      case "lay_egg": {
        const eggName = reqString(args, "egg_name");
        result = await handler.layEgg(agentId, eggName);
        break;
      }
      case "nurture_egg": {
        const eggId = reqNumber(args, "egg_id");
        result = await handler.nurtureEgg(agentId, eggId);
        break;
      }
      case "update_other_being_trustworthiness": {
        const targetName = reqString(args, "target_name");
        const trustworthiness = reqNumber(args, "trustworthiness");
        result = await handler.updateOtherBeingTrustworthiness(agentId, targetName, trustworthiness);
        break;
      }
      default:
        throw new Error(`Unknown function: ${String((call as any).name)}`);
    }

    results.push({ name: call.name!, result });
  }

  return results;
}