import { mountChart } from './embed.js';

const initial = await fetch('./chart-data.json').then((response) => {
  if (!response.ok) throw new Error('Could not load chart data.');
  return response.json();
});
const element = document.querySelector('#example');
const status = element.querySelector('[role=status]');
const toggle = document.querySelector('#toggle');
let data = initial;
let chart = mountChart(element, data);
let offset = 0;

document.querySelector('#rotate').addEventListener('click', () => {
  offset = (offset + 15) % 360;
  data = {
    ...initial,
    bodies: initial.bodies.map((body) => ({ ...body, longitude: (body.longitude + offset) % 360 })),
  };
  chart?.update(data);
  document.querySelector('#longitude').textContent = `Sun longitude: ${offset}°`;
});
toggle.addEventListener('click', () => {
  if (chart) {
    chart.dispose();
    chart = undefined;
    status.textContent = 'Chart unmounted.';
    toggle.textContent = 'Mount chart';
  } else {
    chart = mountChart(element, data);
    toggle.textContent = 'Unmount chart';
  }
});
for (const format of ['svg', 'png']) {
  document.querySelector(`#${format}`).addEventListener('click', async () => {
    if (!chart) {
      status.textContent = 'Mount the chart first.';
      return;
    }
    try {
      const blob =
        format === 'svg'
          ? new Blob([await chart.exportSvg()], { type: 'image/svg+xml' })
          : await chart.exportPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `astr3.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `${format.toUpperCase()} download ready.`;
    } catch (error) {
      status.textContent = error.message;
    }
  });
}
document.querySelector('#calculate').addEventListener('click', async () => {
  if (!chart) {
    status.textContent = 'Mount the chart first.';
    return;
  }
  const instance = chart;
  try {
    const { createAstronomyProvider } = await import('./ephemeris.js');
    const result = await createAstronomyProvider().calculate({
      utc: '2000-01-01T12:00:00Z',
      latitude: 51.5074,
      longitude: -0.1278,
    });
    if (chart !== instance) return;
    data = result;
    chart.update(data);
    document.querySelector('#longitude').textContent =
      `Sun longitude: ${data.bodies.find((body) => body.id === 'sun').longitude.toFixed(2)}°`;
    status.textContent = 'J2000 calculated locally.';
  } catch (error) {
    if (chart === instance) status.textContent = error.message;
  }
});
