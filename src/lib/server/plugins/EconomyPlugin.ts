import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { Tables } from "$lib/database.types";
import type { EventProcessor } from "../events/EventQueue";
import { Type, type FunctionDeclaration } from "@google/genai";

export class TradeOfferProcessor implements EventProcessor {
  canProcess(event: Tables<'event_queue'>): boolean {
    return event.function_name === 'trade_offer';
  }

  async process(event: Tables<'event_queue'>, agentId: number) {
    const args = event.function_args as { fromAgent: number; goldAmount: number; energyAmount: number };
    
    return {
      modifyPrompt: (prompt: string) => {
        const promptAddition = `\n\nTRADE OFFER: Agent has offered ${args.goldAmount} gold in exchange for ${args.energyAmount} of your satiation. You must decide whether to accept or decline this trade using accept_trade or decline_trade with offer_id: ${event.id}.`;
        return prompt + promptAddition;
      },
      shouldDelete: false
    };
  }
}

export class EconomyPlugin implements GamePlugin {
  name = "economy";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'collect_gold_chest',
        description: 'Collect gold from a nearby treasure chest.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            chest_id: {
              type: Type.STRING,
              description: 'ID of the nearby gold chest to collect.',
            },
          },
          required: ['chest_id'],
        },
      },
      {
        name: 'offer_trade',
        description: 'Offer a trade to another agent - give gold in exchange for their satiation.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_agent: {
              type: Type.STRING,
              description: 'Name of the agent to trade with.'
            },
            gold_amount: {
              type: Type.NUMBER,
              description: 'Amount of gold you want to give.'
            },
            energy_amount: {
              type: Type.NUMBER,
              description: 'Amount of satiation you want to receive in return.'
            }
          },
          required: ['target_agent', 'gold_amount', 'energy_amount']
        }
      },
      {
        name: 'accept_trade',
        description: 'Accept a pending trade offer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            offer_id: {
              type: Type.NUMBER,
              description: 'ID of the trade offer to accept.'
            }
          },
          required: ['offer_id']
        }
      },
      {
        name: 'decline_trade',
        description: 'Decline a pending trade offer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            offer_id: {
              type: Type.NUMBER,
              description: 'ID of the trade offer to decline.'
            }
          },
          required: ['offer_id']
        }
      }
    ];
  }

  canHandleFunction(functionName: string): boolean {
    return ['collect_gold_chest', 'offer_trade', 'accept_trade', 'decline_trade'].includes(functionName);
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    switch (functionName) {
      case 'collect_gold_chest':
        return await this.collectGoldChest(agentId, args.chest_id as string, db);
      case 'offer_trade':
        return await this.offerTrade(agentId, args.target_agent as string, args.gold_amount as number, args.energy_amount as number, db);
      case 'accept_trade':
        return await this.acceptTrade(agentId, args.offer_id as number, db);
      case 'decline_trade':
        return await this.declineTrade(agentId, args.offer_id as number, db);
      default:
        throw new Error(`EconomyPlugin cannot handle function: ${functionName}`);
    }
  }

  contributeToPrompt(context: PromptContext): string {
    const nearbyChests = this.getNearbyChests(context.goldChests, context.agent);
    
    const goldChestsSection = !context.goldChests.length
      ? 'There are currently no gold chests left in the world. More may spawn soon.'
      : `Gold chests in the world: \n${context.goldChests.map(c => {
          const isNearby = nearbyChests.some(nc => nc.id === c.id);
          const proximityNote = isNearby ? ` (nearby - collectible, ID: ${c.id})` : '';
          return `Gold chest at (x: ${c.x_position}, y: ${c.y_position})${proximityNote}`;
        }).join('\n')}`;

    return goldChestsSection;
  }

  getEventProcessors() {
    return {
      'trade_offer': new TradeOfferProcessor()
    };
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const goldChests = await db.getAllGoldChests();
    return { goldChests };
  }

  private getNearbyChests(chests: Tables<'gold_chests'>[], agent: Tables<'agents'>, radius: number = 10): Tables<'gold_chests'>[] {
    return chests.filter(c => {
      const dx = c.x_position - agent.x_position;
      const dy = c.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private async collectGoldChest(agentId: number, chestId: string, db: DatabaseService): Promise<ActionResult> {
    const [chest, agent] = await Promise.all([
      db.getGoldChest(chestId),
      db.getAgent(agentId)
    ]);

    const distance = Math.hypot(chest.x_position - agent.x_position, chest.y_position - agent.y_position);
    if (distance > 10) {
      return {
        success: false,
        log: `${agent.name} tried to collect a gold chest, but it was too far away.`
      };
    }

    const GOLD_IN_CHEST = 10;
    const newGold = (agent.gold || 0) + GOLD_IN_CHEST;

    await Promise.all([
      db.updateAgent(agentId, { gold: newGold }),
      db.deleteGoldChest(chestId)
    ]);

    return {
      success: true,
      log: `${agent.name} collected a treasure chest and found ${GOLD_IN_CHEST} gold (gold now ${newGold}).`
    };
  }

  private async offerTrade(agentId: number, targetAgentName: string, goldAmount: number, energyAmount: number, db: DatabaseService): Promise<ActionResult> {
    const [agent, targetAgent] = await Promise.all([
      db.getAgent(agentId),
      db.getAgentByName(targetAgentName)
    ]);

    if (agent.gold < goldAmount) {
      return {
        success: false,
        log: `${agent.name} doesn't have enough gold to make this trade offer.`
      };
    }

    if (targetAgent.energy < energyAmount) {
      return {
        success: false,
        log: `${agent.name} attempted to trade with ${targetAgent.name}, but they don't have enough satiation to complete the trade.`
      };
    }

    const distance = Math.hypot(targetAgent.x_position - agent.x_position, targetAgent.y_position - agent.y_position);
    if (distance > 10) {
      return {
        success: false,
        log: `${agent.name} tried to offer a trade to ${targetAgent.name}, but they were too far away.`
      };
    }

    await db.addEventToQueue(
      'trade_offer',
      { fromAgent: agentId, goldAmount, energyAmount },
      targetAgent.id,
      agentId,
      `${agent.name} has offered you ${goldAmount} gold in exchange for ${energyAmount} of your satiation.`
    );

    return {
      success: true,
      log: `${agent.name} offered ${targetAgent.name} a trade: ${goldAmount} gold for ${energyAmount} satiation.`
    };
  }

  private async acceptTrade(agentId: number, offerId: number, db: DatabaseService): Promise<ActionResult> {
    const events = await db.getEventsForAgent(agentId);
    const tradeEvent = events.find(e => e.id === offerId && e.function_name === 'trade_offer');
    
    if (!tradeEvent) {
      return {
        success: false,
        log: `No valid trade offer found with that ID.`
      };
    }

    const args = tradeEvent.function_args as { fromAgent: number; goldAmount: number; energyAmount: number };
    const [acceptingAgent, offeringAgent] = await Promise.all([
      db.getAgent(agentId),
      db.getAgent(args.fromAgent)
    ]);

    if (acceptingAgent.energy < args.energyAmount) {
      return {
        success: false,
        log: `${acceptingAgent.name} no longer has enough satiation to complete this trade.`
      };
    }

    if (offeringAgent.gold < args.goldAmount) {
      return {
        success: false,
        log: `${acceptingAgent.name} tried to accept a trade, but ${offeringAgent.name} no longer has enough gold.`
      };
    }

    const newAccepterGold = (acceptingAgent.gold || 0) + args.goldAmount;
    const newAccepterEnergy = acceptingAgent.energy - args.energyAmount;
    const newOffererGold = offeringAgent.gold - args.goldAmount;
    const newOffererEnergy = Math.min(offeringAgent.energy + args.energyAmount, 100);

    await Promise.all([
      db.updateAgent(agentId, { gold: newAccepterGold, energy: newAccepterEnergy }),
      db.updateAgent(args.fromAgent, { gold: newOffererGold, energy: newOffererEnergy }),
      db.removeEventFromQueue(offerId)
    ]);

    return {
      success: true,
      log: `${acceptingAgent.name} accepted ${offeringAgent.name}'s trade offer. ${args.goldAmount} gold exchanged for ${args.energyAmount} satiation.`
    };
  }

  private async declineTrade(agentId: number, offerId: number, db: DatabaseService): Promise<ActionResult> {
    const events = await db.getEventsForAgent(agentId);
    const tradeEvent = events.find(e => e.id === offerId && e.function_name === 'trade_offer');
    
    if (!tradeEvent) {
      return {
        success: false,
        log: `No valid trade offer found with that ID.`
      };
    }

    const args = tradeEvent.function_args as { fromAgent: number; goldAmount: number; energyAmount: number };
    const [decliningAgent, offeringAgent] = await Promise.all([
      db.getAgent(agentId),
      db.getAgent(args.fromAgent)
    ]);

    await db.removeEventFromQueue(offerId);

    return {
      success: true,
      log: `${decliningAgent.name} declined ${offeringAgent.name}'s trade offer.`
    };
  }
}