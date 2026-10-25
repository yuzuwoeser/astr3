import { createChart, resolveChartTemplate, type Chart } from 'astr3';
import midnight from '../examples/json-templates/midnight.json' with { type: 'json' };
import paper from '../examples/json-templates/paper.json' with { type: 'json' };
import { chartData } from '../examples/shared/data.js';

let charts: Chart[] = [];
function mount(): void {
  if (charts.length) return;
  for (const [id, template] of [
    ['midnight', midnight],
    ['paper', paper],
  ] as const) {
    const host = document.querySelector<HTMLElement>(`[data-template-preview="${id}"]`)!;
    charts.push(
      createChart(host, {
        ...resolveChartTemplate(template),
        data: chartData(),
        ariaLabel: `${template.name} template preview`,
      }),
    );
  }
}
function dispose(): void {
  for (const chart of charts) chart.dispose();
  charts = [];
}
export function startTemplatePreviews(): void {
  // Release GPU/DOM ownership on navigation and restore previews on cached Back.
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', mount);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      dispose();
      window.removeEventListener('pagehide', dispose);
      window.removeEventListener('pageshow', mount);
    });
  mount();
}
