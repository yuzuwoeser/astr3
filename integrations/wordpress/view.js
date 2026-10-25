import {
  createChart,
  createTransitChart,
  createModel,
  createTransitModel,
  resolveChartTemplate,
  resolveTransitChartTemplate,
} from './assets/astr3.js';

const presets = new Map();
export async function loadPreset(name, kind) {
  if (!(kind === 'transit' ? name === 'transit' : ['midnight', 'paper'].includes(name)))
    throw new Error('Choose a preset for this chart type.');
  if (!presets.has(name)) {
    const pending = fetch(new URL(`./assets/presets/${name}.json`, import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error('Could not load chart appearance.');
        return response.json();
      })
      .catch((error) => {
        presets.delete(name);
        throw error;
      });
    presets.set(name, pending);
  }
  const template = await presets.get(name);
  return kind === 'transit'
    ? resolveTransitChartTemplate(template)
    : resolveChartTemplate(template);
}

export function validateData(data, kind) {
  if (kind === 'natal') createModel(data);
  else if (kind === 'transit') createTransitModel(data);
  else throw new Error('Choose natal or transit.');
}

class Astr3Embed extends HTMLElement {
  connectedCallback() {
    const revision = (this.revision = (this.revision ?? 0) + 1);
    this.mount(revision);
  }
  async mount(revision) {
    const status = this.querySelector('[role=status]');
    try {
      const config = JSON.parse(this.querySelector('.astr3-config').textContent);
      validateData(config.data, config.kind);
      const appearance = await loadPreset(config.preset, config.kind);
      if (!this.isConnected || revision !== this.revision) return;
      this.chart?.dispose();
      const create = config.kind === 'transit' ? createTransitChart : createChart;
      this.chart = create(this.querySelector('.astr3-chart-host'), {
        ...appearance,
        data: config.data,
        ariaLabel: config.label,
      });
      status.textContent = this.chart.error?.message ?? '';
    } catch (error) {
      if (this.isConnected && revision === this.revision && status)
        status.textContent = error.message;
    }
  }
  disconnectedCallback() {
    this.revision = (this.revision ?? 0) + 1;
    this.chart?.dispose();
    this.chart = undefined;
  }
}
if (!customElements.get('astr3-embed')) customElements.define('astr3-embed', Astr3Embed);
