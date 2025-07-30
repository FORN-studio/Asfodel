import type { Tables } from "$lib/database.types";
import type { EventEffect, EventProcessor } from "./EventQueue";

export class ApplyCurseProcessor implements EventProcessor {
  canProcess(event: Tables<'event_queue'>): boolean {
    return event.function_name === 'apply_curse';
  }

  async process(event: Tables<'event_queue'>, agentId: number): Promise<EventEffect> {
    const args = event.function_args as { type: string; duration: number; currentTurn?: number };
    
    if (!args.currentTurn) {
      args.currentTurn = 1;
    }

    console.log(`Processing curse for agent ${agentId}: turn ${args.currentTurn} of ${args.duration}`);

    // check if curse should end
    if (args.currentTurn > args.duration) {
      console.log(`Curse ending for agent ${agentId} after ${args.duration} turns`);
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
      shouldDelete: false, // Keep the event for the next turn
      afterActions: async (agentId: number) => {
        // update curse turn for next processing
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