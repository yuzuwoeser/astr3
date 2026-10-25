import { mountChart } from './embed.js';

for (const element of document.querySelectorAll('[data-astr3]')) {
  const status = element.querySelector('[role=status]');
  try {
    const data = JSON.parse(element.querySelector('[data-chart-input]').textContent);
    mountChart(element, data);
  } catch (error) {
    status.textContent = error.message;
  }
}
// For partial page replacements, retain the returned chart and call dispose().
// The Rails example demonstrates this lifecycle for dynamic navigation.
