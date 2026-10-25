import {
  createChart,
  createTransitChart,
  resolveChartTemplate,
  resolveTransitChartTemplate,
  type Chart,
  type TransitChart,
} from '@yuzuwoeser/astr3';
import midnight from './midnight.json' with { type: 'json' };
import paper from './paper.json' with { type: 'json' };
import transit from './transit.json' with { type: 'json' };
import { chartData } from '../shared/data.js';
import '../shared/preview.css';

const host = document.querySelector<HTMLElement>('#wheel')!;
const choice = document.querySelector<HTMLSelectElement>('#template')!;
const status = document.querySelector<HTMLElement>('[role=status]')!;
const source = document.querySelector<HTMLElement>('#template-json')!;
const download = document.querySelector<HTMLAnchorElement>('#download-template')!;
let chart: Chart | TransitChart | undefined;

function mount(): void {
  // Every choice starts a fresh chart; templates do not patch live instances.
  dispose();
  const selected = choice.value;
  const template = selected === 'transit' ? transit : selected === 'paper' ? paper : midnight;
  const data = chartData(); // The same invented natal positions in every preview.
  chart =
    selected === 'transit'
      ? createTransitChart(host, {
          ...resolveTransitChartTemplate(template),
          data: { natal: data, transit: chartData(4) },
          ariaLabel: 'Transit study template preview',
        })
      : createChart(host, {
          ...resolveChartTemplate(template),
          data,
          ariaLabel: `${template.name} template preview`,
        });
  source.textContent = JSON.stringify(template, null, 2);
  download.href = `./${selected}.json`;
  download.download = `${selected}.json`;
  status.textContent = chart.error?.message ?? `${template.name} chart mounted.`;
}

export function dispose(): void {
  chart?.dispose();
  chart = undefined;
}

choice.addEventListener('change', mount);
document.querySelector('#export-svg')!.addEventListener('click', async () => {
  try {
    const selected = choice.value;
    const svg = await chart!.exportSvg({ size: 800 });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `astr3-${selected}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    status.textContent = 'SVG download ready.';
  } catch (error) {
    status.textContent = (error as Error).message;
  }
});
window.addEventListener('pagehide', dispose);
window.addEventListener('pageshow', () => {
  if (!chart) mount();
});
mount();
