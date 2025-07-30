<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  type Props = {
    log: string;
    onExpire?: () => void;
  };

  const { log, onExpire }: Props = $props();

  onMount(() => {
    const timer = setTimeout(() => {
      if (onExpire) onExpire();
    }, 10000);

    return () => clearTimeout(timer);
  });
</script>

<div 
  class="log-toast"
  transition:fly={{ y: 50, duration: 300 }}
>
  {log}
</div>

<style>
  .log-toast {
    background: #fff;
    color: #000;
    padding: 12px 16px;
    line-height: 1.4;
    max-width: 300px;
    word-wrap: break-word;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 8px;
    font-family: "Jersey 15", sans-serif;
    border: solid 2px #000;
  }
</style>