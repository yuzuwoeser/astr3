import { createChart } from 'astr3';
import { chartData } from '../shared/data.js';
import '../shared/preview.css';

const host = document.querySelector('#wheel');
const longitude = document.querySelector('#longitude');
const toggle = document.querySelector('#toggle');
const status = document.querySelector('[role=status]');
let offset = 0;
let chart;

function mount() {
  chart = createChart(host, { data: chartData(offset) });
  status.textContent = chart.error?.message ?? 'Chart mounted.';
}
mount();
document.querySelector('#rotate').addEventListener('click', () => {
  offset = (offset + 15) % 360;
  chart?.update(chartData(offset));
  longitude.textContent = `Sun longitude: ${offset}°`;
});
toggle.addEventListener('click', () => {
  if (chart) {
    chart.dispose();
    chart = undefined;
    status.textContent = 'Chart unmounted.';
    toggle.textContent = 'Mount chart';
  } else {
    mount();
    toggle.textContent = 'Unmount chart';
  }
});
// A page owner can call this when removing the example without navigating away.
export function dispose() {
  chart?.dispose();
  chart = undefined;
}
