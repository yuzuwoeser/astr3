import { expect, it } from 'vitest';
import { createModel } from '../../src/model/index.js';
import { layoutBodies, pointInPolygon, polar, WHEEL } from '../../src/layout.js';
import { signedDistance } from '../../src/model/math.js';
import { housePolygon, resolveWheelGeometry, TRANSIT_WHEEL } from '../../src/wheel-geometry.js';

it('retains the original default placement and camera extents', () => {
  const model = createModel({ bodies: [{ id: 'sun', name: 'Sun', longitude: 20 }] });
  const natal = resolveWheelGeometry();
  expect(layoutBodies(model.bodies, 0, 1)).toEqual(
    layoutBodies(model.bodies, 0, 1, undefined, [], natal.natal),
  );
  expect(natal.extent).toBe(WHEEL.extent);
  expect(natal.anchor).toBe(WHEEL.house);
  const transit = resolveWheelGeometry('default', true);
  expect(transit.extent).toBe(TRANSIT_WHEEL.extent);
  expect(transit.transit.marker).toBe(WHEEL.outer);
  expect(resolveWheelGeometry('default', false, false).axis).toBe(305);
});

it.each([false, true])(
  'orders alternative rings and attaches exact markers to their rulers (transit=%s)',
  (transit) => {
    const g = resolveWheelGeometry('alternative', transit);
    expect(g.house.inner).toBe(g.zodiac.outer);
    expect(g.house.outer).toBeGreaterThan(g.zodiac.outer);
    expect(g.axis).toBeGreaterThan(g.house.outer);
    expect(g.extent).toBeGreaterThan(g.axis);
    expect(g.anchor).toBeLessThan(g.natal.inner);
    if (transit) {
      expect(g.transit.marker).toBe(g.zodiac.inner);
      expect(g.transit.inner).toBeGreaterThan(g.natal.marker);
      expect(g.natal.outer).toBeLessThan(g.natal.marker);
      expect(g.transit.outer - g.transit.inner).toBe(g.natal.outer - g.natal.inner);
    } else {
      expect(g.natal.marker).toBe(g.zodiac.inner);
      expect(g.natal.outer - g.natal.inner).toBeGreaterThan(
        resolveWheelGeometry('alternative', true).natal.outer -
          resolveWheelGeometry('alternative', true).natal.inner,
      );
    }
    for (const side of transit ? (['natal', 'transit'] as const) : (['natal'] as const))
      expect(g.scales.find((scale) => scale.id === side)?.edge).toBe(g[side].marker);
  },
);

it('selects only the outer house annulus, including a sector across zero degrees', () => {
  const g = resolveWheelGeometry('alternative');
  const polygon = housePolygon(g, 350, 40, 73);
  expect(pointInPolygon(polar(10, g.house.label, 73), polygon)).toBe(true);
  for (const point of [{ x: 0, y: 0 }, polar(10, g.zodiac.label, 73), polar(60, g.house.label, 73)])
    expect(pointInPolygon(point, polygon)).toBe(false);
  // The original house sectors still reach the center.
  expect(pointInPolygon(polar(10, 10, 73), housePolygon(resolveWheelGeometry(), 350, 40, 73))).toBe(
    true,
  );
});

it('packs both alternative sources deterministically inside their bands without changing longitudes', () => {
  const model = createModel({
    bodies: Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      longitude: (350 + i * 3) % 360,
    })),
  });
  const before = structuredClone(model);
  const g = resolveWheelGeometry('alternative', true);
  for (const band of [g.natal, g.transit]) {
    const measure = () => ({ width: 16, height: 18 });
    const layout = layoutBodies(model.bodies, 0, 1.2, measure, [], band, 'compact', () => ({
      width: 24,
      height: 24,
    }));
    expect(layout).toEqual(
      layoutBodies([...model.bodies].reverse(), 0, 1.2, measure, [], band, 'compact', () => ({
        width: 24,
        height: 24,
      })),
    );
    expect(
      layout.placements.length +
        layout.clusters.reduce((sum, cluster) => sum + cluster.bodyIds.length, 0),
    ).toBe(model.bodies.length);
    for (const placed of [...layout.placements, ...layout.clusters]) {
      const b = placed.box;
      expect(
        Math.hypot(
          Math.max(0, Math.abs(b.x) - b.width / 2),
          Math.max(0, Math.abs(b.y) - b.height / 2),
        ),
      ).toBeGreaterThanOrEqual(band.inner + 4 / 1.2 - 1e-6);
      expect(
        Math.hypot(Math.abs(b.x) + b.width / 2, Math.abs(b.y) + b.height / 2),
      ).toBeLessThanOrEqual(band.outer - 4 / 1.2 + 1e-6);
    }
    for (const placement of layout.placements) {
      const body = model.bodies.find((body) => body.id === placement.id)!;
      expect(placement.marker).toEqual(polar(body.longitude, band.marker));
      const angle = (Math.atan2(placement.label.y, placement.label.x) * 180) / Math.PI - 180;
      expect(Math.abs(signedDistance(body.longitude, angle))).toBeLessThanOrEqual(30.001);
    }
  }
  expect(model).toEqual(before);
});

it.each(['layered', '', null, 42])('rejects unsupported layout %s', (layout) => {
  expect(() => resolveWheelGeometry(layout as never)).toThrow(RangeError);
});
