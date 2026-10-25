<script lang="ts">
  import { onMount } from 'svelte';
  import { createChart, type Chart, type ChartInput } from 'astr3';
  let { data }: { data: ChartInput } = $props();
  let host: HTMLDivElement;
  let chart: Chart | undefined;
  let status = $state('');
  onMount(() => {
    chart = createChart(host, { data });
    status = chart.error?.message ?? 'Chart mounted.';
    return () => {
      chart?.dispose();
      chart = undefined;
    };
  });
  $effect(() => {
    const next = data;
    chart?.update(next);
  });
</script>

<div bind:this={host} class="chart-host" style="width: min(100%, 640px)"></div>
<p role="status">{status}</p>
