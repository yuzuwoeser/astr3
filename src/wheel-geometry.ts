import { WHEEL, polar } from './layout.js';
import type { Point } from './layout.js';
import type { ChartLayout } from './types.js';

// Retain the original transit geometry for existing integrations and tests.
export const TRANSIT_WHEEL = {
  extent: 464,
  inner: 296,
  nearOuter: 380,
  outer: 400,
  marker: WHEEL.outer,
  preferred: 318,
  axis: 440,
} as const;

export interface BodyBand {
  readonly inner: number;
  readonly outer: number;
  readonly marker: number;
  readonly preferred: number;
  readonly bounds: readonly number[];
}
export interface DegreeScale {
  readonly id: 'inside' | 'outside' | 'natal' | 'transit';
  readonly edge: number;
  readonly start: number;
  readonly direction: -1 | 1;
  readonly label: number;
}
export interface WheelGeometry {
  readonly layout: ChartLayout;
  readonly extent: number;
  readonly axis: number;
  readonly zodiac: { readonly inner: number; readonly outer: number; readonly label: number };
  readonly house: {
    readonly inner: number;
    readonly outer: number;
    readonly ring: number;
    readonly label: number;
  };
  readonly anchor: number;
  readonly natal: BodyBand;
  readonly transit: BodyBand;
  readonly scales: readonly DegreeScale[];
}

/** One source of truth for rendering, placement, picking and camera fitting. */
export function resolveWheelGeometry(
  layout: ChartLayout | undefined = 'default',
  transit = false,
  degrees = true,
): WheelGeometry {
  if (layout !== 'default' && layout !== 'alternative')
    throw new RangeError('Chart layout must be default or alternative.');
  if (layout === 'default')
    return {
      layout,
      extent: transit ? TRANSIT_WHEEL.extent : WHEEL.extent,
      axis: transit ? TRANSIT_WHEEL.axis : degrees ? 318 : 305,
      zodiac: { inner: WHEEL.zodiacInner, outer: WHEEL.outer, label: 269 },
      house: { inner: 0, outer: WHEEL.houseOuter, ring: WHEEL.house, label: WHEEL.houseLabel },
      anchor: WHEEL.house,
      natal: {
        inner: WHEEL.house,
        outer: WHEEL.labelOuter,
        marker: WHEEL.marker,
        preferred: 214,
        bounds: [WHEEL.labelOuter],
      },
      transit: {
        ...TRANSIT_WHEEL,
        bounds: [
          TRANSIT_WHEEL.nearOuter,
          (TRANSIT_WHEEL.nearOuter + TRANSIT_WHEEL.outer) / 2,
          TRANSIT_WHEEL.outer,
        ],
      },
      scales: [
        { id: 'inside', edge: WHEEL.zodiacInner, start: 250, direction: -1, label: 232 },
        {
          id: 'outside',
          edge: WHEEL.outer,
          start: WHEEL.outer + 2,
          direction: 1,
          label: WHEEL.outer + 30,
        },
      ],
    };

  // Both source bands fit inside the zodiac. Their equal widths leave a
  // separate central aspect disk; a single chart gets one expanded band.
  return {
    layout,
    extent: 450,
    axis: 426,
    house: { inner: 372, outer: 400, ring: 400, label: 386 },
    zodiac: { inner: 338, outer: 372, label: 355 },
    anchor: transit ? 124 : 210,
    natal: transit
      ? { inner: 132, outer: 214, marker: 232, preferred: 188, bounds: [214] }
      : { inner: 218, outer: 320, marker: 338, preferred: 286, bounds: [320] },
    transit: { inner: 238, outer: 320, marker: 338, preferred: 294, bounds: [320] },
    scales: transit
      ? [
          { id: 'transit', edge: 338, start: 336, direction: -1, label: 318 },
          { id: 'natal', edge: 232, start: 230, direction: -1, label: 212 },
        ]
      : [{ id: 'natal', edge: 338, start: 336, direction: -1, label: 318 }],
  };
}

/** Actual cusp sectors; the alternative's hit area has an empty center. */
export function housePolygon(
  geometry: WheelGeometry,
  longitude: number,
  span: number,
  ascendant: number,
): Point[] {
  const steps = Math.max(3, Math.ceil(span / 3));
  const arc = (radius: number) =>
    Array.from({ length: steps + 1 }, (_, j) =>
      polar(longitude + (span * j) / steps, radius, ascendant),
    );
  return geometry.house.inner
    ? [...arc(geometry.house.outer), ...arc(geometry.house.inner).reverse()]
    : [{ x: 0, y: 0 }, ...arc(geometry.house.outer)];
}
