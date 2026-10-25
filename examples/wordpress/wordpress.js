import { mountChart } from './embed.js';

for (const element of document.querySelectorAll('[data-astr3]')) {
  try {
    const data = JSON.parse(element.querySelector('[data-chart-input]').textContent);
    mountChart(element, data);
  } catch (error) {
    element.querySelector('[role=status]').textContent = error.message;
  }
}
