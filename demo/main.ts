import { createChart, DARK_THEME, LIGHT_THEME, formatPosition } from '../src/index.js';
import type {
  Chart,
  ChartInput,
  ChartLayers,
  ChartWeight,
  HouseSystem,
  Selection,
  SelectionDetails,
} from '../src/index.js';
import { study } from './fixtures.js';
import './style.css';

declare global {
  interface Window {
    astr3: Chart;
  }
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const chart = createChart($('chart'), { data: study, chartWeight: 'regular' });
window.astr3 = chart;
const details = $('details');
const preset = $<HTMLSelectElement>('preset');
const houseSystem = $<HTMLSelectElement>('house-system');
let abort: AbortController | undefined;
let revision = 0;

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
function selectionButton(content: string, selection: Selection): HTMLButtonElement {
  const button = create('button', content, 'relationship');
  button.type = 'button';
  button.addEventListener('click', () => chart.select(selection));
  return button;
}
function field(label: string, value: string): HTMLElement {
  const row = create('div', '', 'detail-row');
  row.append(create('span', label), create('strong', value));
  return row;
}
function inspect(data: SelectionDetails | null): void {
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
  if ('retrograde' in data.object)
    details.append(field('Motion', data.object.retrograde ? 'Retrograde ℞' : 'Direct'));
  if ('house' in data.object)
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
    (body) => !(data.selection.kind === 'body' && body.id === data.selection.id),
  );
  if (others.length) {
    details.append(
      create(
        'h3',
        data.selection.kind === 'house'
          ? 'Occupants'
          : data.selection.kind === 'group'
            ? 'Members'
            : 'Connected planets',
      ),
    );
    for (const body of others)
      details.append(
        selectionButton(
          `${body.name} · ${formatPosition(body.longitude)}${body.house ? ` · H${body.house}` : ''}`,
          { kind: 'body', id: body.id },
        ),
      );
  }
  if (data.aspects.length && data.selection.kind !== 'aspect') {
    details.append(create('h3', 'Aspect geometry'));
    for (const aspect of data.aspects) {
      const names = aspect.bodyIds.map(
        (id) => chart.model.bodies.find((body) => body.id === id)!.name,
      );
      details.append(
        selectionButton(`${names.join(' / ')} · ${aspect.type} · ${aspect.orb.toFixed(2)}° orb`, {
          kind: 'aspect',
          id: aspect.id,
        }),
      );
    }
  }
  if (data.selection.kind !== 'group')
    for (const group of data.groups)
      details.append(selectionButton(`Explore ${group.name} ↗`, { kind: 'group', id: group.id }));
  const clear = create('button', 'Clear selection ×', 'clear-selection');
  clear.type = 'button';
  clear.addEventListener('click', () => chart.clearSelection());
  details.append(clear);
}
chart.on('selection', (event) => inspect(event.details));
chart.on('error', (error) => {
  $('calculation-status').textContent = error.message;
});
const tooltip = $('tooltip');
chart.on('hover', (event) => {
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
  chart.update(data);
  $('chart-title').textContent = data.title ?? 'Natal chart';
  $('chart-caption').textContent = caption;
  if (!chart.selection) inspect(null);
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
});
document.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((input) =>
  input.addEventListener('change', () =>
    chart.setOptions({
      layers: { [input.dataset.layer!]: input.checked } as Partial<ChartLayers>,
    }),
  ),
);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    abort?.abort();
    chart.dispose();
  }
});
chart.on('update', () => {
  $('chart-title').textContent = chart.model.title;
});
