<script lang="ts">
  import Wheel from './Wheel.svelte';
  import { chartData } from '../shared/data.js';
  let offset = $state(0);
  let mounted = $state(true);
  const data = $derived(chartData(offset));
</script>

<main>
  <h1>Svelte + ASTR3</h1>
  <div class="controls">
    <button onclick={() => (offset = (offset + 15) % 360)}>Rotate positions</button>
    <button onclick={() => (mounted = !mounted)}>{mounted ? 'Unmount chart' : 'Mount chart'}</button
    >
  </div>
  <output>Sun longitude: {offset}°</output>
  {#if mounted}<Wheel {data} />{:else}<p role="status">Chart unmounted.</p>{/if}
</main>
