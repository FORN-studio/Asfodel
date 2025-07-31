<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import type { Tables } from '$lib/database.types';
  import GameMap from '$lib/components/GameMap.svelte';
  import LogToast from '$lib/components/LogToast.svelte';

  const { data } = $props();
  let { agents = [], energy = [], goldChests = [], trees = [], eggs = [], logs = [], cursedAgents = [] } = $state(data);
  
  let activeMessages = $state<Record<number, { content: string; timestamp: number }>>({});
  
  let activeToasts = $state<Array<{ id: number; log: string; timestamp: number }>>([]);

  const handleMessageExpire = (agentId: number) => {
    delete activeMessages[agentId];
  };

  onMount(() => {

    const agentChannel = supabase
      .channel('agents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, ({ eventType, new: n, old }) => {
        const record = (n ?? old) as Tables<'agents'>;
        if (eventType === 'INSERT') agents = [...agents, record];
        if (eventType === 'UPDATE') agents = agents.map(a => a.id === record.id ? record : a);
        if (eventType === 'DELETE') agents = agents.filter(a => a.id !== record.id);
      })
      .subscribe();

    const energyChannel = supabase
      .channel('energy_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'energy_packets' }, ({ eventType, new: n, old }) => {
        console.log('Energy packet event:', eventType, 'new:', n, 'old:', old);
        
        if (eventType === 'INSERT' && n) {
          const record = n as Tables<'energy_packets'>;
          console.log('Adding energy packet:', record.id);
          energy = [...energy, record];
        }
        
        if (eventType === 'UPDATE' && n) {
          const record = n as Tables<'energy_packets'>;
          energy = energy.map(e => e.id === record.id ? record : e);
        }
        
        if (eventType === 'DELETE' && old) {
          const record = old as Tables<'energy_packets'>;
          console.log('Deleting energy packet:', record.id);
          energy = energy.filter(e => e.id !== record.id);
          console.log('Energy packets after deletion:', energy.length);
        }
      })
      .subscribe();

    console.log('Energy channel subscription created');

    const goldChestsChannel = supabase
      .channel('gold_chests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold_chests' }, ({ eventType, new: n, old }) => {
        console.log('Gold chest event:', eventType, 'new:', n, 'old:', old);
        
        if (eventType === 'INSERT' && n) {
          const record = n as Tables<'gold_chests'>;
          console.log('Adding gold chest:', record.id);
          goldChests = [...goldChests, record];
        }
        
        if (eventType === 'UPDATE' && n) {
          const record = n as Tables<'gold_chests'>;
          goldChests = goldChests.map(g => g.id === record.id ? record : g);
        }
        
        if (eventType === 'DELETE' && old) {
          const record = old as Tables<'gold_chests'>;
          console.log('Deleting gold chest:', record.id);
          goldChests = goldChests.filter(g => g.id !== record.id);
          console.log('Gold chests after deletion:', goldChests.length);
        }
      })
      .subscribe();

    console.log('Gold chests channel subscription created');

    const treesChannel = supabase
      .channel('trees_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trees' }, ({ eventType, new: n, old }) => {
        console.log('Tree event:', eventType, 'new:', n, 'old:', old);
        
        if (eventType === 'INSERT' && n) {
          const record = n as Tables<'trees'>;
          console.log('Adding tree:', record.id);
          trees = [...trees, record];
        }
        
        if (eventType === 'UPDATE' && n) {
          const record = n as Tables<'trees'>;
          trees = trees.map(t => t.id === record.id ? record : t);
        }
        
        if (eventType === 'DELETE' && old) {
          const record = old as Tables<'trees'>;
          console.log('Deleting tree:', record.id);
          trees = trees.filter(t => t.id !== record.id);
          console.log('Trees after deletion:', trees.length);
        }
      })
      .subscribe();

    console.log('Trees channel subscription created');

    const eggsChannel = supabase
      .channel('eggs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eggs' }, ({ eventType, new: n, old }) => {
        console.log('Egg event:', eventType, 'new:', n, 'old:', old);
        
        if (eventType === 'INSERT' && n) {
          const record = n as Tables<'eggs'>;
          console.log('Adding egg:', record.id);
          eggs = [...eggs, record];
        }
        
        if (eventType === 'UPDATE' && n) {
          const record = n as Tables<'eggs'>;
          eggs = eggs.map(e => e.id === record.id ? record : e);
        }
        
        if (eventType === 'DELETE' && old) {
          const record = old as Tables<'eggs'>;
          console.log('Deleting egg:', record.id);
          eggs = eggs.filter(e => e.id !== record.id);
          console.log('Eggs after deletion:', eggs.length);
        }
      })
      .subscribe();

    console.log('Eggs channel subscription created');

    const messagesChannel = supabase
      .channel('messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: newMessage }) => {
        const message = newMessage as Tables<'messages'>;
        if (message.from_agent) {
          activeMessages[message.from_agent] = {
            content: message.content,
            timestamp: Date.now()
          };
        }
      })
      .subscribe();

    const logsChannel = supabase
      .channel('logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, ({ new: newLog }) => {
        const log = newLog as Tables<'logs'>;
        activeToasts = [...activeToasts, {
          id: log.id,
          log: log.log,
          timestamp: Date.now()
        }];
      })
      .subscribe();

    const cursedChannel = supabase
      .channel('cursed_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_queue' }, async ({ eventType, new: n, old }) => {
        // When events change, refresh the cursed agents list
        const { data: newCursedAgents } = await supabase
          .from('event_queue')
          .select('target_agent')
          .eq('function_name', 'apply_curse')
          .not('target_agent', 'is', null);
        
        cursedAgents = (newCursedAgents || []).map(row => row.target_agent).filter(id => id !== null) as number[];
      })
      .subscribe();

    return () => {
      supabase.removeChannel(agentChannel);
      supabase.removeChannel(energyChannel);
      supabase.removeChannel(goldChestsChannel);
      supabase.removeChannel(treesChannel);
      supabase.removeChannel(eggsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(cursedChannel);
    };
  });
</script>

<style>
  .toast-container {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
</style>

<GameMap 
  {agents} 
  {energy} 
  {goldChests}
  {trees}
  {eggs}
  {logs}
  {cursedAgents}
  {activeMessages} 
  onMessageExpire={handleMessageExpire}
/>

<div class="toast-container">
  {#each activeToasts.filter(t => !['consumed a', 'set out on a journey', 'spoke to', 'removed a plan', 'planted a'].some(s => t.log.includes(s))) as toast (toast.id)}
    <LogToast 
      log={toast.log} 
      onExpire={() => {
        activeToasts = activeToasts.filter(t => t.id !== toast.id);
      }}
    />
  {/each}
</div>

