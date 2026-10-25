import {
  createTransitChart,
  type TransitChart,
  type TransitSelectionDetails,
} from '@yuzuwoeser/astr3';
import { chartData } from '../examples/shared/data.js';

// Invented positions, not an ephemeris or a prediction of a particular date.
function transitData(step: number) {
  return {
    bodies: [
      { id: 'moon', name: 'Moon', longitude: (60 + step * 15) % 360 },
      { id: 'mars', name: 'Mars', longitude: (270 + step * 5) % 360 },
    ],
  };
}

function startDemo(root: HTMLElement): () => void {
  const host = root.querySelector<HTMLElement>('[data-selection-wheel]')!;
  const title = root.querySelector<HTMLElement>('[data-selection-title]')!;
  const description = root.querySelector<HTMLElement>('[data-selection-description]')!;
  const relationships = root.querySelector<HTMLElement>('[data-selection-relationships]')!;
  const stepLabel = root.querySelector<HTMLElement>('[data-selection-step]')!;
  const status = root.querySelector<HTMLElement>('[data-selection-status]')!;
  let chart: TransitChart | undefined;
  let step = 0;

  function showDetails(details: TransitSelectionDetails | null): void {
    if (details) {
      const origin =
        details.selection.chart === 'natal'
          ? 'Natal'
          : details.selection.chart === 'transit'
            ? 'Transiting'
            : 'Cross-chart';
      const name =
        'name' in details.object
          ? details.object.name
          : 'type' in details.object
            ? `${details.object.type} aspect`
            : `House ${details.object.number}`;
      title.textContent = `${origin} ${name}`;
    } else title.textContent = 'Choose a planet or aspect';
    description.textContent = details
      ? 'The chart highlights the selection. Your application decides what to explain here.'
      : 'Select on the wheel, use the buttons, or open the accessible object list.';
    relationships.replaceChildren();
    for (const aspect of details?.aspects ?? []) {
      const names = aspect.bodyRefs.map((ref) => {
        const body = details!.bodies.find((body) => body.chart === ref.chart && body.id === ref.id);
        return `${ref.chart === 'natal' ? 'Natal' : 'Transiting'} ${body?.name ?? ref.id}`;
      });
      const item = document.createElement('li');
      item.textContent = `${names.join(' / ')}: ${aspect.type}`;
      relationships.append(item);
    }
    if (details && !details.aspects.length) {
      const item = document.createElement('li');
      item.textContent = 'No enabled aspects for this selection at this step.';
      relationships.append(item);
    }
  }
  function mount(): void {
    if (chart) return;
    status.textContent = '';
    chart = createTransitChart(host, {
      data: { natal: chartData(), transit: transitData(step) },
      chartWeight: 'regular',
      ariaLabel: 'Interactive natal and transit demonstration',
      theme: { background: '#111c20', accent: '#76c7b2', group: '#b5a0e8' },
    });
    chart.on('selection', ({ details }) => showDetails(details));
    chart.on('error', ({ message }) => {
      status.textContent = `${message} Use the object list or selection buttons below.`;
    });
    chart.select({ chart: 'natal', kind: 'body', id: 'sun' });
  }
  function dispose(): void {
    chart?.dispose();
    chart = undefined;
  }
  function select(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-select-body]');
    if (button && root.contains(button))
      chart?.select({ chart: 'natal', kind: 'body', id: button.dataset.selectBody! });
  }
  function nextStep(): void {
    step = (step + 1) % 24;
    chart?.updateTransit(transitData(step));
    stepLabel.textContent = `Invented transit step ${step}`;
  }
  const next = root.querySelector<HTMLButtonElement>('[data-next-transit]')!;
  root.addEventListener('click', select);
  next.addEventListener('click', nextStep);
  // Release WebGL on navigation; restore a cached page without a second canvas.
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', mount);
  mount();
  return () => {
    dispose();
    root.removeEventListener('click', select);
    next.removeEventListener('click', nextStep);
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('pageshow', mount);
  };
}

export function startSelectionDemos(): void {
  const cleanups = [...document.querySelectorAll<HTMLElement>('[data-selection-demo]')].map(
    startDemo,
  );
  if (import.meta.hot) import.meta.hot.dispose(() => cleanups.forEach((cleanup) => cleanup()));
}
