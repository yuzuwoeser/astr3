<script setup lang="ts">
import { computed, ref } from 'vue';
import Wheel from './Wheel.vue';
import { chartData } from '../shared/data.js';
const offset = ref(0);
const mounted = ref(true);
const data = computed(() => chartData(offset.value));
</script>
<template>
  <main>
    <h1>Vue.js + ASTR3</h1>
    <div class="controls">
      <button @click="offset = (offset + 15) % 360">Rotate positions</button>
      <button @click="mounted = !mounted">{{ mounted ? 'Unmount chart' : 'Mount chart' }}</button>
    </div>
    <output>Sun longitude: {{ offset }}°</output>
    <Wheel v-if="mounted" :data="data" />
    <p v-else role="status">Chart unmounted.</p>
  </main>
</template>
