<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createChart, type Chart, type ChartInput } from '@yuzuwoeser/astr3';
const props = defineProps<{ data: ChartInput }>();
const host = ref<HTMLDivElement>();
const status = ref('');
let chart: Chart | undefined;
onMounted(() => {
  chart = createChart(host.value!, { data: props.data });
  status.value = chart.error?.message ?? 'Chart mounted.';
});
watch(
  () => props.data,
  (data) => chart?.update(data),
);
onBeforeUnmount(() => {
  chart?.dispose();
});
</script>
<template>
  <div ref="host" class="chart-host" style="width: min(100%, 640px)"></div>
  <p role="status">{{ status }}</p>
</template>
