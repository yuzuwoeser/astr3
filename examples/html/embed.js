import { createChart } from './astr3.js';

// The caller owns this instance and calls dispose before replacing the container.
export function mountChart(element, data) {
  const host = element.querySelector('.chart-host');
  const status = element.querySelector('[role=status]');
  const chart = createChart(host, { data });
  if (status) status.textContent = chart.error?.message ?? 'Chart mounted.';
  return chart;
}
