<script lang="ts">
  import { onMount } from 'svelte';

  type Props = {
    message: string;
    onExpire?: () => void;
  };

  const { message, onExpire }: Props = $props();

  onMount(() => {
    const timer = setTimeout(() => {
      if (onExpire) onExpire();
    }, 15000); // 15 seconds

    return () => clearTimeout(timer);
  });
</script>

<div class="chat-bubble">
  {message}
</div>

<style>
  .chat-bubble {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: white;
    border: 2px solid #1b1b1b;
    padding: 8px 12px;
    margin-bottom: 8px;
    width: 300px;
    word-wrap: break-word;
    font-size: 1rem;
    z-index: 10;
    font-family: "Jersey 15", sans-serif;

    &::after {
      content: '';
      width: 20px;
      height: 20px;
      background-color: #fff;
      border: solid 2px #000;
      transform: translateY(-10px) rotate(45deg);
      position: absolute;
      top: 100%;
      left: calc(50% - 10px);
    }

    &::before {
      content: '';
      width: 50px;
      height: 13px;
      background-color: #fff;
      position: absolute;
      bottom: 0;
      left: calc(50% - 25px);
      z-index: 2;
    }
  }
</style>