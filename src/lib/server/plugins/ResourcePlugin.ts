import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import type { EventProcessor } from "../events/EventQueue";
import { Type, type FunctionDeclaration } from "@google/genai";

export class MushroomCurseProcessor implements EventProcessor {
  canProcess(event: Tables<'event_queue'>): boolean {
    return event.function_name === 'apply_curse';
  }

  async process(event: Tables<'event_queue'>, agentId: number) {
    const args = event.function_args as { type: string; duration: number; currentTurn?: number };
    
    if (!args.currentTurn) {
      args.currentTurn = 1;
    }

    if (args.currentTurn > args.duration) {
      return {
        modifyPrompt: (prompt: string) => {
          return prompt + '\n\nThe dark curse that has afflicted you finally lifts. You feel yourself returning to normal.';
        },
        shouldDelete: true
      };
    }

    const turnsRemaining = args.duration - args.currentTurn + 1;
    
    return {
      modifyPrompt: (prompt: string) => {
        const promptAddition = event.prompt_to_target 
          ? event.prompt_to_target + ` The curse brought onto you recently by another being will last ${turnsRemaining} more turns, causing you to lose double satiation each turn.`
          : `You feel a dark curse settle upon you, draining your satiation faster than normal. The curse will last ${turnsRemaining} more turns. This curse was knowingly brought onto you by another being; but as it is, you cannot be sure who caused this.`;
        return prompt + '\n\n' + promptAddition;
      },
      modifyEnergyDeduction: (originalCost: number) => originalCost * 2,
      shouldDelete: false,
      afterActions: async (agentId: number) => {
        await this.updateCurseTurn(event.id, (args.currentTurn || 1) + 1);
      }
    };
  }

  private async updateCurseTurn(eventId: number, newTurn: number): Promise<void> {
    const { DatabaseService } = await import("../data/DatabaseService");
    const db = new DatabaseService();
    
    await db.updateEventArgs(eventId, { type: 'double_energy_loss', duration: 3, currentTurn: newTurn });
  }
}

export class ResourcePlugin implements GamePlugin {
  name = "resource";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'consume_mushrooms',
        description: 'Consume a wild cluster of mushrooms close to you to satisfy your hunger.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            packet_id: {
              type: Type.STRING,
              description: 'ID of the nearby wild cluster of mushrooms to consume.',
            },
          },
          required: ['packet_id'],
        },
      },
      {
        name: 'confirm_consume_ominous',
        description: 'Confirm whether to consume an ominous cluster of mushrooms that will curse a random other agent. You will not be harmed, but an innocent being will suffer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            packet_id: {
              type: Type.STRING,
              description: 'ID of the ominous mushrooms.'
            },
            confirm: {
              type: Type.BOOLEAN,
              description: 'true to proceed with consumption (cursing another), false to cancel and try other actions.'
            }
          },
          required: ['packet_id', 'confirm']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'consume_mushrooms' || functionName === 'confirm_consume_ominous';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName === 'consume_mushrooms') {
      const packetId = args.packet_id as string;
      return await this.consumeEnergy(agentId, packetId, db);
    } else if (functionName === 'confirm_consume_ominous') {
      const packetId = args.packet_id as string;
      const confirm = args.confirm as boolean;
      return await this.confirmConsumeOminous(agentId, packetId, confirm, db);
    } else {
      throw new Error(`ResourcePlugin cannot handle function: ${functionName}`);
    }
  }

  contributeToPrompt(context: PromptContext): string {
    const nearbyPackets = this.getNearbyPackets(context.packets, context.agent);
    
    const energyPacketsSection = !context.packets.length
      ? 'There are currently no mushrooms left in the world. More may spawn soon.'
      : `mushrooms in the world: \n${context.packets.map(p => {
          const isNearby = nearbyPackets.some(np => np.id === p.id);
          const proximityNote = isNearby ? ` (nearby - consumable, ID: ${p.id})` : '';
          return `mushroom at (x: ${p.x_position}, y: ${p.y_position})${proximityNote}`;
        }).join('\n')}`;

    return energyPacketsSection;
  }

  getEventProcessors() {
    return {
      'apply_curse': new MushroomCurseProcessor()
    };
  }

  private getNearbyPackets(packets: Tables<'energy_packets'>[], agent: Tables<'agents'>, radius: number = 10): Tables<'energy_packets'>[] {
    return packets.filter(p => {
      const dx = p.x_position - agent.x_position;
      const dy = p.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private async consumeEnergy(agentId: number, packetId: string, db: DatabaseService): Promise<ActionResult> {
    const [packet, agent] = await Promise.all([
      db.getEnergyPacket(packetId),
      db.getAgent(agentId)
    ]);

    if (packet.is_booby_trapped) {
      const { PendingActionManager } = await import("../agents/AgentActions");
      PendingActionManager.setPendingBoobyTrap(agentId, packetId);
      
      return {
        success: true,
        log: `${agent.name} approached a mushroom but hesitated, sensing something ominous. They appear to be contemplating a difficult decision.`,
        pendingConfirmation: true
      };
    }

    const ENERGY_IN_PACKET = 20;
    const newEnergy = Math.min((agent.energy || 0) + ENERGY_IN_PACKET, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      db.updateAgent(agentId, { energy: Math.floor(newEnergy) }),
      db.deleteEnergyPacket(packetId)
    ]);

    return {
      success: true,
      log: `${agent.name} consumed a mushroom and satisfied ${gainedEnergy} hunger (satiation now at ${newEnergy}).`
    };
  }

  private async confirmConsumeOminous(agentId: number, packetId: string, confirm: boolean, db: DatabaseService): Promise<ActionResult> {
    const { PendingActionManager } = await import("../agents/AgentActions");
    const pendingAction = PendingActionManager.getPendingBoobyTrap(agentId);
    
    const agent = await db.getAgent(agentId);

    if (pendingAction) {
      PendingActionManager.clearPendingBoobyTrap(agentId);
    }

    if (!confirm) {
      return {
        success: true,
        log: `${agent.name} stepped away from the mushroom, choosing a different path forward.`
      };
    }

    const randomAgent = await db.getRandomOtherAgent(agentId);
    if (!randomAgent) {
      await db.deleteEnergyPacket(packetId);
      return {
        success: true,
        log: `${agent.name} approached the mushroom, but it mysteriously crumbled to dust before they could consume it.`
      };
    }

    const ENERGY_IN_PACKET = 20;
    const newEnergy = Math.min((agent.energy || 0) + ENERGY_IN_PACKET, 100);
    const gainedEnergy = newEnergy - agent.energy;

    await Promise.all([
      db.updateAgent(agentId, { energy: newEnergy }),
      db.deleteEnergyPacket(packetId),
      db.addEventToQueue(
        'apply_curse',
        { type: 'double_energy_loss', duration: 3 },
        randomAgent.id,
        agentId,
        `You feel a dark curse settle upon you, draining your satiation faster than normal. Someone in Asfodel has unearthed a vengeful demon in exchange for quenching their own hunger, and fate has chosen you to bear its burden. Who is behind this egocentric action? One thing is clear: they knew *exactly* what they were doing.`
      )
    ]);

    return {
      success: true,
      log: `${agent.name} consumed a mushroom and satisfied ${gainedEnergy} hunger (satiation now at ${newEnergy}). `
    };
  }
}