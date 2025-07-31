import type { Tables } from "$lib/database.types";
import { DatabaseService } from "../data/DatabaseService";
import { getPluginManager } from "../plugins/PluginRegistry";

export interface EventEffect {
  modifyPrompt?: (prompt: string, agentId: number) => string;
  addActions?: () => string[];
  beforeActions?: (agentId: number) => Promise<void>;
  afterActions?: (agentId: number) => Promise<void>;
  modifyEnergyDeduction?: (originalCost: number) => number;
  shouldDelete?: boolean;
}

export interface EventProcessor {
  canProcess(event: Tables<'event_queue'>): boolean;
  process(event: Tables<'event_queue'>, agentId: number): Promise<EventEffect>;
}

export class EventQueue {
  private processors: Map<string, EventProcessor> = new Map();
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
    this.initializePluginProcessors();
  }

  private initializePluginProcessors(): void {
    const pluginManager = getPluginManager();
    const pluginProcessors = pluginManager.getAllEventProcessors();
    for (const [eventName, processor] of pluginProcessors) {
      this.processors.set(eventName, processor);
    }
  }

  registerProcessor(functionName: string, processor: EventProcessor) {
    this.processors.set(functionName, processor);
  }

  async addEvent(functionName: string, functionArgs: any, targetAgent: number | null = null, createdBy: number | null = null, promptToTarget: string | null = null): Promise<number> {
    return await this.db.addEventToQueue(functionName, functionArgs, targetAgent, createdBy, promptToTarget);
  }

  async getEventsForAgent(agentId: number): Promise<Tables<'event_queue'>[]> {
    return await this.db.getEventsForAgent(agentId);
  }

  async processEventsForAgent(agentId: number): Promise<EventEffect[]> {
    const events = await this.getEventsForAgent(agentId);
    const effects: EventEffect[] = [];

    for (const event of events) {
      console.log(`Processing event ${event.id}: ${event.function_name} for agent ${agentId}`);
      const processor = this.processors.get(event.function_name);
      
      if (!processor) {
        console.log(`No processor found for function: ${event.function_name}`);
        continue;
      }

      if (!processor.canProcess(event)) {
        console.log(`Processor cannot process event ${event.id}`);
        continue;
      }

      try {
        const effect = await processor.process(event, agentId);
        effects.push(effect);
        
        // only remove if processor says to delete (default true)
        const shouldDelete = effect.shouldDelete !== undefined ? effect.shouldDelete : true;
        if (shouldDelete) {
          console.log(`Successfully processed event ${event.id}, removing from queue`);
          await this.removeEvent(event.id);
        } else {
          console.log(`Successfully processed persistent event ${event.id}, keeping in queue`);
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
      }
    }

    return effects;
  }

  async removeEvent(eventId: number): Promise<void> {
    await this.db.removeEventFromQueue(eventId);
  }

  async cleanupExpiredEvents(): Promise<void> {
    // future: add expiration logic
  }
}