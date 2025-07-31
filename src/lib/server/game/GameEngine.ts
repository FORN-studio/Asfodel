import { AgentProcessor } from "../agents/AgentProcessor";
import { WorldManager } from "./WorldManager";
import { DatabaseService } from "../data/DatabaseService";
import { EventQueue } from "../events/EventQueue";

export class GameEngine {
  private agentProcessor: AgentProcessor;
  private worldManager: WorldManager;
  private db: DatabaseService;
  private eventQueue: EventQueue;

  constructor() {
    this.worldManager = new WorldManager();
    this.db = new DatabaseService();
    this.eventQueue = new EventQueue();
    this.agentProcessor = new AgentProcessor(this.eventQueue);
    
    this.db.forceCleanupAllProcessingStates().catch(() => {});
  }

  async processNextAgent(): Promise<{ success: boolean; actions?: number }> {
    const nextAgent = await this.db.getNextAgentForProcessing();
    return await this.agentProcessor.processAgent(nextAgent.id);
  }

  async seedWorld(): Promise<{ success: boolean }> {
    return await this.worldManager.seed();
  }

  async resetWorld(): Promise<{ success: boolean; error?: string }> {
    return await this.worldManager.reset();
  }

  async spawnEnergyPacket(): Promise<void> {
    await this.worldManager.spawnRandomEnergyPacket();
  }

  async spawnGoldChest(): Promise<void> {
    await this.worldManager.spawnRandomGoldChest();
  }

  async cleanupExpiredEvents(): Promise<void> {
    await this.eventQueue.cleanupExpiredEvents();
  }

  async cleanupStuckProcessingStates(): Promise<void> {
    await this.db.cleanupStuckProcessingStates();
  }

  async forceCleanupAllProcessingStates(): Promise<void> {
    await this.db.forceCleanupAllProcessingStates();
  }

  async ageAllTrees(): Promise<void> {
    await this.db.ageAllTrees();
  }

  getEventQueue(): EventQueue {
    return this.eventQueue;
  }
}