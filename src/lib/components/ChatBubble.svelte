<script lang="ts">
  import { onMount } from 'svelte';

  type Props = {
    message: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    onExpire?: () => void;
  };

  const { message, position = 'top', onExpire }: Props = $props();

  let chatBubbleNode: HTMLDivElement | null = $state(null);
  let actualPosition = $state(position);

  onMount(() => {
    if (chatBubbleNode) {
      const rect = chatBubbleNode.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      
      if (rect.top < 0) {
        actualPosition = 'bottom';
      } else if (rect.bottom > viewport.height) {
        actualPosition = 'top';
      } else if (rect.left < 0) {
        actualPosition = 'right';
      } else if (rect.right > viewport.width) {
        actualPosition = 'left';
      } else {
        actualPosition = position;
      }
    }

    const timer = setTimeout(() => {
      if (onExpire) onExpire();
    }, 15000);

    return () => clearTimeout(timer);
  });
</script>

<div bind:this={chatBubbleNode} class="chat-bubble chat-bubble-{actualPosition}">
  {message}
</div>

<style>
  .chat-bubble {
    position: absolute;
    background: white;
    border: 2px solid #1b1b1b;
    padding: 8px 12px;
    width: 300px;
    word-wrap: break-word;
    font-size: 1rem;
    z-index: 10;
    font-family: "Jersey 15", sans-serif;
  }

  .chat-bubble-top {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    margin-bottom: 8px;

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

  .chat-bubble-bottom {
    top: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    margin-top: 8px;

    &::after {
      content: '';
      width: 20px;
      height: 20px;
      background-color: #fff;
      border: solid 2px #000;
      transform: translateY(10px) rotate(45deg);
      position: absolute;
      bottom: 100%;
      left: calc(50% - 10px);
    }

    &::before {
      content: '';
      width: 50px;
      height: 13px;
      background-color: #fff;
      position: absolute;
      top: 0;
      left: calc(50% - 25px);
      z-index: 2;
    }
  }

  .chat-bubble-left {
    right: 100%;
    top: 50%;
    transform: translateX(20px) translateY(-50%);
    margin-right: 8px;

    &::after {
      content: '';
      width: 20px;
      height: 20px;
      background-color: #fff;
      border: solid 2px #000;
      transform: translateX(-10px) rotate(45deg);
      position: absolute;
      left: 100%;
      top: calc(50% - 10px);
    }

    &::before {
      content: '';
      width: 13px;
      height: 50px;
      background-color: #fff;
      position: absolute;
      right: 0;
      top: calc(50% - 25px);
      z-index: 2;
    }
  }

  .chat-bubble-right {
    left: 100%;
    top: 50%;
    transform: translateX(-20px) translateY(-50%);
    margin-left: 8px;

    &::after {
      content: '';
      width: 20px;
      height: 20px;
      background-color: #fff;
      border: solid 2px #000;
      transform: translateX(10px) rotate(45deg);
      position: absolute;
      right: 100%;
      top: calc(50% - 10px);
    }

    &::before {
      content: '';
      width: 13px;
      height: 50px;
      background-color: #fff;
      position: absolute;
      left: 0;
      top: calc(50% - 25px);
      z-index: 2;
    }
  }
</style>