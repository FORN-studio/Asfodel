<script lang="ts">
  import type { Tables } from '$lib/database.types';
  import PixiCanvas from './PixiCanvas.svelte';
  import ChatBubble from './ChatBubble.svelte';
  import { fly } from 'svelte/transition';

  type Props = {
    agents: Tables<'agents'>[];
    energy: Tables<'energy_packets'>[];
    trees: Tables<'trees'>[];
    eggs: Tables<'eggs'>[];
    logs: Tables<'logs'>[];
    cursedAgents: number[];
    activeMessages: Record<number, { content: string; timestamp: number }>;
    onMessageExpire: (agentId: number) => void;
  };

  const { agents, energy, trees, eggs, logs, cursedAgents, activeMessages, onMessageExpire }: Props = $props();
  
  let agentScreenPositions = $state<Record<number, { x: number; y: number }>>({});
  
  function handleAgentPositionsUpdate(positions: Record<number, { x: number; y: number }>) {
    agentScreenPositions = positions;
  }

</script>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .chat-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  .chat-bubble-positioned {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: all;
    width: 250px;
  }
</style>

<div class="map">
  <PixiCanvas {agents} {energy} {trees} {eggs} {logs} {cursedAgents} {activeMessages} {onMessageExpire} onAgentPositionsUpdate={handleAgentPositionsUpdate} />
  
  <div class="chat-overlay">
    {#each agents as agent (agent.id)}
      {#if activeMessages[agent.id] && agentScreenPositions[agent.id]}
        <div
          class="chat-bubble-positioned"
          style="left: {agentScreenPositions[agent.id].x}px; top: {agentScreenPositions[agent.id].y - 60}px;"
          transition:fly={{ duration: 300, y: -15 }}
        >
          <ChatBubble
            message={activeMessages[agent.id].content}
            onExpire={() => onMessageExpire(agent.id)}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>