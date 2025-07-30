import type { Tables } from "$lib/database.types";
import { DatabaseService } from "../data/DatabaseService";
import { PromptGenerator } from "./PromptGenerator";
import { EventQueue } from "../events/EventQueue";
import { generate } from "../gemini";
import { handleFunctionCalls, PendingActionManager, AgentActionHandler } from "./AgentActions";

export class AgentProcessor {
  private db: DatabaseService;
  private promptGenerator: PromptGenerator;
  private eventQueue: EventQueue;

  constructor(eventQueue?: EventQueue) {
    this.db = new DatabaseService();
    this.promptGenerator = new PromptGenerator(this.db);
    this.eventQueue = eventQueue || new EventQueue();
  }

  async processAgent(id: number): Promise<{ success: boolean; actions?: number }> {
    const agent = await this.db.getAgent(id);
    
    const COST = 1;
    if (agent.energy - COST <= 0) {
      return await this.handleAgentDeath(agent);
    }

    const [messages, nearbyEvents, ownActions, allAgents, packets, memories, plans, trees, eggs, trustRelationships] = await Promise.all([
      this.db.getAgentMessages(agent.id),
      this.db.getNearbyEvents(agent, 10, 30),
      this.db.getAgentActions(agent.id, 20),
      this.db.getAllAgents(),
      this.db.getAllEnergyPackets(),
      this.db.getMemories(agent.id),
      this.db.getPlans(agent.id),
      this.db.getAllTrees(),
      this.db.getUnhatchedEggs(),
      this.db.getAgentTrustRelationships(agent.id)
    ]);

    const eventEffects = await this.eventQueue.processEventsForAgent(agent.id);
    
    let prompt = await this.promptGenerator.generatePrompt(
      agent, 
      messages, 
      nearbyEvents, 
      ownActions, 
      allAgents, 
      packets,
      memories,
      plans,
      trees,
      eggs,
      trustRelationships
    );

    const eventModifications: string[] = [];
    for (const effect of eventEffects) {
      if (effect.modifyPrompt) {
        prompt = effect.modifyPrompt(prompt, agent.id);
        eventModifications.push(effect.modifyPrompt(prompt, agent.id));
      }
      if (effect.beforeActions) {
        await effect.beforeActions(agent.id);
      }
    }

    const actionHandler = new AgentActionHandler();
    actionHandler.setOriginalPosition(agent.id, agent.x_position, agent.y_position);

    try {
      const response = await generate(prompt);
      const results = await handleFunctionCalls(response, agent.id, actionHandler);

      for (const result of results) {
        await this.db.createLog(
          agent.id, 
          result.result.log,
          agent.x_position,
          agent.y_position
        );
        console.log(result.result.log);
      }

      for (const effect of eventEffects) {
        if (effect.afterActions) {
          await effect.afterActions(agent.id);
        }
      }

      const updatedAgent = await this.db.getAgent(agent.id);
      
      let energyCost = COST;
      for (const effect of eventEffects) {
        if (effect.modifyEnergyDeduction) {
          energyCost = effect.modifyEnergyDeduction(energyCost);
        }
      }

      const shouldEndTurn = !results.some(r => r.result.pendingConfirmation) && !PendingActionManager.hasPendingBoobyTrap(agent.id);
      
      if (shouldEndTurn) {
        actionHandler.clearOriginalPosition(agent.id);
        await Promise.all([
          this.db.updateAgent(updatedAgent.id, { 
            energy: Math.floor(updatedAgent.energy - energyCost),
            times_processed: updatedAgent.times_processed + 1
          }),
          this.db.markAgentProcessingComplete(updatedAgent.id)
        ]);
      }

      return { success: true, actions: results.length };
    } catch (error) {
      console.error(`Failed to process agent ${agent.name} (${agent.id}) after all retries:`, error);
      
      try {
        actionHandler.clearOriginalPosition(agent.id);
        PendingActionManager.clearPendingBoobyTrap(agent.id);
        
        await this.db.createLog(
          agent.id,
          `${agent.name} experienced a moment of confusion and lost their train of thought.`,
          agent.x_position,
          agent.y_position
        );

        await Promise.all([
          this.db.updateAgent(agent.id, { 
            energy: agent.energy - COST,
            times_processed: agent.times_processed + 1
          }),
          this.db.markAgentProcessingComplete(agent.id)
        ]);

        return { success: true, actions: 0 };
      } catch (cleanupError) {
        console.error(`Failed to cleanup agent ${agent.id} after processing error:`, cleanupError);
        
        try {
          await this.db.markAgentProcessingComplete(agent.id);
        } catch (flagError) {
          console.error(`Failed to clear processing flag for agent ${agent.id}:`, flagError);
        }
        
        throw error;
      }
    }
  }

  private async handleAgentDeath(agent: Tables<'agents'>): Promise<{ success: boolean }> {
    await Promise.all([
      this.db.createLog(
        null, 
        `${agent.name} tragically starved to death.`, 
        agent.x_position, 
        agent.y_position
      ),
      this.db.markAgentProcessingComplete(agent.id)
    ]);
    
    await this.db.deleteAgent(agent.id);

    return { success: true };
  }
}