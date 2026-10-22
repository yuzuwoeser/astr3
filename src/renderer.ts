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
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  BODY_GLYPHS,
  SIGN_GLYPHS,
  SIGNS,
  formatPosition,
  normalize,
  signedDistance,
} from './model/math.js';
import { createModel, getSelectionDetails, hasSelection, selectionKey } from './model/model.js';
import type { Body, ChartInput, Selection } from './model/types.js';
import type {
  Chart,
  ChartError,
  ChartEvents,
  ChartLayers,
  ChartOptions,
  ChartTheme,
  ChartWeight,
  LineStyle,
} from './types.js';
import { WHEEL, aspectPath, boxesOverlap, convexHull, layoutBodies, polar } from './layout.js';
import type { Box, Point } from './layout.js';
import { hitTest } from './picking.js';
import type { HitTarget } from './picking.js';
import type { AspectFamily, BodyReference, ChartSide } from './model/transits.js';

export interface WheelPresentation {
  bodyRefs: ReadonlyMap<string, BodyReference>;
  aspectFamilies: ReadonlyMap<string, AspectFamily>;
  bodies: Record<ChartSide, boolean>;
  aspects: Record<AspectFamily, boolean>;
  transitColor?: string;
}
export const TRANSIT_WHEEL = {
  extent: 464,
  inner: 318,
  outer: 422,
  marker: WHEEL.outer + 12,
  preferred: 350,
  axis: 440,
} as const;

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
const WEIGHT_PROFILES = {
  light: { strokeMultiplier: 1, fontWeight: 400, symbolStroke: 0 },
  regular: { strokeMultiplier: 1.5, fontWeight: 500, symbolStroke: 0.15 },
  bold: { strokeMultiplier: 2, fontWeight: 650, symbolStroke: 0.3 },
} as const;

function weightProfile(weight: ChartWeight = 'light') {
  if (!Object.hasOwn(WEIGHT_PROFILES, weight)) {
    throw new RangeError('chartWeight must be light, regular, or bold.');
  }
  return WEIGHT_PROFILES[weight];
}
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
  let options = { ...initialOptions };
  let visualWeight = weightProfile(options.chartWeight);
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
  let renderer: WebGLRenderer | undefined;
  const scene = new Scene();
  const camera = new OrthographicCamera(-330, 330, 330, -330, 0.1, 100);
  camera.position.z = 10;
  const drawing = new Group();
  scene.add(drawing);
  const listeners = new Map<keyof ChartEvents, Set<(payload: never) => void>>();
  const teardown: (() => void)[] = [];
  const root = doc.createElement('div');
  root.className = 'astr3';
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
  stage.append(canvas, labels, notice, controls);
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
  function glyph(body: Body): string {
    if (options.glyphs && Object.hasOwn(options.glyphs, body.id)) return options.glyphs[body.id]!;
    return (
      body.glyph ??
      (Object.hasOwn(BODY_GLYPHS, body.id) ? BODY_GLYPHS[body.id]! : body.name.slice(0, 2))
    );
  }
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
      return `${body.name} · ${formatPosition(body.longitude)}${body.retrograde ? ' · retrograde' : ''}${body.house ? ` · ${presentation?.().bodyRefs.get(body.id)?.chart === 'transit' ? 'natal house' : 'house'} ${body.house}` : ''}`;
    }
    if (selection.kind === 'aspect') {
      const aspect = model.aspects.find((aspect) => aspect.id === selection.id)!;
      const names = aspect.bodyIds.map((id) => model.bodies.find((body) => body.id === id)!.name);
      return `${names.join(' / ')} · ${aspect.type} · orb ${aspect.orb.toFixed(2)}°`;
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
  }
  function showChooser(candidates: Selection[], point: Point): void {
    closeChooser();
    chooser = doc.createElement('div');
    chooser.className = 'astr3-chooser';
    chooser.setAttribute('role', 'group');
    chooser.setAttribute('aria-label', 'Overlapping chart objects');
    chooser.style.left = `${Math.max(8, Math.min(width - 268, point.x))}px`;
    chooser.style.top = `${Math.max(8, Math.min(height - 240, point.y))}px`;
    const title = doc.createElement('p');
    title.textContent = 'Choose an overlapping object';
    chooser.append(title);
    for (const selection of candidates) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = describe(selection);
      button.addEventListener('click', (event) => {
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
    const extent = presentation ? TRANSIT_WHEEL.extent : WHEEL.extent;
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
  function project(point: Point): Point {
    const vector = new Vector3(point.x, point.y, 0).project(camera);
    return { x: ((vector.x + 1) / 2) * width, y: ((1 - vector.y) / 2) * height };
  }
  function clearDrawing(): void {
    for (const child of [...drawing.children]) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material])
          material.dispose();
      }
      drawing.remove(child);
    }
  }
  let order = 0;
  function mesh(geometry: BufferGeometry, color: string, opacity: number): void {
    const object = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color,
        opacity,
        transparent: true,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    object.renderOrder = order++;
    drawing.add(object);
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
    const thickness =
      Math.max(0.25, lineWidth * visualWeight.strokeMultiplier) / Math.max(pixelsPerUnit, 0.01) / 2;
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
  function circle(
    radius: number,
    color: string,
    opacity = 1,
    center: Point = { x: 0, y: 0 },
    lineWidth = 1,
  ): void {
    stroke(
      Array.from({ length: 181 }, (_, i) => ({
        x: Math.cos((i * Math.PI) / 90) * radius + center.x,
        y: Math.sin((i * Math.PI) / 90) * radius + center.y,
      })),
      color,
      lineWidth,
      opacity,
    );
  }
  function label(
    point: Point,
    text: string,
    size: number,
    color: string,
    className = '',
    selection?: Selection,
  ): HTMLElement {
    const element = doc.createElement('span');
    element.className = `astr3-label ${className}`;
    element.textContent = text;
    const screen = project(point);
    element.style.left = `${screen.x}px`;
    element.style.top = `${screen.y}px`;
    element.style.fontSize = `${size}px`;
    element.style.color = color;
    if (selection) {
      element.dataset.object = selectionKey(selection);
      element.dataset.active = String(
        selected?.kind === selection.kind && selected.id === selection.id,
      );
    }
    labels.append(element);
    return element;
  }

  function draw(): void {
    frame = 0;
    if (disposed) return;
    viewport();
    clearDrawing();
    labels.replaceChildren();
    targets = [];
    order = 0;
    const colors = theme(),
      visible = layers(),
      asc = model.angles.ascendant ?? 0;
    const p = presentation?.();
    const isTransit = (id: string) => p?.bodyRefs.get(id)?.chart === 'transit';
    const transitColor = p?.transitColor ?? colors.group;
    const axisRadius = p ? TRANSIT_WHEEL.axis : visible.degrees ? 318 : 305;
    const shownBodies = model.bodies.filter(
      (body) => !p || p.bodies[isTransit(body.id) ? 'transit' : 'natal'],
    );
    const primary = selected ?? hovered;
    const details = primary ? getSelectionDetails(model, primary) : null;
    const activeBodies = new Set(details?.bodies.map((body) => body.id));
    const activeAspects = new Set(details?.aspects.map((aspect) => aspect.id));
    const bodyAnchors = new Map(
      model.bodies.map((body) => [body.id, polar(body.longitude, WHEEL.house, asc)]),
    );
    const dim = options.selectionEffects?.dimOpacity ?? 0.22;
    const opacity = (active: boolean) =>
      !primary || active || options.dimUnrelated === false ? 1 : dim;
    const accent = options.selectionEffects?.color ?? colors.accent;
    const activeWidth = options.selectionEffects?.lineWidth ?? 2.5;
    const reservedLabels: { element: HTMLElement; point: Point }[] = [];
    const houseNumberSpace: Box[] = p
      ? [...bodyAnchors.values()].map((point) => ({
          ...point,
          width: 9 / pixelsPerUnit,
          height: 9 / pixelsPerUnit,
        }))
      : [];
    notice.textContent = chartError
      ? chartError.message
      : model.timeUncertain
        ? 'REFERENCE SNAPSHOT · birth time uncertain'
        : model.houseStatus === 'unavailable'
          ? 'Houses unavailable · choose another system'
          : model.houseStatus === 'unknown'
            ? 'Houses unknown'
            : '';

    if (visible.zodiac) {
      circle(WHEEL.outer, colors.ring);
      circle(WHEEL.zodiacInner, colors.ring);
      for (let sign = 0; sign < 12; sign++) {
        const color = colors.elements[sign % 4]!;
        stroke(
          [polar(sign * 30, WHEEL.zodiacInner, asc), polar(sign * 30, WHEEL.outer, asc)],
          colors.ring,
        );
        label(
          polar(sign * 30 + 15, 269, asc),
          SIGN_GLYPHS[sign]!,
          Math.max(16, Math.min(25, pixelsPerUnit * 31)),
          color,
          'astr3-symbol',
        ).title = SIGNS[sign]!;
      }
    }
    if (visible.degrees)
      for (let degree = 0; degree < 360; degree++) {
        const major = degree % 10 === 0,
          minor = degree % 5 === 0;
        stroke(
          [polar(degree, 250, asc), polar(degree, major ? 242 : minor ? 245 : 248, asc)],
          colors.muted,
          0.65,
          major ? 0.9 : 0.35,
        );
        stroke(
          [
            polar(degree, WHEEL.outer + 2, asc),
            polar(degree, WHEEL.outer + (major ? 10 : minor ? 7 : 4), asc),
          ],
          colors.muted,
          0.65,
          major ? 0.9 : 0.35,
        );
        if (major && pixelsPerUnit > 0.65) {
          for (const [side, radius] of [
            ['inside', 232],
            ['outside', WHEEL.outer + 30],
          ] as const) {
            const point = polar(degree, radius, asc);
            // Leave room for axis captions where they meet the outside scale.
            if (
              side === 'outside' &&
              visible.axes &&
              [model.angles.ascendant, model.angles.midheaven].some(
                (value) =>
                  value !== undefined &&
                  [value, value + 180].some((angle) => {
                    const axis = polar(angle, axisRadius, asc);
                    return Math.hypot(axis.x - point.x, axis.y - point.y) < 16 / pixelsPerUnit;
                  }),
              )
            )
              continue;
            const element = label(point, String(degree % 30), 8, colors.muted, 'astr3-degree');
            element.dataset.scale = side;
            reservedLabels.push({ element, point });
          }
        }
      }
    if (visible.houses && model.houses.length) {
      circle(WHEEL.house, colors.ring, 0.6);
      for (let i = 0; i < model.houses.length; i++) {
        const house = model.houses[i]!,
          next = model.houses[(i + 1) % 12]!;
        const span = normalize(next.longitude - house.longitude);
        const selection: Selection = { kind: 'house', id: house.id };
        const steps = Math.max(3, Math.ceil(span / 3));
        const polygon = [
          { x: 0, y: 0 },
          ...Array.from({ length: steps + 1 }, (_, j) =>
            polar(house.longitude + (span * j) / steps, WHEEL.marker - 2, asc),
          ),
        ];
        const active = primary?.kind === 'house' && primary.id === house.id;
        if (active) fill(polygon, accent, 0.08);
        stroke(
          [polar(house.longitude, 0, asc), polar(house.longitude, WHEEL.marker - 2, asc)],
          active ? accent : colors.ring,
          active ? 1.6 : 0.75,
          0.65,
        );
        const houseRadius = p
          ? Math.max(
              20,
              Math.min(WHEEL.houseLabel, WHEEL.house - 10 / Math.max(pixelsPerUnit, 0.05)),
            )
          : WHEEL.houseLabel;
        let labelPoint = polar(house.longitude + span / 2, houseRadius, asc);
        const houseLabel = label(
          labelPoint,
          String(house.number),
          p && pixelsPerUnit < 0.65 ? 8 : 10,
          active ? accent : colors.muted,
          '',
          selection,
        );
        if (p) {
          const rect = houseLabel.getBoundingClientRect();
          const size = { width: rect.width / pixelsPerUnit, height: rect.height / pixelsPerUnit };
          // Keep the number within its own sector; stagger it inward when the
          // compact bi-wheel makes neighboring house labels or anchors collide.
          for (
            let radius = houseRadius;
            radius >= 5 / pixelsPerUnit;
            radius -= (rect.height + 3) / pixelsPerUnit
          ) {
            const candidate = polar(house.longitude + span / 2, radius, asc);
            const box = { ...candidate, ...size };
            if (!houseNumberSpace.some((other) => boxesOverlap(box, other, 2 / pixelsPerUnit))) {
              labelPoint = candidate;
              break;
            }
          }
          houseNumberSpace.push({ ...labelPoint, ...size });
          const position = project(labelPoint);
          houseLabel.style.left = `${position.x}px`;
          houseLabel.style.top = `${position.y}px`;
        }
        reservedLabels.push({ element: houseLabel, point: labelPoint });
        targets.push({ selection, priority: 3, shape: 'polygon', points: polygon.map(project) });
      }
    }
    if (visible.axes)
      for (const [id, name, value] of [
        ['ascendant', 'AC', model.angles.ascendant],
        ['midheaven', 'MC', model.angles.midheaven],
      ] as const) {
        if (value === undefined) continue;
        const body = model.bodies.find((body) => {
          const ref = p?.bodyRefs.get(body.id);
          return (
            (p ? ref?.chart === 'natal' && ref.id === id : body.id === id) &&
            Math.abs(signedDistance(body.longitude, value)) < 1e-8
          );
        });
        const active = !!body && activeBodies.has(body.id);
        stroke(
          [polar(value, axisRadius - 4, asc), polar(value + 180, axisRadius - 4, asc)],
          active ? accent : colors.muted,
          active ? activeWidth : 1,
          body ? opacity(active) * 0.55 : 0.55,
          [5, 5],
        );
        const point = polar(value, axisRadius, asc);
        const selection: Selection | undefined = body ? { kind: 'body', id: body.id } : undefined;
        const element = label(point, name, 10, accent, 'astr3-axis', selection);
        element.dataset.axis = id;
        element.style.opacity = String(body ? opacity(active) : 1);
        if (selection) {
          const rect = element.getBoundingClientRect();
          targets.push({
            selection,
            priority: 0,
            shape: 'box',
            box: { ...project(point), width: rect.width, height: rect.height },
          });
        }
        reservedLabels.push({ element, point });
        const opposite = polar(value + 180, axisRadius, asc);
        reservedLabels.push({
          element: label(opposite, name === 'AC' ? 'DC' : 'IC', 10, colors.muted),
          point: opposite,
        });
      }
    if (visible.groups)
      for (const group of model.groups) {
        const ids = new Set(group.bodyIds);
        for (const id of group.aspectIds)
          for (const bodyId of model.aspects.find((aspect) => aspect.id === id)!.bodyIds)
            ids.add(bodyId);
        const polygon = convexHull(
          model.bodies.filter((body) => ids.has(body.id)).map((body) => bodyAnchors.get(body.id)!),
        );
        const active = primary?.kind === 'group' && primary.id === group.id;
        if (polygon.length >= 3) {
          fill(polygon, colors.group, active ? 0.17 : 0.045);
          if (active) stroke([...polygon, polygon[0]!], colors.group, activeWidth, 0.9);
          targets.push({
            selection: { kind: 'group', id: group.id },
            priority: 2,
            shape: 'polygon',
            points: polygon.map(project),
          });
        }
      }
    if (visible.aspects)
      for (const aspect of model.aspects) {
        if (p && !p.aspects[p.aspectFamilies.get(aspect.id)!]) continue;
        const active = !!primary && activeAspects.has(aspect.id);
        const style: LineStyle = options.lineStyles?.[aspect.type] ?? {};
        const color = active ? accent : colors.aspects[aspect.type];
        const line = aspectPath(
          bodyAnchors.get(aspect.bodyIds[0])!,
          bodyAnchors.get(aspect.bodyIds[1])!,
          pixelsPerUnit,
          p ? 24 : 8,
        );
        stroke(
          line,
          color,
          active ? activeWidth : (style.width ?? 1.1),
          opacity(activeAspects.has(aspect.id)) * 0.85,
          style.dash,
        );
        for (let i = 1; i < line.length; i++)
          targets.push({
            selection: { kind: 'aspect', id: aspect.id },
            priority: 1,
            shape: 'line',
            a: project(line[i - 1]!),
            b: project(line[i]!),
          });
      }
    if (visible.bodies) {
      const fontSize = Math.max(18, Math.min(25, pixelsPerUnit * 32));
      const elements = new Map<string, HTMLElement>();
      // Batch DOM writes before measuring. Real glyph/degree dimensions also
      // cover custom fonts, retrograde labels, and OS symbol substitutions.
      for (const body of shownBodies) {
        const active = activeBodies.has(body.id);
        const element = label(
          { x: 0, y: 0 },
          '',
          fontSize,
          active ? accent : isTransit(body.id) ? transitColor : colors.foreground,
          'astr3-body',
          { kind: 'body', id: body.id },
        );
        const ref = p?.bodyRefs.get(body.id);
        if (ref) {
          element.dataset.chart = ref.chart;
          element.dataset.bodyId = ref.id;
        }
        const symbol = doc.createElement('span');
        symbol.className = 'astr3-symbol';
        symbol.textContent = glyph(body);
        element.append(symbol);
        element.dataset.dim = String(opacity(active) < 1);
        element.title = describe({ kind: 'body', id: body.id });
        if (visible.degrees || body.retrograde) {
          const degree = doc.createElement('small');
          degree.textContent = `${visible.degrees ? formatPosition(body.longitude).split(' ')[0] : ''}${body.retrograde ? ' ℞' : ''}`;
          element.append(degree);
        }
        elements.set(body.id, element);
      }
      const measureElements = () =>
        new Map(
          [...elements].map(([id, element]) => {
            const rect = element.getBoundingClientRect();
            return [
              id,
              {
                width: rect.width + visualWeight.symbolStroke,
                height: rect.height + visualWeight.symbolStroke,
              },
            ];
          }),
        );
      const fullSizes = measureElements();
      for (const element of elements.values()) element.dataset.compact = 'true';
      const compactSizes = measureElements();
      const reservedBoxes = reservedLabels.map(({ element, point }) => {
        const rect = element.getBoundingClientRect();
        return { ...point, width: rect.width / pixelsPerUnit, height: rect.height / pixelsPerUnit };
      });
      const placeBand = (bodies: readonly Body[], transit = false) =>
        layoutBodies(
          bodies,
          asc,
          pixelsPerUnit,
          (body, compact) => (compact ? compactSizes : fullSizes).get(body.id)!,
          reservedBoxes,
          transit
            ? { ...TRANSIT_WHEEL, marker: TRANSIT_WHEEL.marker, preferred: TRANSIT_WHEEL.preferred }
            : undefined,
        );
      const natalLayout = placeBand(shownBodies.filter((body) => !isTransit(body.id)));
      const transitLayout = placeBand(
        shownBodies.filter((body) => isTransit(body.id)),
        true,
      );
      const layout = {
        placements: [...natalLayout.placements, ...transitLayout.placements],
        compact: natalLayout.compact || transitLayout.compact,
      };
      const placements = new Map(layout.placements.map((placement) => [placement.id, placement]));
      const overflow = placements.size < shownBodies.length;
      stage.dataset.labelMode = overflow ? 'markers' : layout.compact ? 'compact' : 'full';
      if (overflow)
        notice.textContent = [notice.textContent, 'Zoom in to reveal planet symbols']
          .filter(Boolean)
          .join(' · ');
      for (const body of shownBodies) {
        const placement = placements.get(body.id);
        const markerRadius = isTransit(body.id) ? TRANSIT_WHEEL.marker : WHEEL.marker;
        const marker = placement?.marker ?? polar(body.longitude, markerRadius, asc);
        const active = activeBodies.has(body.id);
        const color = active ? accent : isTransit(body.id) ? transitColor : colors.foreground,
          alpha = opacity(active);
        const selection: Selection = { kind: 'body', id: body.id };
        if (placement) stroke([marker, placement.label], colors.muted, 0.7, alpha * 0.7);
        stroke(
          [
            polar(body.longitude, isTransit(body.id) ? WHEEL.outer : markerRadius - 3, asc),
            polar(body.longitude, markerRadius + 4, asc),
          ],
          active ? accent : colors.foreground,
          active ? 2 : 1.5,
          alpha,
        );
        circle(2.3 / pixelsPerUnit, color, alpha, marker, 1.5);
        targets.push({
          selection,
          priority: 0,
          shape: 'circle',
          center: project(marker),
          radius: 6,
        });
        const element = elements.get(body.id)!;
        if (!placement) {
          element.remove();
          continue;
        }
        element.dataset.compact = String(
          isTransit(body.id) ? transitLayout.compact : natalLayout.compact,
        );
        const screen = project(placement.label);
        element.style.left = `${screen.x}px`;
        element.style.top = `${screen.y}px`;
        const box: Box = {
          ...screen,
          width: placement.box.width * pixelsPerUnit,
          height: placement.box.height * pixelsPerUnit,
        };
        targets.push({ selection, priority: 0, shape: 'box', box });
      }
      // Draw every planet's anchor above the aspect network and leader lines.
      // Anchors remain available when symbols compact or overflow the label band.
      for (const body of shownBodies) {
        const anchor = bodyAnchors.get(body.id)!;
        const active = activeBodies.has(body.id);
        const radius =
          (2.5 * Math.sqrt(visualWeight.strokeMultiplier) + (active ? 0.5 : 0)) / pixelsPerUnit;
        if (isTransit(body.id)) {
          const diamond = [
            { x: anchor.x, y: anchor.y + radius },
            { x: anchor.x + radius, y: anchor.y },
            { x: anchor.x, y: anchor.y - radius },
            { x: anchor.x - radius, y: anchor.y },
          ];
          stroke([...diamond, diamond[0]!], active ? accent : transitColor, 1.1, opacity(active));
        } else {
          const geometry = new CircleGeometry(radius, 24);
          geometry.translate(anchor.x, anchor.y, 0);
          mesh(geometry, active ? accent : colors.foreground, opacity(active));
        }
        targets.push({
          selection: { kind: 'body', id: body.id },
          priority: 0,
          shape: 'circle',
          center: project(anchor),
          radius: 6,
        });
      }
    } else delete stage.dataset.labelMode;
    if (renderer && !contextLost) renderer.render(scene, camera);
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
      const hadChooser = !!chooser;
      closeChooser();
      setSelection(null, 'keyboard');
      if (hadChooser) stage.focus({ preventScroll: true });
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
    const rect = container.getBoundingClientRect();
    stage.style.height = `${Math.max(280, rect.width)}px`;
    closeChooser();
    requestDraw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  listen(access, 'toggle', (() => resize()) as EventListener);
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
        theme: {
          ...options.theme,
          ...patch.theme,
          aspects: { ...options.theme?.aspects, ...patch.theme?.aspects },
        },
        glyphs: { ...options.glyphs, ...patch.glyphs },
        orbs: { ...options.orbs, ...patch.orbs },
        lineStyles: { ...options.lineStyles, ...patch.lineStyles },
        selectionEffects: { ...options.selectionEffects, ...patch.selectionEffects },
      };
      const nextWeight = weightProfile(nextOptions.chartWeight);
      const nextModel = createModel(options.data, nextOptions);
      options = nextOptions;
      visualWeight = nextWeight;
      model = nextModel;
      clearHover();
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
      if (frame) win.cancelAnimationFrame(frame);
      observer.disconnect();
      for (const dispose of teardown) dispose();
      closeChooser();
      listeners.clear();
      pointers.clear();
      clearDrawing();
      renderer?.dispose();
      renderer?.forceContextLoss();
      root.remove();
    },
  };
}
