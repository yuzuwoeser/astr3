import { createChart, type Chart } from '@yuzuwoeser/astr3';
import { chartData } from '../shared/data.js';
import '../shared/preview.css';

const host = document.querySelector<HTMLElement>('#wheel')!;
const longitude = document.querySelector<HTMLOutputElement>('#longitude')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('[role=status]')!;
let offset = 0;
let chart: Chart | undefined;

function mount(): void {
  chart = createChart(host, { data: chartData(offset) });
  status.textContent = chart.error?.message ?? 'Chart mounted.';
}
mount();
document.querySelector('#rotate')!.addEventListener('click', () => {
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
export function dispose(): void {
  chart?.dispose();
  chart = undefined;
}
