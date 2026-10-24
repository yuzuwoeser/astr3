import {
  createChart,
  createTransitChart,
  createTransitAnimation,
  DARK_THEME,
  LIGHT_THEME,
  DEFAULT_ORBS,
  DEFAULT_ENABLED_ASPECTS,
  ASPECT_DEFINITIONS,
  formatPosition,
  getSelectionDetails,
  getTransitSelectionDetails,
} from '../src/index.js';
import type {
  Chart,
  ChartInput,
  ChartLayers,
  ChartLayout,
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
  AspectEnabledConfig,
  TransitOrbs,
  TransitAnimation,
  TransitAnimationState,
  ChartSide,
} from '../src/index.js';
import { study } from './fixtures.js';
import './style.css';
import { stepTransitTime } from './transit-time.js';
import type { TimeStep } from './transit-time.js';

declare global {
  interface Window {
    astr3: Chart;
    astr3Transit?: TransitChart;
    astr3TransitAnimation?: TransitAnimation;
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
let transitAnimation: TransitAnimation | undefined;
let transitData: ChartInput = { bodies: [] };
let transitAbort: AbortController | undefined;
let transitRevision = 0;
let transitMode = false;
let natalCaption = $('chart-caption').textContent ?? '';
const bodyVisibility: Record<ChartSide, Record<string, boolean>> = { natal: {}, transit: {} };
let bodyControlsKey = '';
const orbLimits: Required<TransitOrbs> = {
  natal: { ...DEFAULT_ORBS },
  cross: { ...DEFAULT_ORBS },
  transit: { ...DEFAULT_ORBS },
};
const enabledAspectTypes: Record<AspectFamily, Required<AspectEnabledConfig>> = {
  natal: { ...DEFAULT_ENABLED_ASPECTS },
  cross: { ...DEFAULT_ENABLED_ASPECTS },
  transit: { ...DEFAULT_ENABLED_ASPECTS },
};
const aspectTypes = Object.keys(ASPECT_DEFINITIONS) as AspectType[];
const transitTime = $<HTMLInputElement>('transit-utc');
transitTime.value = new Date().toISOString().slice(0, 16);

const exportActions = [
  { id: 'export-svg', format: 'svg', size: 800, suffix: '' },
  { id: 'export-svg-large', format: 'svg', size: 1600, suffix: '-large' },
  { id: 'export-png', format: 'png', size: 800, suffix: '' },
] as const;
const exportButtons = exportActions.map(({ id }) => $<HTMLButtonElement>(id));
for (const { id, format, size, suffix } of exportActions) {
  const button = $<HTMLButtonElement>(id);
  button.addEventListener('click', async () => {
    if (exportButtons.some((entry) => entry.disabled)) return;
    const activeChart = transitMode ? transitChart : chart;
    if (!activeChart) return;
    const filename = `astr3-${transitMode ? 'transit' : 'natal'}${suffix}.${format}`;
    const exportName = suffix ? 'Large SVG' : format.toUpperCase();
    const status = $('export-status');
    exportButtons.forEach((entry) => (entry.disabled = true));
    status.textContent = `Preparing ${exportName}…`;
    try {
      const blob =
        format === 'svg'
          ? new Blob([await activeChart.exportSvg({ size })], { type: 'image/svg+xml' })
          : await activeChart.exportPng({ size });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `${exportName} download ready.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not export this chart.';
    } finally {
      exportButtons.forEach((entry) => (entry.disabled = false));
    }
  });
}

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
          : ASPECT_DEFINITIONS[(data.object as { type: AspectType }).type].name
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
    const firstGroup = (transitMode ? transitChart?.model.natal : chart.model)?.groups[0];
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
        selectionButton(
          `${names.join(' / ')} · ${ASPECT_DEFINITIONS[aspect.type].name} · ${aspect.orb.toFixed(2)}° orb`,
          {
            kind: 'aspect',
            id: aspect.id,
            ...('chart' in aspect ? { chart: aspect.chart } : {}),
          },
        ),
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
  clear.addEventListener('click', () => (transitMode ? transitChart : chart)?.clearSelection());
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
        ? `${ASPECT_DEFINITIONS[object.type].name} · ${object.orb.toFixed(2)}° orb`
        : `House ${object.number}`;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 12, event.x + 16))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 8, event.y - 40))}px`;
});
function show(data: ChartInput, caption: string): void {
  transitAnimation?.cancel();
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
$<HTMLSelectElement>('chart-layout').addEventListener('change', (event) => {
  const layout = (event.currentTarget as HTMLSelectElement).value as ChartLayout;
  chart.setOptions({ layout });
  transitChart?.setOptions({ layout });
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
    renderAspectLegend();
  }),
);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    abort?.abort();
    chart.dispose();
    transitAbort?.abort();
    transitAnimation?.dispose();
    transitChart?.dispose();
  }
});
chart.on('update', () => {
  if (!transitMode) $('chart-title').textContent = chart.model.title;
  renderBodyControls();
});

function setBodyVisibility(side: ChartSide, patch: Record<string, boolean>): void {
  if (side === 'natal') chart.setOptions({ bodyVisibility: patch });
  transitChart?.setOptions({ bodyVisibility: { [side]: patch } });
  bodyVisibility[side] = { ...bodyVisibility[side], ...patch };
  renderBodyControls();
}

function renderBodyControls(): void {
  const sides: ChartSide[] = transitMode ? ['natal', 'transit'] : ['natal'];
  const bodies = (side: ChartSide) =>
    side === 'natal' ? chart.model.bodies : (transitChart?.model.transit.bodies ?? []);
  const key = JSON.stringify(
    sides.map((side) => [side, bodies(side).map(({ id, name }) => [id, name])]),
  );
  const host = $('body-visibility-controls');
  if (key !== bodyControlsKey) {
    bodyControlsKey = key;
    host.replaceChildren();
    for (const side of sides) {
      const fieldset = create('fieldset', '', 'layers body-options');
      const heading = side === 'natal' ? 'Natal' : 'Transiting';
      fieldset.append(create('legend', `${heading} planets and points`));
      const presets = create('div', '', 'body-presets');
      for (const [name, visible] of [
        ['All', true],
        ['None', false],
      ] as const) {
        const button = create('button', name);
        button.type = 'button';
        button.dataset.bodyPreset = visible ? 'all' : 'none';
        button.dataset.bodyChart = side;
        button.setAttribute(
          'aria-label',
          `${visible ? 'Show' : 'Hide'} all ${heading.toLowerCase()} bodies`,
        );
        button.addEventListener('click', () =>
          setBodyVisibility(
            side,
            Object.fromEntries(bodies(side).map((body) => [body.id, visible])),
          ),
        );
        presets.append(button);
      }
      fieldset.append(presets);
      for (const body of bodies(side)) {
        const label = create('label', '');
        const input = create('input', '');
        input.type = 'checkbox';
        input.dataset.bodyChart = side;
        input.dataset.bodyId = body.id;
        input.setAttribute('aria-label', `Show ${heading} ${body.name}`);
        input.addEventListener('change', () =>
          setBodyVisibility(side, { [body.id]: input.checked }),
        );
        label.append(input, document.createTextNode(body.name));
        fieldset.append(label);
      }
      host.append(fieldset);
    }
  }
  for (const input of host.querySelectorAll<HTMLInputElement>('input'))
    input.checked =
      bodyVisibility[input.dataset.bodyChart as ChartSide][input.dataset.bodyId!] !== false;
}

function updateCaptions(): void {
  $('chart-title').textContent = `${chart.model.title}${transitMode ? ' + transits' : ''}`;
  $('chart-caption').textContent =
    `${natalCaption}${transitMode && transitData.metadata?.utc ? ` · Transits ${transitData.metadata.utc}` : ''}`;
}
async function calculateTransit(utc?: string): Promise<void> {
  transitAnimation?.cancel();
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
      { utc: utc ?? `${transitTime.value}Z` },
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
function animationState(state: TransitAnimationState): void {
  const active = ['preparing', 'playing', 'buffering', 'paused'].includes(state.status);
  $('transit-pause').hidden = !active;
  $('transit-pause').textContent = state.status === 'paused' ? 'Resume' : 'Pause';
  const progress = $<HTMLProgressElement>('transit-progress');
  progress.hidden = !active;
  if (state.status === 'preparing') progress.removeAttribute('value');
  else progress.value = state.progress;
  const messages: Partial<Record<TransitAnimationState['status'], string>> = {
    preparing: 'Preparing transit motion…',
    playing: `Animating to ${state.to} · about ${(state.durationMs / 1000).toFixed(1)} seconds of playback.`,
    buffering: 'Preparing the next transit position…',
    paused: 'Transit animation paused.',
    completed: 'Transits calculated locally. No data leaves your browser.',
  };
  if (messages[state.status]) $('transit-status').textContent = messages[state.status]!;
}
$('chart-view').addEventListener('change', () => {
  transitMode = $<HTMLSelectElement>('chart-view').value === 'transit';
  if (!transitMode) {
    transitAnimation?.cancel();
    transitAbort?.abort();
    ++transitRevision;
  }
  if (transitMode && !transitChart) {
    const layers = Object.fromEntries(
      [...document.querySelectorAll<HTMLInputElement>('[data-layer], [data-transit-layer]')].map(
        (input) => [input.dataset.layer ?? input.dataset.transitLayer, input.checked],
      ),
    );
    transitChart = createTransitChart($('transit-chart'), {
      data: { natal: natalData, transit: transitData },
      layout: $<HTMLSelectElement>('chart-layout').value as ChartLayout,
      chartWeight: $<HTMLSelectElement>('chart-weight').value as ChartWeight,
      theme: light ? LIGHT_THEME : DARK_THEME,
      orbs: orbLimits,
      enabledAspects: enabledAspectTypes,
      layers,
      bodyVisibility,
    });
    window.astr3Transit = transitChart;
    transitChart.on('update', renderBodyControls);
    transitAnimation = createTransitAnimation(transitChart, async (request, options) => {
      const { createAstronomyProvider } = await import('../src/ephemeris/index.js');
      return createAstronomyProvider().calculateTransits(request, options);
    });
    window.astr3TransitAnimation = transitAnimation;
    transitAnimation.on('state', animationState);
    transitAnimation.on('progress', ({ state, data }) => {
      transitData = data;
      transitTime.value = state.currentTime!.slice(0, 16);
      $<HTMLProgressElement>('transit-progress').value = state.progress;
      updateCaptions();
    });
    transitAnimation.on('error', ({ message }) => {
      $('transit-status').textContent = message;
    });
    transitChart.on('selection', (event) => {
      if (transitMode) inspect(event.details);
    });
    transitChart.on('hover', (event) => {
      if (!transitMode || !event.details) {
        tooltip.hidden = true;
        return;
      }
      const object = event.details.object;
      tooltip.textContent = `${event.details.selection.chart === 'natal' ? 'Natal' : event.details.selection.chart === 'transit' ? 'Transiting' : 'Transit-to-natal'} ${'name' in object ? object.name : 'type' in object ? `${ASPECT_DEFINITIONS[object.type].name} · ${object.orb.toFixed(2)}° orb` : `House ${object.number}`}`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 12, event.x + 16))}px`;
      tooltip.style.top = `${Math.max(8, event.y - 40)}px`;
    });
  }
  $('chart').hidden = transitMode;
  $('transit-chart').hidden = !transitMode;
  $('transit-controls').hidden = !transitMode;
  renderBodyControls();
  for (const option of $<HTMLSelectElement>('orb-family').options)
    option.disabled = !transitMode && option.value !== 'natal';
  $<HTMLSelectElement>('orb-family').value = transitMode ? 'cross' : 'natal';
  renderOrbInputs();
  renderAspectLegend();
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
      const from = transitData.metadata?.utc as string | undefined;
      const animate = $<HTMLInputElement>('transit-animate').checked && from && transitAnimation;
      const to = stepTransitTime(
        animate ? from : `${transitTime.value}Z`,
        $<HTMLSelectElement>('transit-step').value as TimeStep,
        direction,
      );
      if (animate) {
        transitAbort?.abort();
        ++transitRevision;
        void transitAnimation!.play({ from, to }).catch(() => {}); // Reported by the error event.
      } else {
        transitTime.value = to.slice(0, 16);
        void calculateTransit();
      }
    } catch (error) {
      $('transit-status').textContent = (error as Error).message;
    }
  });
$('transit-pause').addEventListener('click', () => {
  if (transitAnimation?.state.status === 'paused') transitAnimation.resume();
  else transitAnimation?.pause();
});
$('transit-animate').addEventListener('change', () => {
  if ($<HTMLInputElement>('transit-animate').checked) return;
  const state = transitAnimation?.state;
  if (state?.to && ['preparing', 'playing', 'buffering', 'paused'].includes(state.status)) {
    transitTime.value = state.to.slice(0, 16);
    void calculateTransit(state.to);
  }
});
$('transit-now').addEventListener('click', () => {
  transitTime.value = new Date().toISOString().slice(0, 16);
  void calculateTransit();
});
document.querySelectorAll<HTMLInputElement>('[data-transit-layer]').forEach((input) =>
  input.addEventListener('change', () => {
    transitChart?.setOptions({
      layers: { [input.dataset.transitLayer!]: input.checked } as Partial<TransitLayers>,
    });
    renderAspectLegend();
  }),
);

function renderAspectLegend() {
  const legend = $('aspect-legend');
  legend.replaceChildren(create('span', 'ENABLED ASPECTS', 'eyebrow'));
  const master = document.querySelector<HTMLInputElement>('[data-layer=aspects]')!.checked;
  const families: AspectFamily[] = !master
    ? []
    : transitMode
      ? (['natal', 'cross', 'transit'] as const).filter(
          (family) =>
            document.querySelector<HTMLInputElement>(`[data-transit-layer=${family}Aspects]`)!
              .checked,
        )
      : ['natal'];
  const types = aspectTypes.filter((type) =>
    families.some((family) => enabledAspectTypes[family][type]),
  );
  for (const type of types) {
    const definition = ASPECT_DEFINITIONS[type];
    const entry = create('span', '');
    entry.dataset.aspectType = type;
    const line = create('i', '');
    line.setAttribute('aria-hidden', 'true');
    line.style.borderTop = `2px ${definition.major ? 'solid' : 'dashed'} ${LIGHT_THEME.aspects[type]}`;
    entry.append(
      line,
      document.createTextNode(definition.name),
      create('small', `${definition.angle}°`),
    );
    legend.append(entry);
  }
  if (!types.length)
    legend.append(
      create('span', master ? 'No enabled aspects in visible families.' : 'Aspect layer hidden.'),
    );
}

function applyEnabledAspects(family: AspectFamily, patch: AspectEnabledConfig) {
  try {
    if (family === 'natal') chart.setOptions({ enabledAspects: patch });
    transitChart?.setOptions({ enabledAspects: { [family]: patch } });
    Object.assign(enabledAspectTypes[family], patch);
    const active = transitMode ? transitChart! : chart;
    inspect(
      active.selection
        ? transitMode
          ? getTransitSelectionDetails(transitChart!.model, transitChart!.selection!)
          : getSelectionDetails(chart.model, chart.selection!)
        : null,
    );
    $('orb-status').textContent = 'Aspects updated.';
  } catch (error) {
    $('orb-status').textContent = (error as Error).message;
  }
  renderOrbInputs();
  renderAspectLegend();
}

for (const major of [true, false]) {
  const fieldset = create('fieldset', '', 'aspect-options');
  fieldset.append(create('legend', major ? 'Major aspects' : 'Minor aspects'));
  for (const type of aspectTypes.filter((type) => ASPECT_DEFINITIONS[type].major === major)) {
    const definition = ASPECT_DEFINITIONS[type];
    const row = create('div', '', 'aspect-row');
    row.dataset.aspect = type;
    const toggleLabel = create('label', '', 'aspect-toggle');
    const checkbox = create('input', '');
    checkbox.type = 'checkbox';
    checkbox.dataset.aspectEnabled = type;
    checkbox.setAttribute('aria-label', `Enable ${definition.name}`);
    toggleLabel.append(
      checkbox,
      create('span', definition.name, 'aspect-name'),
      create('small', `${definition.angle}°`),
    );
    const orbLabel = create('label', '', 'aspect-orb');
    const input = create('input', '');
    input.type = 'number';
    input.min = '0';
    input.max = '180';
    input.step = '0.1';
    input.dataset.orb = type;
    input.setAttribute('aria-label', `${definition.name} orb in degrees`);
    orbLabel.append(input, document.createTextNode('°'));
    row.append(toggleLabel, orbLabel);
    fieldset.append(row);
    checkbox.addEventListener('change', () =>
      applyEnabledAspects($<HTMLSelectElement>('orb-family').value as AspectFamily, {
        [type]: checkbox.checked,
      }),
    );
    input.addEventListener('change', () => {
      if (!input.value || !input.checkValidity()) {
        $('orb-status').textContent = 'Orb limits must be numbers from 0° to 180°.';
        return;
      }
      const family = $<HTMLSelectElement>('orb-family').value as AspectFamily;
      try {
        const patch = { [type]: input.valueAsNumber };
        if (family === 'natal') chart.setOptions({ orbs: patch });
        transitChart?.setOptions({ orbs: { [family]: patch } });
        Object.assign(orbLimits[family], patch);
        $('orb-status').textContent = 'Orb limits updated.';
      } catch (error) {
        renderOrbInputs();
        $('orb-status').textContent = (error as Error).message;
      }
    });
  }
  $('aspect-controls').append(fieldset);
}

function renderOrbInputs() {
  const family = $<HTMLSelectElement>('orb-family').value as AspectFamily;
  for (const type of aspectTypes) {
    const enabled = enabledAspectTypes[family][type];
    const row = document.querySelector<HTMLElement>(`[data-aspect=${type}]`)!;
    row.dataset.enabled = String(enabled);
    row.querySelector<HTMLInputElement>('[data-aspect-enabled]')!.checked = enabled;
    const input = row.querySelector<HTMLInputElement>('[data-orb]')!;
    input.value = String(orbLimits[family][type]);
    input.disabled = !enabled;
  }
}
$('orb-family').addEventListener('change', renderOrbInputs);
document.querySelectorAll<HTMLButtonElement>('[data-aspect-preset]').forEach((button) =>
  button.addEventListener('click', () => {
    const family = $<HTMLSelectElement>('orb-family').value as AspectFamily;
    const preset = button.dataset.aspectPreset;
    applyEnabledAspects(
      family,
      Object.fromEntries(
        aspectTypes.map((type) => [
          type,
          preset === 'all' || (preset === 'major' && ASPECT_DEFINITIONS[type].major),
        ]),
      ),
    );
  }),
);
renderOrbInputs();
renderAspectLegend();
renderBodyControls();
