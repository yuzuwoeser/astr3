import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Shape,
  ShapeGeometry,
  WebGLRenderer,
} from 'three';
import { formatPosition } from './model/math.js';
import { createModel, getSelectionDetails, hasSelection, selectionKey } from './model/model.js';
import { ASPECT_DEFINITIONS } from './model/aspects.js';
import { resolveBodyVisibility } from './body-visibility.js';
import type { ChartInput, Selection } from './model/types.js';
import type {
  Chart,
  ChartError,
  ChartExportOptions,
  ChartEvents,
  ChartLayers,
  ChartOptions,
  ChartTheme,
} from './types.js';
import type { BodyLayout, Point } from './layout.js';
import { resolveWheelGeometry } from './wheel-geometry.js';
import { createTextMeasurer } from './chart-text.js';
import { hitTest } from './picking.js';
import type { HitTarget } from './picking.js';
import { buildWheelDrawing, weightProfile } from './wheel-drawing.js';
import type { WheelPresentation, WheelLabel } from './wheel-drawing.js';
import type { ExportSnapshot } from './chart-export.js';
import { validateExportDimensions } from './export-options.js';

export type { WheelPresentation } from './wheel-drawing.js';
export { TRANSIT_WHEEL } from './wheel-geometry.js';

export const DARK_THEME: ChartTheme = {
  background: '#111c20',
  foreground: '#e9ede5',
  muted: '#93a7a8',
  ring: '#405357',
  accent: '#eacb92',
  group: '#76c7b2',
  elements: ['#d99a7d', '#afbe8c', '#d8c68b', '#8eb8cd'],
  aspects: {
    conjunction: '#dfc49a',
    sextile: '#84c0b3',
    square: '#d68c82',
    trine: '#86b9d1',
    opposition: '#cc989f',
    semisextile: '#84c0b3',
    semisquare: '#d68c82',
    quintile: '#ba9bd6',
    sesquiquadrate: '#d68c82',
    biquintile: '#ba9bd6',
    quincunx: '#84c0b3',
  },
};
export const LIGHT_THEME: ChartTheme = {
  background: '#f7f5ed',
  foreground: '#283b3f',
  muted: '#627779',
  ring: '#b7c2bd',
  accent: '#875a22',
  group: '#3f8875',
  elements: ['#ad5a3b', '#617941', '#947923', '#447c99'],
  aspects: {
    conjunction: '#886731',
    sextile: '#37836e',
    square: '#ad544d',
    trine: '#427c9b',
    opposition: '#a65e76',
    semisextile: '#37836e',
    semisquare: '#ad544d',
    quintile: '#79569b',
    sesquiquadrate: '#ad544d',
    biquintile: '#79569b',
    quincunx: '#37836e',
  },
};
const LAYERS: ChartLayers = {
  zodiac: true,
  bodies: true,
  houses: true,
  axes: true,
  aspects: true,
  groups: true,
  degrees: true,
};
const STYLE = `
.astr3{position:relative;isolation:isolate;font-family:system-ui,sans-serif;color:var(--astr3-fg);background:var(--astr3-bg);width:100%;min-width:0;border-radius:inherit}
.astr3 *{box-sizing:border-box}.astr3-stage{position:relative;width:100%;height:100%;min-height:280px;overflow:hidden;touch-action:none;border-radius:inherit;outline-offset:-3px}
.astr3-stage:focus-visible,.astr3 button:focus-visible,.astr3 summary:focus-visible{outline:2px solid var(--astr3-accent);outline-offset:3px}
.astr3 canvas{display:block;position:absolute;inset:0;width:100%;height:100%}.astr3-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.astr3-label{position:absolute;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;line-height:1.15;user-select:none;font-weight:var(--astr3-label-weight)}
.astr3-symbol{-webkit-text-stroke:var(--astr3-symbol-stroke) currentColor;paint-order:stroke fill}
.astr3-body{min-width:34px;padding:2px 3px;border-radius:7px;background:var(--astr3-bg);border:1px solid transparent;font-size:23px}
.astr3-body small{display:block;font-size:10px;letter-spacing:.01em;font-variant-numeric:tabular-nums;margin-top:2px}.astr3-body[data-active=true]{border-color:var(--astr3-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--astr3-accent) 18%,transparent)}
.astr3-body[data-compact=true]{min-width:0}.astr3-body[data-compact=true] small{display:none}
.astr3[data-layout=alternative] .astr3-body[data-compact=true]{padding:0 1px}
.astr3-clusters{position:absolute;inset:0;pointer-events:none}.astr3-clusters .astr3-cluster{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;min-width:24px;min-height:24px;padding:2px 5px;line-height:1.15;font-size:12px;font-weight:var(--astr3-label-weight);border-radius:12px}.astr3-cluster[data-active=true]{border-color:var(--astr3-accent);color:var(--astr3-accent)}
.astr3-label[data-dim=true]{opacity:var(--astr3-dim)}.astr3-controls{position:absolute;z-index:3;right:14px;bottom:14px;display:flex;gap:5px}
.astr3 button{font:inherit;color:inherit;cursor:pointer;background:var(--astr3-bg);border:1px solid var(--astr3-ring);border-radius:7px;padding:7px 10px}.astr3 button:hover{border-color:var(--astr3-accent)}
.astr3-controls button{min-width:36px;min-height:36px}.astr3 button[aria-pressed=true]{border-color:var(--astr3-accent);color:var(--astr3-accent)}
.astr3-access{border-top:1px solid var(--astr3-ring);padding:12px 16px;font-size:12px;background:var(--astr3-bg)}.astr3-access summary{cursor:pointer;color:var(--astr3-muted)}
.astr3-access ul{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:12px 0}.astr3-access button{font-size:12px;text-align:left}.astr3-access h4{margin:16px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--astr3-muted)}
.astr3-sr{position:absolute!important;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.astr3-chooser{position:absolute;z-index:5;display:grid;gap:5px;padding:9px;max-width:260px;max-height:230px;overflow:auto;background:var(--astr3-bg);border:1px solid var(--astr3-accent);border-radius:10px;box-shadow:0 8px 32px #0004}.astr3-chooser p{font-size:12px;margin:0 0 3px}
.astr3-notice{position:absolute;left:16px;top:14px;font-size:11px;max-width:70%;color:var(--astr3-muted);pointer-events:none}
@media(prefers-reduced-motion:no-preference){.astr3-body{transition:border-color .12s,box-shadow .12s}}
`;

/** Mounts a wheel. All DOM and GPU work is deferred until this call. */
export function createChart(container: HTMLElement, initialOptions: ChartOptions): Chart {
  return createWheel(container, initialOptions);
}

/** Internal shared renderer; the transit adapter supplies scoped display information. */
export function createWheel(
  container: HTMLElement,
  initialOptions: ChartOptions,
  presentation?: () => WheelPresentation,
): Chart {
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('createChart requires a browser document.');
  let options = {
    ...initialOptions,
    bodyVisibility: resolveBodyVisibility(initialOptions.bodyVisibility),
  };
  let visualWeight = weightProfile(options.chartWeight);
  let geometry = resolveWheelGeometry(options.layout, !!presentation, options.layers?.degrees);
  let model = createModel(options.data, options);
  let selected: Selection | null = null,
    hovered: Selection | null = null;
  let disposed = false,
    chartError: ChartError | null = null,
    contextLost = false;
  let zoom = 1,
    pan: Point = { x: 0, y: 0 },
    width = 640,
    height = 640,
    pixelsPerUnit = 1;
  let frame = 0;
  let targets: HitTarget[] = [];
  let chooser: HTMLElement | undefined;
  let chooserReturn: HTMLElement | undefined;
  let renderer: WebGLRenderer | undefined;
  const scene = new Scene();
  const camera = new OrthographicCamera(-330, 330, 330, -330, 0.1, 100);
  camera.position.z = 10;
  const drawing = new Group();
  // All wheel triangles share the same unlit pipeline. Vertex RGBA preserves
  // their paint order while avoiding hundreds of draw calls and shader rebuilds.
  const drawingMaterial = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    forceSinglePass: true,
    depthTest: false,
    depthWrite: false,
  });
  const drawingVertices: number[] = [];
  const drawingColors: number[] = [];
  const paintColors = new Map<string, Color>();
  scene.add(drawing);
  const listeners = new Map<keyof ChartEvents, Set<(payload: never) => void>>();
  const teardown: (() => void)[] = [];
  const root = doc.createElement('div');
  root.className = 'astr3';
  root.dataset.layout = geometry.layout;
  const style = doc.createElement('style');
  style.textContent = STYLE;
  root.append(style);
  const stage = doc.createElement('div');
  stage.className = 'astr3-stage';
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute(
    'aria-label',
    'Interactive astrology wheel. Use the chart object list for keyboard selection.',
  );
  const canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const labels = doc.createElement('div');
  labels.className = 'astr3-labels';
  labels.setAttribute('aria-hidden', 'true');
  const notice = doc.createElement('div');
  notice.className = 'astr3-notice';
  const controls = doc.createElement('div');
  controls.className = 'astr3-controls';
  const clusterLayer = doc.createElement('div');
  clusterLayer.className = 'astr3-clusters';
  stage.append(canvas, labels, clusterLayer, notice, controls);
  const clusterButtons = new Map<string, HTMLButtonElement>();
  const textMetrics = createTextMeasurer(root);
  const layoutCache = new Map<string, BodyLayout>();
  const access = doc.createElement('details');
  access.className = 'astr3-access';
  const summary = doc.createElement('summary');
  summary.textContent = 'Explore chart objects';
  access.append(summary);
  const objectList = doc.createElement('div');
  access.append(objectList);
  const announcement = doc.createElement('div');
  announcement.className = 'astr3-sr';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  root.append(stage, access, announcement);
  container.append(root);

  function emit<K extends keyof ChartEvents>(event: K, payload: ChartEvents[K]): void {
    for (const listener of listeners.get(event) ?? []) listener(payload as never);
  }
  function listen(
    target: EventTarget,
    type: string,
    callback: EventListener,
    settings?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, callback, settings);
    teardown.push(() => target.removeEventListener(type, callback, settings));
  }
  function assertLive(): void {
    if (disposed) throw new Error('This chart has been disposed.');
  }
  function clearHover(): void {
    const hadHover = hovered !== null;
    hovered = null;
    stage.style.cursor = 'grab';
    if (hadHover) emit('hover', { selection: null, details: null, x: 0, y: 0 });
  }
  function theme(): ChartTheme {
    return {
      ...DARK_THEME,
      ...options.theme,
      aspects: { ...DARK_THEME.aspects, ...options.theme?.aspects },
    };
  }
  function layers(): ChartLayers {
    return { ...LAYERS, ...options.layers };
  }
  const bodyVisible = (id: string) => options.bodyVisibility[id] !== false;
  function applyTheme(): void {
    const colors = theme();
    for (const [name, value] of Object.entries({
      bg: colors.background,
      fg: colors.foreground,
      muted: colors.muted,
      ring: colors.ring,
      accent: options.selectionEffects?.color ?? colors.accent,
      dim: String(options.selectionEffects?.dimOpacity ?? 0.22),
      'label-weight': String(visualWeight.fontWeight),
      'symbol-stroke': `${visualWeight.symbolStroke}px`,
    }))
      root.style.setProperty(`--astr3-${name}`, value);
    access.setAttribute('aria-label', options.ariaLabel ?? model.title);
    scene.background = new Color(colors.background);
  }
  function describe(selection: Selection): string {
    if (selection.kind === 'body') {
      const body = model.bodies.find((body) => body.id === selection.id)!;
      return `${body.name} · ${formatPosition(body.longitude)}${body.retrograde ? ' · retrograde' : ''}${body.house ? ` · ${presentation?.().bodyRefs.get(body.id)?.chart === 'transit' ? 'natal house' : 'house'} ${body.house}` : ''}${bodyVisible(body.id) ? '' : ' · hidden on wheel'}`;
    }
    if (selection.kind === 'aspect') {
      const aspect = model.aspects.find((aspect) => aspect.id === selection.id)!;
      const names = aspect.bodyIds.map((id) => model.bodies.find((body) => body.id === id)!.name);
      return `${names.join(' / ')} · ${ASPECT_DEFINITIONS[aspect.type].name} · orb ${aspect.orb.toFixed(2)}°`;
    }
    if (selection.kind === 'house') {
      const house = model.houses.find((house) => house.id === selection.id)!;
      return `House ${house.number} · ${formatPosition(house.longitude)}`;
    }
    return model.groups.find((group) => group.id === selection.id)!.name;
  }
  function setSelection(next: Selection | null, source: ChartEvents['selection']['source']): void {
    if (next && !hasSelection(model, next))
      throw new RangeError(`Unknown selection ${selectionKey(next)}.`);
    selected = next ? { ...next } : null;
    closeChooser();
    updatePressed();
    announcement.textContent = next ? `Selected ${describe(next)}` : 'Selection cleared';
    requestDraw();
    emit('selection', {
      selection: selected,
      details: selected ? getSelectionDetails(model, selected) : null,
      source,
    });
  }
  function updatePressed(): void {
    for (const button of objectList.querySelectorAll<HTMLButtonElement>('button[data-selection]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.selection === (selected && selectionKey(selected))),
      );
  }
  function buildAccess(): void {
    const focusedKey =
      doc.activeElement instanceof win!.HTMLElement
        ? doc.activeElement.dataset.selection
        : undefined;
    objectList.replaceChildren();
    if (model.timeUncertain || model.warnings.length) {
      const warning = doc.createElement('p');
      warning.textContent = [
        ...(model.timeUncertain
          ? ['Birth time uncertain; positions are a reference snapshot.']
          : []),
        ...model.warnings,
      ].join(' ');
      objectList.append(warning);
    }
    const p = presentation?.();
    const sections: readonly (readonly [string, Selection['kind'], readonly { id: string }[]])[] = p
      ? [
          [
            'Natal planets and points',
            'body',
            model.bodies.filter((body) => p.bodyRefs.get(body.id)?.chart === 'natal'),
          ],
          [
            'Transiting planets and points',
            'body',
            model.bodies.filter((body) => p.bodyRefs.get(body.id)?.chart === 'transit'),
          ],
          ...(['cross', 'natal', 'transit'] as const).map(
            (family) =>
              [
                family === 'cross'
                  ? 'Transit-to-natal aspects'
                  : family === 'natal'
                    ? 'Natal aspects'
                    : 'Transit-to-transit aspects',
                'aspect' as const,
                model.aspects.filter((aspect) => p.aspectFamilies.get(aspect.id) === family),
              ] as const,
          ),
          ['Natal houses', 'house', model.houses],
          ['Supplied groups', 'group', model.groups],
        ]
      : [
          ['Planets and points', 'body', model.bodies],
          ['Aspects', 'aspect', model.aspects],
          ['Houses', 'house', model.houses],
          ['Supplied groups', 'group', model.groups],
        ];
    for (const [heading, kind, objects] of sections) {
      if (!objects.length) continue;
      const h = doc.createElement('h4');
      h.textContent = heading;
      objectList.append(h);
      const ul = doc.createElement('ul');
      for (const object of objects) {
        const selection = { kind, id: object.id } as Selection;
        const li = doc.createElement('li'),
          button = doc.createElement('button');
        button.type = 'button';
        button.textContent = describe(selection);
        button.dataset.selection = selectionKey(selection);
        button.dataset.kind = kind;
        const ref = p?.bodyRefs.get(object.id);
        if (ref) {
          button.dataset.chart = ref.chart;
          button.dataset.bodyId = ref.id;
        }
        button.addEventListener('click', (event) =>
          setSelection(selection, event.detail === 0 ? 'keyboard' : 'pointer'),
        );
        li.append(button);
        ul.append(li);
      }
      objectList.append(ul);
    }
    if (!model.houses.length) {
      const p = doc.createElement('p');
      p.textContent = `Houses ${model.houseStatus}.`;
      objectList.append(p);
    }
    updatePressed();
    if (focusedKey)
      [...objectList.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.dataset.selection === focusedKey)
        ?.focus();
  }
  listen(objectList, 'keydown', ((event) => {
    const e = event as KeyboardEvent;
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const buttons = [...objectList.querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(doc.activeElement as HTMLButtonElement);
    if (index < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : (index + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) %
            buttons.length;
    buttons[next]?.focus();
  }) as EventListener);
  function control(label: string, content: string, action: () => void): void {
    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.textContent = content;
    button.addEventListener('click', action);
    controls.append(button);
  }
  control('Zoom out', '−', () => changeZoom(1 / 1.25));
  control('Zoom in', '+', () => changeZoom(1.25));
  control('Reset view', '↺', () => resetView());
  function closeChooser(): void {
    chooser?.remove();
    chooser = undefined;
    chooserReturn?.setAttribute('aria-expanded', 'false');
    chooserReturn = undefined;
  }
  function showChooser(candidates: Selection[], point: Point, source?: HTMLElement): void {
    closeChooser();
    chooser = doc.createElement('div');
    chooserReturn = source;
    source?.setAttribute('aria-expanded', 'true');
    chooser.className = 'astr3-chooser';
    chooser.setAttribute('role', 'group');
    chooser.setAttribute(
      'aria-label',
      source ? 'Clustered celestial bodies' : 'Overlapping chart objects',
    );
    chooser.style.left = `${Math.max(8, Math.min(width - 268, point.x))}px`;
    chooser.style.top = `${Math.max(8, Math.min(height - 240, point.y))}px`;
    const title = doc.createElement('p');
    title.textContent = source ? 'Choose a celestial body' : 'Choose an overlapping object';
    chooser.append(title);
    for (const selection of candidates) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = describe(selection);
      let pointerStartedHere = false;
      button.addEventListener('pointerdown', () => {
        pointerStartedHere = true;
      });
      button.addEventListener('pointercancel', () => {
        pointerStartedHere = false;
      });
      button.addEventListener('click', (event) => {
        // A touch opening the chooser can send its compatibility click to a
        // newly created button underneath it. Require a fresh pointer gesture.
        if (event.detail > 0 && !pointerStartedHere) {
          event.preventDefault();
          return;
        }
        setSelection(selection, event.detail === 0 ? 'keyboard' : 'pointer');
        stage.focus({ preventScroll: true });
      });
      chooser.append(button);
    }
    stage.append(chooser);
    chooser.querySelector('button')?.focus({ preventScroll: true });
  }
  function viewport(): void {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const extent = geometry.extent;
    const extentX = extent * Math.max(1, width / height),
      extentY = extent * Math.max(1, height / width);
    camera.left = -extentX;
    camera.right = extentX;
    camera.top = extentY;
    camera.bottom = -extentY;
    camera.zoom = zoom;
    camera.position.set(pan.x, pan.y, 10);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    pixelsPerUnit = (Math.min(width, height) / (2 * extent)) * zoom;
    if (renderer && !contextLost) {
      renderer.setPixelRatio(Math.min(win!.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    }
  }
  function clearDrawing(): void {
    for (const child of [...drawing.children]) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
      }
      drawing.remove(child);
    }
  }
  function mesh(geometry: BufferGeometry, color: string, opacity: number): void {
    let shade = paintColors.get(color);
    if (!shade) {
      shade = new Color(color);
      paintColors.set(color, shade);
    }
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    for (let i = 0; i < (indices?.count ?? positions.count); i++) {
      const index = indices ? indices.getX(i) : i;
      drawingVertices.push(positions.getX(index), positions.getY(index), positions.getZ(index));
      drawingColors.push(shade.r, shade.g, shade.b, opacity);
    }
    geometry.dispose();
  }
  function fill(points: readonly Point[], color: string, opacity: number): void {
    if (points.length < 3) return;
    const shape = new Shape();
    shape.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
    shape.closePath();
    mesh(new ShapeGeometry(shape), color, opacity);
  }
  function stroke(
    points: readonly Point[],
    color: string,
    lineWidth = 1,
    opacity = 1,
    dash?: readonly [number, number],
  ): void {
    const vertices: number[] = [];
    const thickness = lineWidth / Math.max(pixelsPerUnit, 0.01) / 2;
    let travelled = 0;
    const add = (a: Point, b: Point) => {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 1e-10) return;
      const dx = (-(b.y - a.y) / length) * thickness,
        dy = ((b.x - a.x) / length) * thickness;
      vertices.push(
        a.x + dx,
        a.y + dy,
        0,
        a.x - dx,
        a.y - dy,
        0,
        b.x + dx,
        b.y + dy,
        0,
        b.x + dx,
        b.y + dy,
        0,
        a.x - dx,
        a.y - dy,
        0,
        b.x - dx,
        b.y - dy,
        0,
      );
    };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (dash && dash[0] > 0 && dash[1] > 0) {
        const on = dash[0] / pixelsPerUnit,
          period = (dash[0] + dash[1]) / pixelsPerUnit;
        for (let t = 0; t < length;) {
          const position = (travelled + t) % period;
          const end = Math.min(length, t + (position < on ? on : period) - position + 1e-9);
          if (position < on)
            add(
              { x: a.x + ((b.x - a.x) * t) / length, y: a.y + ((b.y - a.y) * t) / length },
              { x: a.x + ((b.x - a.x) * end) / length, y: a.y + ((b.y - a.y) * end) / length },
            );
          t = end;
        }
      } else add(a, b);
      travelled += length;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    mesh(geometry, color, opacity);
  }
  function draw(): void {
    frame = 0;
    if (disposed) return;
    // ResizeObserver only requests a frame. Stage-size writes belong here,
    // outside observer delivery, to avoid resize feedback errors.
    const stageHeight = `${Math.max(280, container.getBoundingClientRect().width)}px`;
    if (stage.style.height !== stageHeight) stage.style.height = stageHeight;
    viewport();
    const font = win!.getComputedStyle(root);
    if (
      textMetrics.style(
        `${font.fontFamily}/${font.fontStyle}/${visualWeight.fontWeight}/${visualWeight.symbolStroke}/${geometry.layout}`,
      )
    )
      layoutCache.clear();
    const result = buildWheelDrawing({
      model,
      options,
      colors: theme(),
      visible: layers(),
      geometry,
      view: { width, height, pixelsPerUnit, pan },
      selected,
      hovered,
      presentation: presentation?.(),
      measure: textMetrics.measure,
      cache: layoutCache,
    });
    stage.dataset.textTier = result.textTier;
    if (result.labelMode) stage.dataset.labelMode = result.labelMode;
    else delete stage.dataset.labelMode;
    notice.textContent = chartError ? chartError.message : result.notice;
    targets = result.targets;
    clearDrawing();
    drawingVertices.length = 0;
    drawingColors.length = 0;
    paintColors.clear();
    labels.replaceChildren();
    for (const shape of result.shapes) {
      if (shape.kind === 'stroke')
        stroke(shape.points, shape.color, shape.width, shape.opacity, shape.dash);
      else if (shape.kind === 'fill') fill(shape.points, shape.color, shape.opacity);
      else {
        const disc = new CircleGeometry(shape.radius, 24);
        disc.translate(shape.center.x, shape.center.y, 0);
        mesh(disc, shape.color, shape.opacity);
      }
    }
    for (const value of result.labels) paintLabel(value);
    const activeClusters = new Set(result.badges.map((badge) => badge.id));
    for (const badge of result.badges) {
      let button = clusterButtons.get(badge.id);
      if (!button) {
        button = doc.createElement('button');
        button.type = 'button';
        button.className = 'astr3-cluster';
        button.dataset.cluster = badge.id;
        button.setAttribute('aria-haspopup', 'true');
        button.setAttribute('aria-expanded', 'false');
        const candidates: Selection[] = badge.bodyIds.map((id) => ({ kind: 'body', id }));
        button.addEventListener('click', () => {
          const rect = button!.getBoundingClientRect(),
            parent = stage.getBoundingClientRect();
          showChooser(
            candidates,
            { x: rect.x + rect.width / 2 - parent.x, y: rect.y + rect.height / 2 - parent.y },
            button,
          );
        });
        clusterButtons.set(badge.id, button);
        clusterLayer.append(button);
      }
      button.textContent = String(badge.bodyIds.length);
      button.setAttribute(
        'aria-label',
        `${badge.bodyIds.length} clustered bodies: ${badge.bodyIds.map((id) => model.bodies.find((body) => body.id === id)!.name).join(', ')}`,
      );
      button.dataset.active = String(badge.active);
      if (badge.chart) button.dataset.chart = badge.chart;
      Object.assign(button.style, {
        left: `${badge.x}px`,
        top: `${badge.y}px`,
        width: `${badge.width}px`,
        height: `${badge.height}px`,
        opacity: String(badge.opacity),
        color: badge.color,
      });
    }
    for (const [id, button] of clusterButtons)
      if (!activeClusters.has(id)) {
        if (chooserReturn === button) closeChooser();
        if (doc.activeElement === button) stage.focus({ preventScroll: true });
        button.remove();
        clusterButtons.delete(id);
      }
    if (drawingVertices.length) {
      const batch = new BufferGeometry();
      batch.setAttribute('position', new Float32BufferAttribute(drawingVertices, 3));
      batch.setAttribute('color', new Float32BufferAttribute(drawingColors, 4));
      drawing.add(new Mesh(batch, drawingMaterial));
    }
    if (renderer && !contextLost) renderer.render(scene, camera);
  }
  function paintLabel(value: WheelLabel): void {
    const element = doc.createElement('span');
    element.className = `astr3-label ${value.className ?? ''}`;
    Object.assign(element.style, {
      left: `${value.x}px`,
      top: `${value.y}px`,
      fontSize: `${value.size}px`,
      color: value.color,
      opacity: String(value.opacity),
    });
    Object.assign(element.dataset, value.dataset);
    if (value.selection) {
      element.dataset.object = selectionKey(value.selection);
      element.dataset.active = String(value.active);
    }
    if (value.body) {
      element.title = describe(value.selection!);
      const symbol = doc.createElement('span');
      symbol.className = 'astr3-symbol';
      symbol.textContent = value.text;
      element.append(symbol);
      if (value.caption) {
        const small = doc.createElement('small');
        small.textContent = value.caption;
        small.style.fontSize = `${value.captionSize}px`;
        element.append(small);
      }
    } else {
      element.textContent = value.text;
      if (value.title) element.title = value.title;
    }
    labels.append(element);
  }
  function captureExport(settings: ChartExportOptions): ExportSnapshot {
    assertLive();
    const viewMode = settings.view ?? 'full';
    if (viewMode !== 'full' && viewMode !== 'current')
      throw new RangeError('Export view must be full or current.');
    if (settings.transparent !== undefined && typeof settings.transparent !== 'boolean')
      throw new TypeError('Export transparent must be a boolean.');
    const size = settings.size ?? 1024;
    const rect = stage.getBoundingClientRect();
    const sourceWidth = viewMode === 'full' ? size : Math.max(1, rect.width || width);
    const sourceHeight = viewMode === 'full' ? size : Math.max(1, rect.height || height);
    const outputHeight = (size * sourceHeight) / sourceWidth;
    validateExportDimensions(size, outputHeight);
    const p = presentation?.();
    const colors = theme();
    return {
      model,
      options: {
        ...options,
        glyphs: { ...options.glyphs },
        bodyVisibility: { ...options.bodyVisibility },
        selectionEffects: { ...options.selectionEffects },
        lineStyles: Object.fromEntries(
          Object.entries(options.lineStyles ?? {}).map(([key, value]) => [
            key,
            { ...value, dash: value.dash ? [...value.dash] : undefined },
          ]),
        ),
      },
      colors: { ...colors, elements: [...colors.elements], aspects: { ...colors.aspects } },
      visible: layers(),
      geometry,
      view: {
        width: sourceWidth,
        height: sourceHeight,
        pixelsPerUnit:
          (Math.min(sourceWidth, sourceHeight) / (2 * geometry.extent)) *
          (viewMode === 'full' ? 1 : zoom),
        pan: viewMode === 'full' ? { x: 0, y: 0 } : { ...pan },
      },
      selected: viewMode === 'current' && selected ? { ...selected } : null,
      presentation: p
        ? {
            ...p,
            bodyRefs: new Map(p.bodyRefs),
            aspectFamilies: new Map(p.aspectFamilies),
            bodies: { ...p.bodies },
            aspects: { ...p.aspects },
          }
        : undefined,
      outputWidth: size,
      outputHeight,
      transparent: settings.transparent ?? false,
    };
  }
  function requestDraw(): void {
    if (!frame && !disposed) frame = win!.requestAnimationFrame(draw);
  }
  function emitView(): void {
    emit('view', { zoom, pan: { ...pan } });
  }
  function changeZoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0)
      throw new RangeError('Zoom factor must be positive and finite.');
    zoom = Math.max(0.6, Math.min(5, zoom * factor));
    clearHover();
    closeChooser();
    requestDraw();
    emitView();
  }
  function resetView(): void {
    zoom = 1;
    pan = { x: 0, y: 0 };
    clearHover();
    closeChooser();
    requestDraw();
    emitView();
  }
  function local(event: PointerEvent): Point {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  const pointers = new Map<number, Point>();
  let start: Point | undefined,
    previous: Point | undefined,
    previousPinch: number | undefined,
    dragged = false;
  const isControl = (event: Event) =>
    event.target instanceof win.HTMLElement && !!event.target.closest('button,.astr3-chooser');
  listen(stage, 'pointerdown', ((event) => {
    const e = event as PointerEvent;
    if (isControl(e) || e.button !== 0) return;
    clearHover();
    const point = local(e);
    pointers.set(e.pointerId, point);
    stage.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      start = point;
      previous = point;
      dragged = false;
    } else {
      dragged = true;
      previousPinch = undefined;
    }
  }) as EventListener);
  listen(stage, 'pointermove', ((event) => {
    const e = event as PointerEvent;
    if (isControl(e)) {
      clearHover();
      requestDraw();
      return;
    }
    const point = local(e);
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, point);
      if (pointers.size > 1) {
        const [a, b] = [...pointers.values()] as [Point, Point];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (previousPinch && distance > 0) changeZoom(distance / previousPinch);
        previousPinch = distance;
        dragged = true;
      } else if (previous && start) {
        if (Math.hypot(point.x - start.x, point.y - start.y) > 6) dragged = true;
        if (dragged) {
          pan.x -= (point.x - previous.x) / pixelsPerUnit;
          pan.y += (point.y - previous.y) / pixelsPerUnit;
          closeChooser();
          requestDraw();
          emitView();
        }
        previous = point;
      }
      return;
    }
    if (e.pointerType === 'touch') return;
    const next = hitTest(targets, point)[0] ?? null;
    if ((next && selectionKey(next)) !== (hovered && selectionKey(hovered))) {
      hovered = next;
      requestDraw();
    }
    stage.style.cursor = next ? 'pointer' : 'grab';
    emit('hover', {
      selection: next,
      details: next ? getSelectionDetails(model, next) : null,
      x: e.clientX,
      y: e.clientY,
    });
  }) as EventListener);
  function endPointer(e: PointerEvent, cancelled = false): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    previousPinch = undefined;
    if (!cancelled && !dragged && !pointers.size) {
      const point = local(e),
        hits = hitTest(targets, point, e.pointerType === 'touch');
      if (hits.length > 1) showChooser(hits, point);
      else setSelection(hits[0] ?? null, 'pointer');
    }
    if (!pointers.size) {
      start = undefined;
      previous = undefined;
    } else previous = [...pointers.values()][0];
  }
  listen(stage, 'pointerup', ((event) => endPointer(event as PointerEvent)) as EventListener);
  listen(stage, 'pointercancel', ((event) =>
    endPointer(event as PointerEvent, true)) as EventListener);
  listen(stage, 'lostpointercapture', ((event) => {
    const e = event as PointerEvent;
    if (pointers.has(e.pointerId)) endPointer(e, true);
  }) as EventListener);
  listen(stage, 'pointerleave', (() => {
    clearHover();
    requestDraw();
  }) as EventListener);
  listen(
    stage,
    'wheel',
    ((event) => {
      const e = event as WheelEvent;
      // Preserve the browser's own Ctrl/Cmd zoom gesture.
      if (e.ctrlKey || e.metaKey || isControl(e)) return;
      e.preventDefault();
      changeZoom(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.02 : 0.0015)));
    }) as EventListener,
    { passive: false },
  );
  listen(root, 'keydown', ((event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') {
      e.preventDefault();
      const hadChooser = !!chooser,
        returnTo = chooserReturn;
      closeChooser();
      if (!hadChooser) setSelection(null, 'keyboard');
      if (hadChooser) (returnTo?.isConnected ? returnTo : stage).focus({ preventScroll: true });
    }
    if (e.target === stage && ['+', '-', '0'].includes(e.key)) {
      e.preventDefault();
      if (e.key === '0') resetView();
      else changeZoom(e.key === '+' ? 1.25 : 1 / 1.25);
    }
  }) as EventListener);
  listen(canvas, 'webglcontextlost', ((event) => {
    event.preventDefault();
    contextLost = true;
    chartError = {
      code: 'CONTEXT_LOST',
      message: 'Chart graphics paused. The object list remains available.',
    };
    access.open = true;
    emit('error', chartError);
    requestDraw();
  }) as EventListener);
  listen(canvas, 'webglcontextrestored', (() => {
    contextLost = false;
    chartError = null;
    requestDraw();
  }) as EventListener);
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (cause) {
    chartError = {
      code: 'WEBGL_UNAVAILABLE',
      message: 'WebGL is unavailable. Explore the chart through the object list below.',
      cause,
    };
    canvas.hidden = true;
    access.open = true;
    queueMicrotask(() => {
      if (!disposed && chartError) emit('error', chartError);
    });
  }
  // A responsive square leaves the accessible list in normal document flow.
  function resize(): void {
    closeChooser();
    requestDraw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  listen(access, 'toggle', (() => resize()) as EventListener);
  if (doc.fonts)
    listen(doc.fonts, 'loadingdone', () => {
      textMetrics.reset();
      layoutCache.clear();
      requestDraw();
    });
  applyTheme();
  buildAccess();
  resize();

  return {
    get model() {
      return model;
    },
    get selection() {
      return selected ? { ...selected } : null;
    },
    get element() {
      return root;
    },
    get error() {
      return chartError;
    },
    update(data: ChartInput) {
      assertLive();
      const next = createModel(data, options);
      options = { ...options, data };
      model = next;
      clearHover();
      closeChooser();
      if (selected && !hasSelection(model, selected)) setSelection(null, 'update');
      else if (selected)
        emit('selection', {
          selection: selected,
          details: getSelectionDetails(model, selected),
          source: 'update',
        });
      applyTheme();
      buildAccess();
      requestDraw();
      emit('update', { model });
    },
    setOptions(patch) {
      assertLive();
      const nextOptions = {
        ...options,
        ...patch,
        layers: { ...options.layers, ...patch.layers },
        bodyVisibility: resolveBodyVisibility(patch.bodyVisibility, options.bodyVisibility),
        theme: {
          ...options.theme,
          ...patch.theme,
          aspects: { ...options.theme?.aspects, ...patch.theme?.aspects },
        },
        glyphs: { ...options.glyphs, ...patch.glyphs },
        orbs: { ...options.orbs, ...patch.orbs },
        enabledAspects: { ...options.enabledAspects, ...patch.enabledAspects },
        lineStyles: { ...options.lineStyles, ...patch.lineStyles },
        selectionEffects: { ...options.selectionEffects, ...patch.selectionEffects },
      };
      const nextWeight = weightProfile(nextOptions.chartWeight);
      const nextGeometry = resolveWheelGeometry(
        nextOptions.layout,
        !!presentation,
        nextOptions.layers?.degrees,
      );
      const nextModel = createModel(options.data, nextOptions);
      options = nextOptions;
      visualWeight = nextWeight;
      geometry = nextGeometry;
      root.dataset.layout = geometry.layout;
      model = nextModel;
      clearHover();
      closeChooser();
      if (selected && !hasSelection(model, selected)) setSelection(null, 'update');
      else if (selected)
        emit('selection', {
          selection: selected,
          details: getSelectionDetails(model, selected),
          source: 'update',
        });
      applyTheme();
      buildAccess();
      requestDraw();
      emit('update', { model });
    },
    select(selection) {
      assertLive();
      setSelection(selection, 'programmatic');
    },
    clearSelection() {
      assertLive();
      setSelection(null, 'programmatic');
    },
    resetView() {
      assertLive();
      resetView();
    },
    zoomBy(factor) {
      assertLive();
      changeZoom(factor);
    },
    async exportSvg(settings = {}) {
      const snapshot = captureExport(settings);
      const { renderSvg } = await import('./chart-export.js');
      return renderSvg(snapshot);
    },
    async exportPng(settings = {}) {
      const snapshot = captureExport(settings);
      const pixelRatio = settings.pixelRatio ?? 2;
      validateExportDimensions(snapshot.outputWidth, snapshot.outputHeight, pixelRatio);
      const { renderPng } = await import('./chart-export.js');
      return renderPng(snapshot, doc, pixelRatio);
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
      const failures: unknown[] = [];
      try {
        for (const listener of listeners.get('dispose') ?? []) {
          try {
            listener(undefined as never);
          } catch (cause) {
            failures.push(cause);
          }
        }
      } finally {
        if (frame) win.cancelAnimationFrame(frame);
        observer.disconnect();
        textMetrics.dispose();
        layoutCache.clear();
        clusterButtons.clear();
        for (const dispose of teardown) dispose();
        closeChooser();
        listeners.clear();
        pointers.clear();
        clearDrawing();
        drawingMaterial.dispose();
        drawingVertices.length = 0;
        drawingColors.length = 0;
        paintColors.clear();
        renderer?.dispose();
        renderer?.forceContextLoss();
        root.remove();
      }
      if (failures.length) throw failures[0];
    },
  };
}
