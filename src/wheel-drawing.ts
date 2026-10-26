import {
  BODY_GLYPHS,
  SIGN_GLYPHS,
  SIGNS,
  formatPosition,
  normalize,
  signedDistance,
} from './model/math.js';
import { getSelectionDetails } from './model/model.js';
import { ASPECT_DEFINITIONS } from './model/aspects.js';
import type { Body, ChartModel, Selection } from './model/types.js';
import type { ChartOptions, ChartTheme, ChartLayers, ChartWeight, LineStyle } from './types.js';
import {
  aspectPath,
  boxesOverlap,
  convexHull,
  layoutBodies,
  pointInPolygon,
  polar,
} from './layout.js';
import { housePolygon } from './wheel-geometry.js';
import type { WheelGeometry } from './wheel-geometry.js';
import type { BodyLayout, Box, Point } from './layout.js';
import { chartText, formatGlyphPosition } from './chart-text.js';
import type { TextSpec, TextSize } from './chart-text.js';
import type { HitTarget } from './picking.js';
import type { AspectFamily, BodyReference, ChartSide } from './model/transits.js';

export interface WheelPresentation {
  bodyRefs: ReadonlyMap<string, BodyReference>;
  aspectFamilies: ReadonlyMap<string, AspectFamily>;
  bodies: Record<ChartSide, boolean>;
  aspects: Record<AspectFamily, boolean>;
  transitColor?: string;
}
const WEIGHT_PROFILES = {
  light: { strokeMultiplier: 1, fontWeight: 400, symbolStroke: 0 },
  regular: { strokeMultiplier: 1.5, fontWeight: 500, symbolStroke: 0.15 },
  bold: { strokeMultiplier: 2, fontWeight: 650, symbolStroke: 0.3 },
} as const;

export function weightProfile(weight: ChartWeight = 'light') {
  if (!Object.hasOwn(WEIGHT_PROFILES, weight)) {
    throw new RangeError('chartWeight must be light, regular, or bold.');
  }
  return WEIGHT_PROFILES[weight];
}

export interface WheelView {
  width: number;
  height: number;
  pixelsPerUnit: number;
  pan: Point;
}
export function projectWheel(point: Point, view: WheelView): Point {
  return {
    x: view.width / 2 + (point.x - view.pan.x) * view.pixelsPerUnit,
    y: view.height / 2 - (point.y - view.pan.y) * view.pixelsPerUnit,
  };
}
export type WheelShape =
  | {
      kind: 'stroke';
      points: readonly Point[];
      color: string;
      width: number;
      opacity: number;
      dash?: readonly [number, number];
    }
  | { kind: 'fill'; points: readonly Point[]; color: string; opacity: number }
  | { kind: 'disc'; center: Point; radius: number; color: string; opacity: number };
export interface WheelLabel extends TextSpec, Point {
  color: string;
  opacity: number;
  active: boolean;
  dataset: Record<string, string>;
  selection?: Selection;
  title?: string;
  box: TextSize;
}
export interface WheelBadge extends Point, TextSize {
  id: string;
  bodyIds: readonly string[];
  color: string;
  opacity: number;
  active: boolean;
  chart?: ChartSide;
}
export interface WheelDrawing {
  view: WheelView;
  shapes: WheelShape[];
  labels: WheelLabel[];
  badges: WheelBadge[];
  targets: HitTarget[];
  notice: string;
  labelMode?: string;
  textTier: string;
}
export interface WheelDrawingInput {
  model: ChartModel;
  options: ChartOptions;
  colors: ChartTheme;
  visible: ChartLayers;
  geometry: WheelGeometry;
  view: WheelView;
  selected: Selection | null;
  hovered?: Selection | null;
  presentation?: WheelPresentation;
  measure: (spec: TextSpec) => TextSize;
  cache?: Map<string, BodyLayout>;
}

/** Shared, DOM/GPU-free wheel construction. Positions stay in wheel units;
 * labels and hit targets use CSS pixels. Measurement belongs to each backend. */
export function buildWheelDrawing(input: WheelDrawingInput): WheelDrawing {
  const { model, options, colors, visible, geometry, view, selected, hovered, presentation } =
    input;
  const { pixelsPerUnit } = view;
  const project = (point: Point) => projectWheel(point, view);
  const visualWeight = weightProfile(options.chartWeight);
  const advanced = geometry.layout === 'advanced';
  const text = chartText(pixelsPerUnit);
  if (advanced && pixelsPerUnit >= 0.65) text.caption = Math.max(9, text.caption);
  // Advanced identifies displaced symbols by their positions, without leaders.
  const bodyCaptionSize = advanced ? Math.max(9, text.caption) : text.caption;
  const textMetrics = { measure: input.measure };
  const layoutCache = input.cache ?? new Map<string, BodyLayout>();
  const shapes: WheelShape[] = [],
    labels: WheelLabel[] = [],
    badges: WheelBadge[] = [];
  const targets: HitTarget[] = [];
  let notice = '',
    labelMode: string | undefined;
  const bodyVisible = (id: string) => options.bodyVisibility?.[id] !== false;
  const glyph = (body: Body) =>
    options.glyphs && Object.hasOwn(options.glyphs, body.id)
      ? options.glyphs[body.id]!
      : (body.glyph ??
        (Object.hasOwn(BODY_GLYPHS, body.id) ? BODY_GLYPHS[body.id]! : body.name.slice(0, 2)));
  function fill(points: readonly Point[], color: string, opacity: number) {
    if (points.length >= 3) shapes.push({ kind: 'fill', points, color, opacity });
  }
  function stroke(
    points: readonly Point[],
    color: string,
    lineWidth = 1,
    opacity = 1,
    dash?: readonly [number, number],
  ) {
    shapes.push({
      kind: 'stroke',
      points,
      color,
      width: Math.max(0.25, lineWidth * visualWeight.strokeMultiplier),
      opacity,
      dash,
    });
  }
  function circle(
    radius: number,
    color: string,
    opacity = 1,
    center: Point = { x: 0, y: 0 },
    lineWidth = 1,
  ) {
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
  ): WheelLabel {
    const value: WheelLabel = {
      ...project(point),
      text,
      size,
      color,
      className,
      selection,
      active: selected?.kind === selection?.kind && !!selection && selected?.id === selection.id,
      opacity: 1,
      dataset: {},
      box: textMetrics.measure({ text, size, className }),
    };
    labels.push(value);
    return value;
  }
  const asc = model.angles.ascendant ?? 0;
  const p = presentation;
  const isTransit = (id: string) => p?.bodyRefs.get(id)?.chart === 'transit';
  const dotRadiusPx = 2.5 * Math.sqrt(visualWeight.strokeMultiplier);
  const dotExtentPx = (id: string) =>
    dotRadiusPx + (isTransit(id) ? (1.1 * visualWeight.strokeMultiplier) / 2 : 0);
  const transitColor = p?.transitColor ?? colors.group;
  const innerBands = geometry.layout !== 'default';
  const annularHouses = geometry.house.inner > 0;
  const axisRadius = geometry.axis;
  const plottedBodies = model.bodies.filter((body) => bodyVisible(body.id));
  const shownBodies = plottedBodies.filter(
    (body) => !p || p.bodies[isTransit(body.id) ? 'transit' : 'natal'],
  );
  const primary = selected ?? hovered;
  const details = primary ? getSelectionDetails(model, primary) : null;
  const activeBodies = new Set(details?.bodies.map((body) => body.id));
  const activeAspects = new Set(details?.aspects.map((aspect) => aspect.id));
  const bodyAnchors = new Map(
    plottedBodies.map((body) => [body.id, polar(body.longitude, geometry.anchor, asc)]),
  );
  const dim = options.selectionEffects?.dimOpacity ?? 0.22;
  const opacity = (active: boolean) =>
    !primary || active || options.dimUnrelated === false ? 1 : dim;
  const accent = options.selectionEffects?.color ?? colors.accent;
  const activeWidth = options.selectionEffects?.lineWidth ?? 2.5;
  const reservedLabels: { element: WheelLabel; point: Point }[] = [];
  const houseNumberSpace: Box[] =
    p && !annularHouses
      ? [...bodyAnchors.values()].map((point) => ({
          ...point,
          width: 9 / pixelsPerUnit,
          height: 9 / pixelsPerUnit,
        }))
      : [];
  notice = model.timeUncertain
    ? 'REFERENCE SNAPSHOT · birth time uncertain'
    : model.houseStatus === 'unavailable'
      ? 'Houses unavailable · choose another system'
      : model.houseStatus === 'unknown'
        ? 'Houses unknown'
        : '';

  if (visible.zodiac) {
    circle(geometry.zodiac.outer, colors.ring);
    circle(geometry.zodiac.inner, colors.ring);
    for (let sign = 0; sign < 12; sign++) {
      const color = colors.elements[sign % 4]!;
      stroke(
        [
          polar(sign * 30, geometry.zodiac.inner, asc),
          polar(sign * 30, geometry.zodiac.outer, asc),
        ],
        colors.ring,
      );
      label(
        polar(sign * 30 + 15, geometry.zodiac.label, asc),
        SIGN_GLYPHS[sign]!,
        text.glyph,
        color,
        'astr3-symbol',
      ).title = SIGNS[sign]!;
    }
  }
  if (innerBands) {
    if (visible.bodies || visible.aspects || visible.groups)
      circle(geometry.anchor, colors.ring, 0.6);
    if (visible.bodies || visible.degrees)
      for (const scale of geometry.scales)
        if (!visible.zodiac || scale.edge !== geometry.zodiac.inner)
          circle(scale.edge, colors.ring, 0.7);
  }
  if (visible.degrees)
    for (let degree = 0; degree < 360; degree++) {
      const major = degree % 10 === 0,
        minor = degree % 5 === 0;
      for (const scale of geometry.scales) {
        stroke(
          [
            polar(degree, scale.start, asc),
            polar(degree, scale.start + scale.direction * (major ? 8 : minor ? 5 : 2), asc),
          ],
          colors.muted,
          0.65,
          major ? 0.9 : 0.35,
        );
        if (major && text.scale) {
          const point = polar(degree, scale.label, asc);
          // Leave room for axis captions where they meet the outside scale.
          if (
            scale.id === 'outside' &&
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
          const element = label(
            point,
            String(degree % 30),
            text.scale,
            colors.muted,
            'astr3-degree',
          );
          element.dataset.scale = scale.id;
          reservedLabels.push({ element, point });
        }
      }
    }
  if (visible.houses && model.houses.length) {
    circle(geometry.house.ring, colors.ring, 0.6);
    if (geometry.layout === 'alternative' && !visible.zodiac)
      circle(geometry.house.inner, colors.ring);
    for (let i = 0; i < model.houses.length; i++) {
      const house = model.houses[i]!,
        next = model.houses[(i + 1) % 12]!;
      const span = normalize(next.longitude - house.longitude);
      const selection: Selection = { kind: 'house', id: house.id };
      const polygon = housePolygon(geometry, house.longitude, span, asc);
      const active = primary?.kind === 'house' && primary.id === house.id;
      if (active) fill(polygon, accent, 0.08);
      stroke(
        [
          polar(house.longitude, geometry.house.inner, asc),
          polar(house.longitude, geometry.house.outer, asc),
        ],
        active ? accent : colors.ring,
        active ? 1.6 : 0.75,
        0.65,
      );
      const houseRadius =
        p && !annularHouses
          ? Math.max(
              20,
              Math.min(geometry.house.label, geometry.anchor - 10 / Math.max(pixelsPerUnit, 0.05)),
            )
          : geometry.house.label;
      let labelPoint = polar(house.longitude + span / 2, houseRadius, asc);
      const houseLabel = label(
        labelPoint,
        String(house.number),
        text.number,
        active ? accent : colors.muted,
        '',
        selection,
      );
      let showNumber = true;
      if (annularHouses) {
        const rect = houseLabel.box;
        const box = {
          ...labelPoint,
          width: rect.width / pixelsPerUnit,
          height: rect.height / pixelsPerUnit,
        };
        // Tiny or narrow sectors keep their full clickable band/list entry.
        // Never move their number into the aspect disk, zodiac or another house.
        showNumber =
          [-1, 1].every((x) =>
            [-1, 1].every((y) =>
              pointInPolygon(
                {
                  x: box.x + x * (box.width / 2 + 1 / pixelsPerUnit),
                  y: box.y + y * (box.height / 2 + 1 / pixelsPerUnit),
                },
                polygon,
              ),
            ),
          ) && !houseNumberSpace.some((other) => boxesOverlap(box, other, 2 / pixelsPerUnit));
        if (showNumber) houseNumberSpace.push(box);
        else labels.splice(labels.indexOf(houseLabel), 1);
      } else if (p) {
        const rect = houseLabel.box;
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
        houseLabel.x = position.x;
        houseLabel.y = position.y;
      }
      if (showNumber) reservedLabels.push({ element: houseLabel, point: labelPoint });
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
          bodyVisible(body.id) &&
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
      const element = label(point, name, text.number, accent, 'astr3-axis', selection);
      element.dataset.axis = id;
      element.opacity = body ? opacity(active) : 1;
      if (selection) {
        const rect = element.box;
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
        element: label(opposite, name === 'AC' ? 'DC' : 'IC', text.number, colors.muted),
        point: opposite,
      });
    }
  if (visible.houses && visible.degrees && geometry.house.cuspLabel && text.caption) {
    // Axis captions have priority. Keep cusp captions at their true longitude;
    // omit collisions in stable house-number order instead of displacing them.
    const occupied = reservedLabels.map(({ element, point }) => ({
      ...point,
      width: element.box.width / pixelsPerUnit,
      height: element.box.height / pixelsPerUnit,
    }));
    for (const house of model.houses) {
      const point = polar(house.longitude, geometry.house.cuspLabel, asc);
      const spec = {
        text: formatGlyphPosition(house.longitude),
        size: text.caption,
        className: 'astr3-cusp',
      };
      const measured = textMetrics.measure(spec);
      const box = {
        ...point,
        width: measured.width / pixelsPerUnit,
        height: measured.height / pixelsPerUnit,
      };
      if (
        Math.hypot(Math.abs(point.x) + box.width / 2, Math.abs(point.y) + box.height / 2) >
          geometry.extent - 4 / pixelsPerUnit ||
        occupied.some((other) => boxesOverlap(box, other, 3 / pixelsPerUnit))
      )
        continue;
      const element = label(
        point,
        spec.text,
        spec.size,
        primary?.kind === 'house' && primary.id === house.id ? accent : colors.muted,
        spec.className,
        { kind: 'house', id: house.id },
      );
      element.title = `House ${house.number} · ${formatPosition(house.longitude)}`;
      element.dataset.house = String(house.number);
      occupied.push(box);
      reservedLabels.push({ element, point });
      targets.push({
        selection: { kind: 'house', id: house.id },
        priority: 3,
        shape: 'box',
        box: { ...project(point), ...measured },
      });
    }
  }
  if (geometry.layout === 'alternative' && visible.bodies && primary && primary.kind !== 'house') {
    const guideIds = primary.kind === 'body' ? new Set([primary.id]) : activeBodies;
    for (const body of shownBodies) {
      if (!guideIds.has(body.id)) continue;
      const band = isTransit(body.id) ? geometry.transit : geometry.natal;
      stroke(
        [polar(body.longitude, band.marker, asc), bodyAnchors.get(body.id)!],
        colors.muted,
        0.7,
        0.45,
        [3, 4],
      );
    }
  }
  if (visible.groups)
    for (const group of model.groups) {
      const ids = new Set(group.bodyIds);
      for (const id of group.aspectIds)
        for (const bodyId of model.aspects.find((aspect) => aspect.id === id)!.bodyIds)
          ids.add(bodyId);
      if ([...ids].some((id) => !bodyVisible(id))) continue;
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
      if (!aspect.bodyIds.every(bodyVisible)) continue;
      if (p && !p.aspects[p.aspectFamilies.get(aspect.id)!]) continue;
      const active = !!primary && activeAspects.has(aspect.id);
      const style: LineStyle = options.lineStyles?.[aspect.type] ?? {};
      const color = active ? accent : colors.aspects[aspect.type];
      const path = aspectPath(
        bodyAnchors.get(aspect.bodyIds[0])!,
        bodyAnchors.get(aspect.bodyIds[1])!,
        pixelsPerUnit,
        {
          type: aspect.type,
          markerRadii: [dotExtentPx(aspect.bodyIds[0]), dotExtentPx(aspect.bodyIds[1])],
          ringRadius: geometry.anchor,
        },
      );
      if (!path.points.length) continue;
      stroke(
        path.points,
        color,
        active ? activeWidth : (style.width ?? 1.1),
        opacity(activeAspects.has(aspect.id)) * 0.85 * path.opacity,
        style.dash ?? (ASPECT_DEFINITIONS[aspect.type].major ? undefined : [4, 3]),
      );
      if (path.opacity < 0.5) continue;
      for (let i = 1; i < path.points.length; i++)
        targets.push({
          selection: { kind: 'aspect', id: aspect.id },
          priority: 1,
          shape: 'line',
          a: project(path.points[i - 1]!),
          b: project(path.points[i]!),
        });
    }
  if (visible.bodies) {
    const reservedBoxes = reservedLabels.map(({ element, point }) => {
      const rect = element.box;
      return { ...point, width: rect.width / pixelsPerUnit, height: rect.height / pixelsPerUnit };
    });
    const symbolScale = (body: Body) => (['AC', 'MC'].includes(glyph(body)) ? 0.72 : 1);
    const caption = (body: Body) => {
      const position = advanced
        ? formatGlyphPosition(body.longitude)
        : visible.degrees
          ? formatPosition(body.longitude).split(' ')[0]
          : '';
      return `${position}${body.retrograde ? ' ℞' : ''}`;
    };
    const measureBody = (body: Body, size: number, compact: boolean) => {
      const measured = textMetrics.measure({
        text: glyph(body),
        size: size * symbolScale(body),
        body: true,
        compact,
        caption: compact ? undefined : caption(body),
        captionSize: bodyCaptionSize,
      });
      return {
        width: measured.width + visualWeight.symbolStroke,
        height: measured.height + visualWeight.symbolStroke,
      };
    };
    const measureCluster = (count: number) => ({
      width: Math.max(24, textMetrics.measure({ text: String(count), size: 12 }).width + 12),
      height: 24,
    });
    const placeBand = (bodies: readonly Body[], transit = false) => {
      const band = transit ? geometry.transit : geometry.natal;
      const fit = (
        size: number,
        compact: boolean,
        outer: number = band.outer,
        clusters = false,
      ) => {
        const sizes = bodies.map((body) => measureBody(body, size, compact));
        const key = JSON.stringify([
          bodies.map((body) => [body.id, body.longitude]),
          sizes,
          asc,
          pixelsPerUnit,
          reservedBoxes,
          geometry.layout,
          band,
          outer,
          compact,
          clusters,
        ]);
        const cached = layoutCache.get(key);
        if (cached) return cached;
        const result = layoutBodies(
          bodies,
          asc,
          pixelsPerUnit,
          (body) => sizes[bodies.indexOf(body)]!,
          reservedBoxes,
          { ...band, outer },
          compact ? 'compact' : 'full',
          clusters ? measureCluster : undefined,
        );
        if (layoutCache.size >= 24) layoutCache.delete(layoutCache.keys().next().value!);
        layoutCache.set(key, result);
        return result;
      };
      // Prefer a closer transit band, retaining wider bounds for crowding.
      // Advanced always retains position captions, shrinking or clustering
      // instead. Other layouts hide captions before trying smaller glyphs.
      const bounds = band.bounds;
      const sizes = [text.glyph, ...[24, 18, 14].filter((size) => size < text.glyph)];
      for (const size of sizes) {
        for (const outer of bounds) {
          if ((advanced || size === text.glyph) && bodyCaptionSize) {
            const full = fit(size, false, outer);
            if (full.placements.length === bodies.length) return { layout: full, size };
          }
          if (!advanced) {
            const layout = fit(size, true, outer);
            if (layout.placements.length === bodies.length) return { layout, size };
          }
        }
      }
      const size = sizes.at(-1)!;
      return { layout: fit(size, !advanced, band.outer, true), size };
    };
    const natal = placeBand(shownBodies.filter((body) => !isTransit(body.id)));
    const transit = placeBand(
      shownBodies.filter((body) => isTransit(body.id)),
      true,
    );
    const placements = new Map(
      [...natal.layout.placements, ...transit.layout.placements].map((placement) => [
        placement.id,
        placement,
      ]),
    );
    const clusters = [...natal.layout.clusters, ...transit.layout.clusters];
    const grouped = clusters.reduce((count, cluster) => count + cluster.bodyIds.length, 0);
    const overflow = placements.size + grouped < shownBodies.length;
    labelMode = overflow
      ? 'markers'
      : clusters.length
        ? 'clustered'
        : natal.layout.compact || transit.layout.compact
          ? 'compact'
          : 'full';
    if (overflow || clusters.length)
      notice = [
        notice,
        clusters.length
          ? 'Choose a cluster or zoom in to reveal symbols'
          : 'Zoom in to reveal planet symbols',
      ]
        .filter(Boolean)
        .join(' · ');
    for (const cluster of clusters) {
      const active = cluster.bodyIds.some((id) => activeBodies.has(id));
      badges.push({
        id: cluster.id,
        bodyIds: cluster.bodyIds,
        ...project(cluster.label),
        width: cluster.box.width * pixelsPerUnit,
        height: cluster.box.height * pixelsPerUnit,
        active,
        opacity: opacity(active),
        color: active ? accent : isTransit(cluster.bodyIds[0]!) ? transitColor : colors.foreground,
        chart: p ? (isTransit(cluster.bodyIds[0]!) ? 'transit' : 'natal') : undefined,
      });
    }
    const elements = new Map<string, WheelLabel>();
    for (const body of shownBodies) {
      const placement = placements.get(body.id);
      if (!placement) continue;
      const band = isTransit(body.id) ? transit : natal;
      const element = label(
        placement.label,
        '',
        band.size * symbolScale(body),
        activeBodies.has(body.id) ? accent : isTransit(body.id) ? transitColor : colors.foreground,
        'astr3-body',
        { kind: 'body', id: body.id },
      );
      const ref = p?.bodyRefs.get(body.id);
      if (ref) {
        element.dataset.chart = ref.chart;
        element.dataset.bodyId = ref.id;
      }
      element.dataset.compact = String(band.layout.compact);
      element.dataset.dim = String(opacity(activeBodies.has(body.id)) < 1);
      element.text = glyph(body);
      element.body = true;
      element.compact = band.layout.compact;
      element.opacity = opacity(activeBodies.has(body.id));
      element.caption = !band.layout.compact ? caption(body) : undefined;
      element.captionSize = bodyCaptionSize;
      element.box = textMetrics.measure({
        text: element.text,
        size: element.size,
        body: true,
        compact: element.compact,
        caption: element.caption,
        captionSize: element.captionSize,
      });
      elements.set(body.id, element);
    }
    for (const body of shownBodies) {
      const placement = placements.get(body.id);
      const markerRadius = (isTransit(body.id) ? geometry.transit : geometry.natal).marker;
      const marker = placement?.marker ?? polar(body.longitude, markerRadius, asc);
      const active = activeBodies.has(body.id);
      const color = active ? accent : isTransit(body.id) ? transitColor : colors.foreground,
        alpha = opacity(active);
      const selection: Selection = { kind: 'body', id: body.id };
      if (placement && !advanced) {
        const dx = marker.x - placement.label.x,
          dy = marker.y - placement.label.y;
        const factor = Math.min(
          1,
          placement.box.width / 2 / Math.max(Math.abs(dx), 1e-9),
          placement.box.height / 2 / Math.max(Math.abs(dy), 1e-9),
        );
        stroke(
          [marker, { x: placement.label.x + dx * factor, y: placement.label.y + dy * factor }],
          colors.muted,
          0.7,
          alpha * 0.7,
        );
      }
      if (!advanced)
        stroke(
          [
            polar(
              body.longitude,
              !innerBands && isTransit(body.id) ? markerRadius : markerRadius - 3,
              asc,
            ),
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
      const element = elements.get(body.id);
      if (!placement || !element) continue;
      const screen = project(placement.label);
      element.x = screen.x;
      element.y = screen.y;
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
      const radius = (dotRadiusPx + (active ? 0.5 : 0)) / pixelsPerUnit;
      if (isTransit(body.id)) {
        const diamond = [
          { x: anchor.x, y: anchor.y + radius },
          { x: anchor.x + radius, y: anchor.y },
          { x: anchor.x, y: anchor.y - radius },
          { x: anchor.x - radius, y: anchor.y },
        ];
        stroke([...diamond, diamond[0]!], active ? accent : transitColor, 1.1, opacity(active));
      } else {
        shapes.push({
          kind: 'disc',
          center: anchor,
          radius,
          color: active ? accent : colors.foreground,
          opacity: opacity(active),
        });
      }
      targets.push({
        selection: { kind: 'body', id: body.id },
        priority: 0,
        shape: 'circle',
        center: project(anchor),
        radius: 6,
      });
    }
  }
  return { view, shapes, labels, badges, targets, notice, labelMode, textTier: text.tier };
}
