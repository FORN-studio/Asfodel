import { supabase } from "../supabase";
import type { Tables } from "$lib/database.types";
import type { QueryData } from '@supabase/supabase-js';
import { subDays, formatDistanceToNow } from 'date-fns';

export class DatabaseService {
  async getAgent(id: number): Promise<Tables<'agents'>> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getAgentByName(name: string): Promise<Tables<'agents'>> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('name', name)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllAgents(): Promise<Pick<Tables<'agents'>, 'id' | 'name' | 'energy' | 'gold' | 'x_position' | 'y_position'>[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, energy, gold, x_position, y_position');

    if (error) throw error;
    return data;
  }

  async updateAgent(id: number, updates: Partial<Tables<'agents'>>): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteAgent(id: number): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getNextAgentForProcessing(): Promise<{ id: number }> {
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data: agents, error: selectError } = await supabase
          .from('agents')
          .select('id, currently_being_processed')
          .eq('currently_being_processed', false)
          .order('processed_at', { ascending: true })
          .limit(3);

        if (selectError) throw selectError;
        if (!agents || agents.length === 0) {
          throw new Error('No agents available for processing');
        }

        for (const agent of agents) {
          const { data: updatedAgent, error: updateError } = await supabase
            .from('agents')
            .update({ 
              currently_being_processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', agent.id)
            .eq('currently_being_processed', false)
            .select('id');

          if (!updateError && updatedAgent && updatedAgent.length > 0) {
            return { id: updatedAgent[0].id };
          }
        }

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
          continue;
        }

        throw new Error('All agents are currently being processed');
      } catch (error) {
        lastError = error as Error;
        
        if (lastError.message.includes('No agents available')) {
          throw lastError;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.min(50 * Math.pow(2, attempt), 500);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to select agent for processing after multiple attempts');
  }

  async markAgentProcessingComplete(id: number): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update({ currently_being_processed: false })
      .eq('id', id);

    if (error) throw error;
  }

  async cleanupStuckProcessingStates(): Promise<void> {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    const { error } = await supabase
      .from('agents')
      .update({ currently_being_processed: false })
      .eq('currently_being_processed', true)
      .lt('processed_at', thirtySecondsAgo);

    if (error) throw error;
  }

  async forceCleanupAllProcessingStates(): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update({ currently_being_processed: false })
      .eq('currently_being_processed', true);

    if (error) throw error;
  }

  async getAgentMessages(agentId: number, daysBack: number = 2, limit: number = 20) {
    const messagesQuery = supabase
      .from('messages')
      .select('*, from_agent:agents!messages_from_agent_fkey(id,name), to_agent:agents!messages_to_agent_fkey(id,name)')
      .or(`from_agent.eq.${agentId},to_agent.eq.${agentId}`)
      .gt('created_at', subDays(new Date(), daysBack).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    type Messages = QueryData<typeof messagesQuery>;
    const { data, error } = await messagesQuery;

    if (error) throw error;
    return data as Messages;
  }

  async getNearbyEvents(agent: Tables<'agents'>, radius: number = 10, limit: number = 20) {
    const { data, error } = await supabase
      .from('logs')
      .select('created_by, log, x_position, y_position')
      .gte('x_position', agent.x_position - radius)
      .lte('x_position', agent.x_position + radius)
      .gte('y_position', agent.y_position - radius)
      .lte('y_position', agent.y_position + radius)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getAgentActions(agentId: number, limit: number = 10) {
    const { data, error } = await supabase
      .from('logs')
      .select('log, x_position, y_position')
      .eq('created_by', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getAllEnergyPackets(): Promise<Tables<'energy_packets'>[]> {
    const { data, error } = await supabase
      .from('energy_packets')
      .select('*');

    if (error) throw error;
    return data;
  }

  async getEnergyPacket(id: string): Promise<Tables<'energy_packets'>> {
    const { data, error } = await supabase
      .from('energy_packets')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async deleteEnergyPacket(id: string): Promise<void> {
    const { error } = await supabase
      .from('energy_packets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async createMessage(fromAgent: number, toAgent: number, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .insert({
        from_agent: fromAgent,
        to_agent: toAgent,
        content
      });

    if (error) throw error;
  }

  async createLog(createdBy: number | null, log: string, xPosition: number, yPosition: number): Promise<void> {
    const { error } = await supabase
      .from('logs')
      .insert({ 
        created_by: createdBy, 
        log,
        x_position: xPosition,
        y_position: yPosition
      });

    if (error) throw error;
  }

  async createEnergyPacket(xPosition: number, yPosition: number): Promise<void> {
    const { error } = await supabase
      .from('energy_packets')
      .insert({
        x_position: xPosition,
        y_position: yPosition
      });

    if (error) throw error;
  }

  async createAgent(name: string, color: string, xPosition?: number, yPosition?: number): Promise<number> {
    const { data, error } = await supabase
      .from('agents')
      .insert({
        color,
        name,
        x_position: xPosition,
        y_position: yPosition
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async createEnergyPacketWithTrap(xPosition: number, yPosition: number, isBoobyTrapped: boolean = false): Promise<void> {
    const { error } = await supabase
      .from('energy_packets')
      .insert({
        x_position: xPosition,
        y_position: yPosition,
        is_booby_trapped: isBoobyTrapped
      });

    if (error) throw error;
  }

  async addEventToQueue(functionName: string, functionArgs: any, targetAgent: number | null = null, createdBy: number | null = null, promptToTarget: string | null = null): Promise<number> {
    const { data, error } = await supabase
      .from('event_queue')
      .insert({
        function_name: functionName,
        function_args: functionArgs,
        target_agent: targetAgent,
        created_by: createdBy,
        prompt_to_target: promptToTarget
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getEventsForAgent(agentId: number): Promise<Tables<'event_queue'>[]> {
    const { data, error } = await supabase
      .from('event_queue')
      .select('*')
      .eq('target_agent', agentId);

    if (error) throw error;
    return data;
  }

  async removeEventFromQueue(eventId: number): Promise<void> {
    const { error } = await supabase
      .from('event_queue')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }

  async getRandomOtherAgent(excludeAgentId: number): Promise<Tables<'agents'> | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .neq('id', excludeAgentId);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }

  async createMemory(agentId: number, newMemory: string): Promise<Tables<'agents'>> {
    const { data, error } = await supabase
      .from('agent_memories')
      .insert({ agent: agentId, memory: newMemory })
      .select('self:agents(*)')
      .single()
    
    if (error) throw error

    return data.self
  }

  async getMemories(agentId: number): Promise<string[]> {
    const { data: memories, error } = await supabase
      .from('agent_memories')
      .select('created_at, memory')
      .eq('agent', agentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return memories.map(m => `${formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}: "${m.memory}"`)
  }

  async createPlan(agentId: number, newPlan: string): Promise<Tables<'agents'>> {
    const { data, error } = await supabase
      .from('agent_plans')
      .insert({ agent: agentId, plan: newPlan })
      .select('self:agents(*)')
      .single()
    
    if (error) throw error
    return data.self
  }

  async getPlans(agentId: number): Promise<Array<{ id: number; plan: string; created_at: string }>> {
    const { data: plans, error } = await supabase
      .from('agent_plans')
      .select('id, plan, created_at')
      .eq('agent', agentId)
      .order('created_at', { ascending: true })
      .limit(50)
    if (error) throw error
    return plans || []
  }

  async deletePlan(planId: number): Promise<void> {
    const { error } = await supabase
      .from('agent_plans')
      .delete()
      .eq('id', planId)
    if (error) throw error
  }

  async clearPlans(): Promise<void> {
    const { error } = await supabase
      .from('agent_plans')
      .delete()
      .neq('id', 0);
    if (error) throw error;
  }

  async createTree(agentId: number, xPosition: number, yPosition: number): Promise<Tables<'trees'>> {
    const { data, error } = await supabase
      .from('trees')
      .insert({
        planted_by: agentId,
        x_position: xPosition,
        y_position: yPosition,
        age: 0,
        is_consumed: false
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllTrees() {
    const treesQuery = supabase
      .from('trees')
      .select('*, planted_by(name)')
      .order('created_at', { ascending: true });
    type Trees = QueryData<typeof treesQuery>
    const { data, error } = await treesQuery;
    if (error) throw error;
    return data || [];
  }

  async getNearbyTrees(agent: Tables<'agents'>, radius: number = 10): Promise<Tables<'trees'>[]> {
    const { data, error } = await supabase
      .from('trees')
      .select('*')
      .gte('x_position', agent.x_position - radius)
      .lte('x_position', agent.x_position + radius)
      .gte('y_position', agent.y_position - radius)
      .lte('y_position', agent.y_position + radius);
    if (error) throw error;
    return data || [];
  }

  async updateTreeAge(treeId: string, newAge: number): Promise<void> {
    const { error } = await supabase
      .from('trees')
      .update({ age: newAge })
      .eq('id', treeId);
    if (error) throw error;
  }

  async consumeTree(treeId: string): Promise<void> {
    const { error } = await supabase
      .from('trees')
      .update({ is_consumed: true })
      .eq('id', treeId);
    if (error) throw error;
  }

  async getTree(treeId: string): Promise<Tables<'trees'>> {
    const { data, error } = await supabase
      .from('trees')
      .select('*')
      .eq('id', treeId)
      .single();
    if (error) throw error;
    return data;
  }

  async ageAllTrees(): Promise<void> {
    const { error } = await supabase.rpc('increment_tree_ages');
    if (error) throw error
  }

  async deleteTree(treeId: string): Promise<void> {
    const { error } = await supabase
      .from('trees')
      .delete()
      .eq('id', treeId);
    if (error) throw error;
  }

  async createEgg(laidBy: number, name: string, x: number, y: number): Promise<Tables<'eggs'>> {
    const { data, error } = await supabase
      .from('eggs')
      .insert({
        laid_by: laidBy,
        name: name,
        nurtured_times: 0,
        hatched: false,
        x_position: x,
        y_position: y
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAllEggs() {
    const eggsQuery = supabase
      .from('eggs')
      .select('*, laid_by:agents!eggs_laid_by_fkey(id, name, x_position, y_position), nurtured_by:agents!eggs_nurtured_by_fkey(name)')
      .order('created_at', { ascending: true });
    const { data, error } = await eggsQuery;
    if (error) throw error;
    return data || [];
  }

  async getUnhatchedEggs() {
    const eggsQuery = supabase
      .from('eggs')
      .select('*, laid_by:agents!eggs_laid_by_fkey(id, name, x_position, y_position), nurtured_by:agents!eggs_nurtured_by_fkey(name)')
      .eq('hatched', false)
      .order('created_at', { ascending: true });
    const { data, error } = await eggsQuery;
    if (error) throw error;
    return data || [];
  }

  async getNearbyEggs(agent: Tables<'agents'>, radius: number = 10): Promise<(Tables<'eggs'> & { laid_by: { id: number, name: string, x_position: number, y_position: number } | null, nurtured_by: { name: string } | null })[]> {
    const eggsQuery = supabase
      .from('eggs')
      .select('*, laid_by:agents!eggs_laid_by_fkey(id, name, x_position, y_position), nurtured_by:agents!eggs_nurtured_by_fkey(name)')
      .eq('hatched', false);
    type AllEggs = QueryData<typeof eggsQuery>
    const { data, error } = await eggsQuery;
    if (error) throw error;
    
    // filter by egg position distance
    return (data as AllEggs || []).filter(egg => {
      const dx = egg.x_position - agent.x_position;
      const dy = egg.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  async getEgg(eggId: number): Promise<Tables<'eggs'>> {
    const { data, error } = await supabase
      .from('eggs')
      .select('*')
      .eq('id', eggId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateEgg(eggId: number, updates: Partial<Tables<'eggs'>>): Promise<void> {
    const { error } = await supabase
      .from('eggs')
      .update(updates)
      .eq('id', eggId);
    if (error) throw error;
  }

  async deleteEgg(eggId: number): Promise<void> {
    const { error } = await supabase
      .from('eggs')
      .delete()
      .eq('id', eggId);
    if (error) throw error;
  }

  async upsertAgentTrust(fromAgent: number, toAgent: number, trustworthiness: number): Promise<void> {
      // try to update existing record first
    const { data: existingRecord } = await supabase
      .from('agent_trust')
      .select('id')
      .eq('agent', fromAgent)
      .eq('other_agent', toAgent)
      .maybeSingle();

    if (existingRecord) {
      // update existing record
      const { error } = await supabase
        .from('agent_trust')
        .update({ other_agent_trustworthiness: trustworthiness })
        .eq('agent', fromAgent)
        .eq('other_agent', toAgent);
      if (error) throw error;
    } else {
      // insert new record
      const { error } = await supabase
        .from('agent_trust')
        .insert({
          agent: fromAgent,
          other_agent: toAgent,
          other_agent_trustworthiness: trustworthiness
        });
      if (error) throw error;
    }
  }

  async getAgentTrustRelationships(agentId: number): Promise<Array<{ other_agent_name: string; trustworthiness: number }>> {
    const { data, error } = await supabase
      .from('agent_trust')
      .select('other_agent_trustworthiness, other_agent:agents!agent_trust_other_agent_fkey(name)')
      .eq('agent', agentId);
    
    if (error) throw error;
    
    return (data || []).map(row => ({
      other_agent_name: (row.other_agent as any)?.name || 'Unknown',
      trustworthiness: row.other_agent_trustworthiness
    }));
  }

  async updateEventArgs(eventId: number, newArgs: any): Promise<void> {
    const { error } = await supabase
      .from('event_queue')
      .update({ function_args: newArgs })
      .eq('id', eventId);

    if (error) throw error;
  }

  async getCursedAgents(): Promise<number[]> {
    const { data, error } = await supabase
      .from('event_queue')
      .select('target_agent')
      .eq('function_name', 'apply_curse')
      .not('target_agent', 'is', null);

    if (error) throw error;
    return (data || []).map(row => row.target_agent as number);
  }

  async getAllGoldChests(): Promise<Tables<'gold_chests'>[]> {
    const { data, error } = await supabase
      .from('gold_chests')
      .select('*');

    if (error) throw error;
    return data;
  }

  async getGoldChest(id: string): Promise<Tables<'gold_chests'>> {
    const { data, error } = await supabase
      .from('gold_chests')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createGoldChest(xPosition: number, yPosition: number): Promise<void> {
    const { error } = await supabase
      .from('gold_chests')
      .insert({
        x_position: xPosition,
        y_position: yPosition
      });

    if (error) throw error;
  }

  async deleteGoldChest(id: string): Promise<void> {
    const { error } = await supabase
      .from('gold_chests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}