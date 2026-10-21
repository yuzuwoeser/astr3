import { createWheel } from './renderer.js';
import type { WheelPresentation } from './renderer.js';
import { BODY_GLYPHS } from './model/math.js';
import { createModel } from './model/model.js';
import {
  createTransitModel,
  getTransitSelectionDetails,
  transitAspects,
  transitSelectionKey,
} from './model/transits.js';
import type {
  AspectFamily,
  BodyReference,
  ChartSide,
  TransitChartInput,
  TransitChartModel,
  TransitOrbs,
  TransitSelection,
  TransitSelectionDetails,
} from './model/transits.js';
import type { ChartInput, Selection } from './model/types.js';
import type { Chart, ChartEvents, ChartLayers, ChartOptions } from './types.js';

export interface TransitLayers extends ChartLayers {
  natalBodies: boolean;
  transitBodies: boolean;
  natalAspects: boolean;
  crossAspects: boolean;
  transitAspects: boolean;
}
export interface TransitChartOptions extends Omit<
  ChartOptions,
  'data' | 'orbs' | 'glyphs' | 'layers'
> {
  data: TransitChartInput;
  orbs?: TransitOrbs;
  glyphs?: Partial<Record<ChartSide, Readonly<Record<string, string>>>>;
  layers?: Partial<TransitLayers>;
  /** Defaults to the theme's group color. */
  transitColor?: string;
}
export interface TransitChartEvents extends Omit<ChartEvents, 'selection' | 'hover' | 'update'> {
  selection: Omit<ChartEvents['selection'], 'selection' | 'details'> & {
    selection: TransitSelection | null;
    details: TransitSelectionDetails | null;
  };
  hover: Omit<ChartEvents['hover'], 'selection' | 'details'> & {
    selection: TransitSelection | null;
    details: TransitSelectionDetails | null;
  };
  update: { model: TransitChartModel };
}
export interface TransitChart extends Omit<
  Chart,
  'model' | 'selection' | 'update' | 'select' | 'setOptions' | 'on'
> {
  readonly model: TransitChartModel;
  readonly selection: TransitSelection | null;
  update(data: TransitChartInput): void;
  updateTransit(data: ChartInput): void;
  select(selection: TransitSelection | null): void;
  setOptions(options: Partial<Omit<TransitChartOptions, 'data'>>): void;
  on<K extends keyof TransitChartEvents>(
    event: K,
    listener: (payload: TransitChartEvents[K]) => void,
  ): () => void;
}

const rawReference = (reference: TransitSelection): Selection => ({
  kind: reference.kind,
  id: transitSelectionKey(reference),
});
const publicReference = (reference: Selection): TransitSelection => {
  const [chart, kind, id] = JSON.parse(reference.id) as [AspectFamily, Selection['kind'], string];
  return { chart, kind, id } as TransitSelection;
};
const rawId = (chart: AspectFamily, kind: Selection['kind'], id: string) =>
  transitSelectionKey({ chart, kind, id } as TransitSelection);

function flatten(model: TransitChartModel): ChartInput {
  return {
    title: `${model.natal.title} + transits`,
    bodies: (['natal', 'transit'] as const).flatMap((chart) =>
      model[chart].bodies.map((body) => ({
        ...body,
        id: rawId(chart, 'body', body.id),
        name: `${chart === 'natal' ? 'Natal' : 'Transiting'} ${body.name}`,
        glyph:
          body.glyph ??
          (Object.hasOwn(BODY_GLYPHS, body.id) ? BODY_GLYPHS[body.id]! : body.name.slice(0, 2)),
      })),
    ),
    houses: model.natal.houses.map((house) => ({
      ...house,
      id: rawId('natal', 'house', house.id),
    })),
    angles: model.natal.angles,
    houseStatus: model.natal.houseStatus,
    timeUncertain: model.natal.timeUncertain,
    aspects: transitAspects(model).map((aspect) => ({
      ...aspect,
      id: rawId(aspect.chart, 'aspect', aspect.id),
      bodyIds: aspect.bodyRefs.map((ref) => rawId(ref.chart, 'body', ref.id)) as [string, string],
    })),
    groups: (['natal', 'transit'] as const).flatMap((chart) =>
      model[chart].groups.map((group) => ({
        ...group,
        id: rawId(chart, 'group', group.id),
        name: `${chart === 'natal' ? 'Natal' : 'Transit'} ${group.name}`,
        bodyIds: group.bodyIds.map((id) => rawId(chart, 'body', id)),
        aspectIds: group.aspectIds.map((id) => rawId(chart, 'aspect', id)),
      })),
    ),
    warnings: [
      ...model.natal.warnings,
      ...model.transit.warnings.map((warning) => `Transit: ${warning}`),
    ],
  };
}

function display(model: TransitChartModel, options: TransitChartOptions): WheelPresentation {
  const bodyRefs = new Map<string, BodyReference>();
  for (const chart of ['natal', 'transit'] as const)
    for (const body of model[chart].bodies)
      bodyRefs.set(rawId(chart, 'body', body.id), { chart, id: body.id });
  return {
    bodyRefs,
    aspectFamilies: new Map(
      transitAspects(model).map((aspect) => [
        rawId(aspect.chart, 'aspect', aspect.id),
        aspect.chart,
      ]),
    ),
    bodies: {
      natal: options.layers?.natalBodies ?? true,
      transit: options.layers?.transitBodies ?? true,
    },
    aspects: {
      natal: options.layers?.natalAspects ?? false,
      cross: options.layers?.crossAspects ?? true,
      transit: options.layers?.transitAspects ?? false,
    },
    transitColor: options.transitColor,
  };
}
function renderingOptions(options: TransitChartOptions): Omit<ChartOptions, 'data'> {
  const { data: _data, orbs: _orbs, glyphs, transitColor: _color, ...rest } = options;
  return {
    ...rest,
    glyphs: Object.fromEntries(
      (['natal', 'transit'] as const).flatMap((chart) =>
        Object.entries(glyphs?.[chart] ?? {}).map(([id, value]) => [
          rawId(chart, 'body', id),
          value,
        ]),
      ),
    ),
  };
}

/** A bi-wheel adapter over the same renderer, picking, and graphics lifecycle as natal charts. */
export function createTransitChart(
  container: HTMLElement,
  initialOptions: TransitChartOptions,
): TransitChart {
  let options = { ...initialOptions };
  let model = createTransitModel(options.data, options);
  let presentation = display(model, options);
  const wheel = createWheel(
    container,
    { ...renderingOptions(options), data: flatten(model) },
    () => presentation,
  );
  wheel.element.dataset.mode = 'transit';
  const legend = container.ownerDocument.createElement('div');
  legend.className = 'astr3-transit-legend';
  legend.textContent = '● Natal · ◇ Transiting';
  legend.style.cssText =
    'position:absolute;left:16px;bottom:16px;font-size:11px;color:var(--astr3-muted);pointer-events:none';
  wheel.element.querySelector('.astr3-stage')!.append(legend);
  const listeners = new Map<keyof TransitChartEvents, Set<(payload: never) => void>>();
  let applying = false,
    disposed = false;
  const emit = <K extends keyof TransitChartEvents>(event: K, payload: TransitChartEvents[K]) => {
    for (const listener of listeners.get(event) ?? []) listener(payload as never);
  };
  const details = (reference: TransitSelection | null) =>
    reference ? getTransitSelectionDetails(model, reference) : null;
  wheel.on('selection', (event) => {
    if (applying) return;
    const selection = event.selection ? publicReference(event.selection) : null;
    emit('selection', { ...event, selection, details: details(selection) });
  });
  wheel.on('hover', (event) => {
    const selection = event.selection ? publicReference(event.selection) : null;
    emit('hover', { ...event, selection, details: details(selection) });
  });
  wheel.on('error', (event) => emit('error', event));
  wheel.on('view', (event) => emit('view', event));
  function assertLive() {
    if (disposed) throw new Error('This chart has been disposed.');
  }
  function commit(nextOptions: TransitChartOptions, nextModel: TransitChartModel) {
    assertLive();
    const data = flatten(nextModel);
    createModel(data); // Validate the complete rendering projection before changing live state.
    const hadSelection = wheel.selection !== null;
    applying = true;
    try {
      wheel.setOptions(renderingOptions(nextOptions));
      options = nextOptions;
      model = nextModel;
      presentation = display(model, options);
      wheel.update(data);
    } finally {
      applying = false;
    }
    const selection = wheel.selection ? publicReference(wheel.selection) : null;
    if (hadSelection || selection)
      emit('selection', { selection, details: details(selection), source: 'update' });
    emit('update', { model });
  }
  return {
    get model() {
      return model;
    },
    get selection() {
      return wheel.selection ? publicReference(wheel.selection) : null;
    },
    get element() {
      return wheel.element;
    },
    get error() {
      return wheel.error;
    },
    update(data) {
      assertLive();
      const next = { ...options, data };
      commit(next, createTransitModel(data, next));
    },
    updateTransit(transit) {
      assertLive();
      const data = { ...options.data, transit };
      const next = createTransitModel(data, options);
      commit({ ...options, data }, Object.freeze({ ...next, natal: model.natal }));
    },
    setOptions(patch) {
      assertLive();
      const next: TransitChartOptions = {
        ...options,
        ...patch,
        layers: { ...options.layers, ...patch.layers },
        orbs: Object.fromEntries(
          (['natal', 'cross', 'transit'] as const).map((family) => [
            family,
            { ...options.orbs?.[family], ...patch.orbs?.[family] },
          ]),
        ),
        glyphs: {
          natal: { ...options.glyphs?.natal, ...patch.glyphs?.natal },
          transit: { ...options.glyphs?.transit, ...patch.glyphs?.transit },
        },
        theme: {
          ...options.theme,
          ...patch.theme,
          aspects: { ...options.theme?.aspects, ...patch.theme?.aspects },
        },
        lineStyles: { ...options.lineStyles, ...patch.lineStyles },
        selectionEffects: { ...options.selectionEffects, ...patch.selectionEffects },
      };
      commit(next, createTransitModel(next.data, next));
    },
    select(reference) {
      assertLive();
      if (reference && !details(reference))
        throw new RangeError('Unknown transit chart selection.');
      wheel.select(reference ? rawReference(reference) : null);
    },
    clearSelection() {
      wheel.clearSelection();
    },
    resetView() {
      wheel.resetView();
    },
    zoomBy(factor) {
      wheel.zoomBy(factor);
    },
    on(event, listener) {
      assertLive();
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as (payload: never) => void);
      return () => set.delete(listener as (payload: never) => void);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wheel.dispose();
      listeners.clear();
    },
  };
}
