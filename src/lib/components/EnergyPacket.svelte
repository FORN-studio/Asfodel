<script lang="ts">
  import type { Tables } from '$lib/database.types';

  type Props = {
    packet: Tables<'energy_packets'>;
  };

  const { packet }: Props = $props();
</script>

<style>
  .energy-packet {
    position: absolute;
    width: 1.25rem;
    height: 1.25rem;
    background: black;
    transform: translate(-50%, -50%);
  }
</style>

<div
  class="energy-packet"
  style="left: {packet.x_position}%; top: {packet.y_position}%"
  title="Food Packet"
></div>