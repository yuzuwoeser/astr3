import {
  createChart,
  createTransitChart,
  DARK_THEME,
  LIGHT_THEME,
  DEFAULT_ORBS,
  formatPosition,
  getSelectionDetails,
  getTransitSelectionDetails,
} from '../src/index.js';
import type {
  Chart,
  ChartInput,
  ChartLayers,
  ChartWeight,
  HouseSystem,
  Selection,
  SelectionDetails,
  TransitChart,
  TransitSelection,
  TransitSelectionDetails,
  TransitLayers,
  AspectFamily,
  AspectType,
  TransitOrbs,
} from '../src/index.js';
import { study } from './fixtures.js';
import './style.css';
import { stepTransitTime } from './transit-time.js';
import type { TimeStep } from './transit-time.js';

declare global {
  interface Window {
    astr3: Chart;
    astr3Transit?: TransitChart;
  }
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const chart = createChart($('chart'), { data: study, chartWeight: 'regular' });
let natalData: ChartInput = study;
window.astr3 = chart;
const details = $('details');
const preset = $<HTMLSelectElement>('preset');
const houseSystem = $<HTMLSelectElement>('house-system');
let abort: AbortController | undefined;
let revision = 0;
let transitChart: TransitChart | undefined;
let transitData: ChartInput = { bodies: [] };
let transitAbort: AbortController | undefined;
let transitRevision = 0;
let transitMode = false;
let natalCaption = $('chart-caption').textContent ?? '';
const orbLimits: Required<TransitOrbs> = {
  natal: { ...DEFAULT_ORBS },
  cross: { ...DEFAULT_ORBS },
  transit: { ...DEFAULT_ORBS },
};
const transitTime = $<HTMLInputElement>('transit-utc');
transitTime.value = new Date().toISOString().slice(0, 16);

const create = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  content: string,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
};
function selectionButton(
  content: string,
  selection: Selection | TransitSelection,
): HTMLButtonElement {
  const button = create('button', content, 'relationship');
  button.type = 'button';
  button.addEventListener('click', () =>
    'chart' in selection ? transitChart?.select(selection) : chart.select(selection),
  );
  return button;
}
function field(label: string, value: string): HTMLElement {
  const row = create('div', '', 'detail-row');
  row.append(create('span', label), create('strong', value));
  return row;
}
function inspect(data: SelectionDetails | TransitSelectionDetails | null): void {
  details.replaceChildren();
  const heading = create(
    'h2',
    data
      ? data.selection.kind === 'house'
        ? `House ${(data.object as { number: number }).number}`
        : 'name' in data.object
          ? data.object.name
          : (data.object as { type: string }).type
      : 'Every point has a story.',
  );
  heading.id = 'inspector-heading';
  if (data && 'chart' in data.selection)
    heading.textContent = `${data.selection.chart === 'natal' ? 'Natal' : data.selection.chart === 'transit' ? 'Transiting' : 'Transit-to-natal'} ${heading.textContent}`;
  details.append(heading);
  if (!data) {
    details.append(
      create(
        'p',
        'Choose something on the wheel to see its position and the relationships around it.',
        'muted',
      ),
    );
    const firstGroup = chart.model.groups[0];
    if (firstGroup) {
      const button = selectionButton(`Explore ${firstGroup.name} ↗`, {
        kind: 'group',
        id: firstGroup.id,
        ...(transitMode ? { chart: 'natal' as const } : {}),
      });
      button.className = 'primary';
      details.append(button);
    }
    details.append(
      create(
        'p',
        'Tip: use “Explore chart objects” below the wheel for a keyboard-accessible view.',
        'muted small',
      ),
    );
    return;
  }
  details.append(create('span', `SELECTED ${data.selection.kind.toUpperCase()}`, 'selection-tag'));
  if ('longitude' in data.object)
    details.append(field('Position', formatPosition(data.object.longitude)));
  if (
    ('speed' in data.object && data.object.speed !== undefined) ||
    ('retrograde' in data.object && data.object.retrograde)
  )
    details.append(field('Motion', data.object.retrograde ? 'Retrograde ℞' : 'Direct'));
  if (data.object.metadata?.nodeType === 'true')
    details.append(field('Node calculation', 'True (osculating)'));
  if ('natalHouse' in data.object)
    details.append(
      field(
        'Natal house',
        data.object.natalHouse === undefined ? 'Unknown' : String(data.object.natalHouse),
      ),
    );
  else if ('house' in data.object)
    details.append(
      field('House', data.object.house === undefined ? 'Unknown' : String(data.object.house)),
    );
  if ('orb' in data.object)
    details.append(
      field('Exact angle', `${data.object.angle}°`),
      field('Separation', `${data.object.separation.toFixed(3)}°`),
      field('Orb', `${data.object.orb.toFixed(3)}°`),
    );
  if (typeof data.object.metadata?.description === 'string')
    details.append(create('p', data.object.metadata.description, 'muted'));
  const others = data.bodies.filter(
    (body) =>
      !(
        data.selection.kind === 'body' &&
        body.id === data.selection.id &&
        (!('chart' in data.selection) || ('chart' in body && body.chart === data.selection.chart))
      ),
  );
  if (others.length) {
    details.append(
      create(
        'h3',
        data.selection.kind === 'house'
          ? 'Occupants'
          : data.selection.kind === 'group'
            ? 'Members'
            : 'Connected points',
      ),
    );
    for (const body of others)
      details.append(
        selectionButton(
          `${'chart' in body ? (body.chart === 'natal' ? 'Natal ' : 'Transiting ') : ''}${body.name} · ${formatPosition(body.longitude)}${('natalHouse' in body ? body.natalHouse : body.house) ? ` · H${'natalHouse' in body ? body.natalHouse : body.house}` : ''}`,
          { kind: 'body', id: body.id, ...('chart' in body ? { chart: body.chart } : {}) },
        ),
      );
  }
  if (data.aspects.length && data.selection.kind !== 'aspect') {
    details.append(create('h3', 'Aspect geometry'));
    for (const aspect of data.aspects) {
      const names =
        'bodyRefs' in aspect
          ? aspect.bodyRefs.map(
              (ref) =>
                `${ref.chart === 'natal' ? 'Natal' : 'Transiting'} ${transitChart!.model[ref.chart].bodies.find((body) => body.id === ref.id)!.name}`,
            )
          : aspect.bodyIds.map((id) => chart.model.bodies.find((body) => body.id === id)!.name);
      details.append(
        selectionButton(`${names.join(' / ')} · ${aspect.type} · ${aspect.orb.toFixed(2)}° orb`, {
          kind: 'aspect',
          id: aspect.id,
          ...('chart' in aspect ? { chart: aspect.chart } : {}),
        }),
      );
    }
  }
  if (data.selection.kind !== 'group')
    for (const group of data.groups)
      details.append(
        selectionButton(`Explore ${group.name} ↗`, {
          kind: 'group',
          id: group.id,
          ...('chart' in group ? { chart: group.chart } : {}),
        }),
      );
  const clear = create('button', 'Clear selection ×', 'clear-selection');
  clear.type = 'button';
  clear.addEventListener('click', () => chart.clearSelection());
  details.append(clear);
}
chart.on('selection', (event) => {
  if (!transitMode) inspect(event.details);
});
chart.on('error', (error) => {
  $('calculation-status').textContent = error.message;
});
const tooltip = $('tooltip');
chart.on('hover', (event) => {
  if (transitMode) return;
  if (!event.details) {
    tooltip.hidden = true;
    return;
  }
  const object = event.details.object;
  tooltip.textContent =
    'name' in object
      ? object.name
      : 'type' in object
        ? `${object.type} · ${object.orb.toFixed(2)}° orb`
        : `House ${object.number}`;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 12, event.x + 16))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 8, event.y - 40))}px`;
});
function show(data: ChartInput, caption: string): void {
  natalData = data;
  chart.update(data);
  $('chart-title').textContent = data.title ?? 'Natal chart';
  natalCaption = caption;
  if (transitChart) transitChart.update({ natal: natalData, transit: transitData });
  updateCaptions();
  if (!transitMode && !chart.selection) inspect(null);
  tooltip.hidden = true;
}
async function calculate(): Promise<void> {
  abort?.abort();
  abort = new AbortController();
  const ownRevision = ++revision;
  const select = preset.value;
  $('calculation-status').textContent = 'Calculating in your browser…';
  try {
    const { createAstronomyProvider } = await import('../src/ephemeris/index.js');
    if (ownRevision !== revision) return;
    const localValue = $<HTMLInputElement>('utc').value;
    const utc =
      select === 'sydney'
        ? '2024-04-08T18:00:00Z'
        : select === 'custom'
          ? `${localValue}${localValue.length === 16 ? ':00' : ''}Z`
          : '2000-01-01T12:00:00Z';
    const latitude =
      select === 'sydney'
        ? -33.8688
        : select === 'custom'
          ? $<HTMLInputElement>('latitude').valueAsNumber
          : 51.5074;
    const longitude =
      select === 'sydney'
        ? 151.2093
        : select === 'custom'
          ? $<HTMLInputElement>('longitude').valueAsNumber
          : -0.1278;
    const data = await createAstronomyProvider().calculate(
      {
        utc,
        latitude,
        longitude,
        houseSystem: houseSystem.value as HouseSystem,
        timeUncertain: select === 'unknown',
      },
      { signal: abort.signal },
    );
    if (ownRevision !== revision) return;
    const title =
      select === 'sydney'
        ? 'April 2024 · Sydney'
        : select === 'unknown'
          ? 'Unknown birth time'
          : select === 'custom'
            ? 'Your natal wheel'
            : 'J2000 · London';
    show(
      { ...data, title },
      `${utc.replace('T', ' ').replace('Z', ' UTC')} · ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
    );
    $('calculation-status').textContent = data.warnings?.length
      ? data.warnings.join(' ')
      : 'Calculated locally. No data leaves your browser.';
  } catch (error) {
    if (ownRevision !== revision || (error instanceof DOMException && error.name === 'AbortError'))
      return;
    $('calculation-status').textContent =
      error instanceof Error ? error.message : 'Calculation failed.';
  }
}
function refreshPreset(): void {
  abort?.abort();
  revision++;
  $('calculation-fields').hidden = preset.value !== 'custom';
  if (preset.value === 'study') {
    show(study, 'Supplied demonstration data · not a birth chart');
    $('calculation-status').textContent = 'Supplied data. No calculation required.';
  } else if (preset.value !== 'custom') void calculate();
}
preset.addEventListener('change', refreshPreset);
houseSystem.addEventListener('change', () => {
  if (preset.value === 'study') {
    preset.value = 'j2000';
    refreshPreset();
  } else void calculate();
});
$('birth-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (preset.value === 'study') {
    preset.value = 'j2000';
    refreshPreset();
  } else void calculate();
});
$('select-pattern').addEventListener('click', () =>
  chart.select({ kind: 'group', id: 'air-grand-trine' }),
);
let light = false;
$('theme-toggle').addEventListener('click', () => {
  light = !light;
  chart.setOptions({ theme: light ? LIGHT_THEME : DARK_THEME });
  transitChart?.setOptions({ theme: light ? LIGHT_THEME : DARK_THEME });
  $('theme-toggle').setAttribute(
    'aria-label',
    light ? 'Switch to dark chart' : 'Switch to light chart',
  );
  $('theme-toggle').replaceChildren(document.createTextNode(light ? '☾ Dark' : '☼ Light'));
  document.querySelector('.wheel-panel')?.classList.toggle('light', light);
});
$<HTMLSelectElement>('chart-weight').addEventListener('change', (event) => {
  chart.setOptions({
    chartWeight: (event.currentTarget as HTMLSelectElement).value as ChartWeight,
  });
  transitChart?.setOptions({
    chartWeight: $<HTMLSelectElement>('chart-weight').value as ChartWeight,
  });
});
document.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((input) =>
  input.addEventListener('change', () => {
    const layers = { [input.dataset.layer!]: input.checked } as Partial<ChartLayers>;
    chart.setOptions({ layers });
    transitChart?.setOptions({ layers });
  }),
);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    abort?.abort();
    chart.dispose();
    transitAbort?.abort();
    transitChart?.dispose();
  }
});
chart.on('update', () => {
  if (!transitMode) $('chart-title').textContent = chart.model.title;
});

function updateCaptions(): void {
  $('chart-title').textContent = `${chart.model.title}${transitMode ? ' + transits' : ''}`;
  $('chart-caption').textContent =
    `${natalCaption}${transitMode && transitData.metadata?.utc ? ` · Transits ${transitData.metadata.utc}` : ''}`;
}
async function calculateTransit(): Promise<void> {
  transitAbort?.abort();
  transitAbort = new AbortController();
  const ownRevision = ++transitRevision;
  $('transit-status').textContent = 'Calculating transits…';
  try {
    if (!transitTime.value || !transitTime.checkValidity())
      throw new RangeError('Choose a valid transit UTC time from 1900 through 2100.');
    const { createAstronomyProvider } = await import('../src/ephemeris/index.js');
    if (ownRevision !== transitRevision) return;
    const data = await createAstronomyProvider().calculateTransits(
      { utc: `${transitTime.value}Z` },
      { signal: transitAbort.signal },
    );
    if (ownRevision !== transitRevision) return;
    transitChart!.updateTransit(data);
    transitData = data;
    $('transit-status').textContent = 'Transits calculated locally. No data leaves your browser.';
    updateCaptions();
  } catch (error) {
    if (
      ownRevision !== transitRevision ||
      (error instanceof DOMException && error.name === 'AbortError')
    )
      return;
    $('transit-status').textContent =
      error instanceof Error ? error.message : 'Transit calculation failed.';
  }
}
$('chart-view').addEventListener('change', () => {
  transitMode = $<HTMLSelectElement>('chart-view').value === 'transit';
  if (transitMode && !transitChart) {
    const layers = Object.fromEntries(
      [...document.querySelectorAll<HTMLInputElement>('[data-layer], [data-transit-layer]')].map(
        (input) => [input.dataset.layer ?? input.dataset.transitLayer, input.checked],
      ),
    );
    transitChart = createTransitChart($('transit-chart'), {
      data: { natal: natalData, transit: transitData },
      chartWeight: $<HTMLSelectElement>('chart-weight').value as ChartWeight,
      theme: light ? LIGHT_THEME : DARK_THEME,
      orbs: orbLimits,
      layers,
    });
    window.astr3Transit = transitChart;
    transitChart.on('selection', (event) => {
      if (transitMode) inspect(event.details);
    });
    transitChart.on('hover', (event) => {
      if (!transitMode || !event.details) {
        tooltip.hidden = true;
        return;
      }
      const object = event.details.object;
      tooltip.textContent = `${event.details.selection.chart === 'natal' ? 'Natal' : event.details.selection.chart === 'transit' ? 'Transiting' : 'Transit-to-natal'} ${'name' in object ? object.name : 'type' in object ? `${object.type} · ${object.orb.toFixed(2)}° orb` : `House ${object.number}`}`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 12, event.x + 16))}px`;
      tooltip.style.top = `${Math.max(8, event.y - 40)}px`;
    });
  }
  $('chart').hidden = transitMode;
  $('transit-chart').hidden = !transitMode;
  $('transit-controls').hidden = !transitMode;
  for (const option of $<HTMLSelectElement>('orb-family').options)
    option.disabled = !transitMode && option.value !== 'natal';
  $<HTMLSelectElement>('orb-family').value = transitMode ? 'cross' : 'natal';
  renderOrbInputs();
  tooltip.hidden = true;
  inspect(
    transitMode
      ? transitChart!.selection
        ? getTransitSelectionDetails(transitChart!.model, transitChart!.selection)
        : null
      : chart.selection
        ? getSelectionDetails(chart.model, chart.selection)
        : null,
  );
  updateCaptions();
  if (transitMode && !transitData.bodies.length) void calculateTransit();
});
transitTime.addEventListener('change', () => {
  void calculateTransit();
});
for (const [id, direction] of [
  ['transit-prev', -1],
  ['transit-next', 1],
] as const)
  $(id).addEventListener('click', () => {
    try {
      transitTime.value = stepTransitTime(
        `${transitTime.value}Z`,
        $<HTMLSelectElement>('transit-step').value as TimeStep,
        direction,
      ).slice(0, 16);
      void calculateTransit();
    } catch (error) {
      $('transit-status').textContent = (error as Error).message;
    }
  });
$('transit-now').addEventListener('click', () => {
  transitTime.value = new Date().toISOString().slice(0, 16);
  void calculateTransit();
});
document.querySelectorAll<HTMLInputElement>('[data-transit-layer]').forEach((input) =>
  input.addEventListener('change', () =>
    transitChart?.setOptions({
      layers: { [input.dataset.transitLayer!]: input.checked } as Partial<TransitLayers>,
    }),
  ),
);
function renderOrbInputs() {
  const family = $<HTMLSelectElement>('orb-family').value as AspectFamily;
  document.querySelectorAll<HTMLInputElement>('[data-orb]').forEach((input) => {
    input.value = String(orbLimits[family][input.dataset.orb as AspectType]);
  });
}
$('orb-family').addEventListener('change', renderOrbInputs);
document.querySelectorAll<HTMLInputElement>('[data-orb]').forEach((input) =>
  input.addEventListener('change', () => {
    if (!input.value || !input.checkValidity()) {
      $('orb-status').textContent = 'Orb limits must be numbers from 0° to 180°.';
      return;
    }
    const family = $<HTMLSelectElement>('orb-family').value as AspectFamily;
    orbLimits[family][input.dataset.orb as AspectType] = input.valueAsNumber;
    if (family === 'natal') chart.setOptions({ orbs: orbLimits.natal });
    transitChart?.setOptions({ orbs: { [family]: { ...orbLimits[family] } } });
    $('orb-status').textContent = 'Orb limits updated.';
  }),
);
