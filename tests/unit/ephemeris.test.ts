import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAstronomyProvider, calculateHouses } from '../../src/ephemeris/index.js';
import { angularDistance, createModel, getSelectionDetails } from '../../src/model/index.js';
import type { HouseSystem } from '../../src/model/index.js';

const reference = JSON.parse(
  readFileSync(new URL('../fixtures/reference.json', import.meta.url), 'utf8'),
) as {
  cases: {
    utc: string;
    latitude: number;
    longitude: number;
    planets: { longitude: number; speed: number }[];
    houses: Record<HouseSystem, { cusps: number[]; ascendant: number; midheaven: number }>;
  }[];
};
const provider = createAstronomyProvider();
const geometry = JSON.parse(
  readFileSync(new URL('../fixtures/house-geometry.json', import.meta.url), 'utf8'),
) as {
  cases: { ramc: number; latitude: number; obliquity: number; cusps: number[] }[];
};
const nodes = JSON.parse(
  readFileSync(new URL('../fixtures/lunar-nodes.json', import.meta.url), 'utf8'),
) as { cases: { utc: string; longitude: number; speed: number }[] };

it('matches independent Placidus geometry near the polar circle and meridian quadrants', () => {
  for (const fixture of geometry.cases) {
    const result = calculateHouses(fixture.ramc, fixture.latitude, fixture.obliquity, 'placidus');
    expect(result.status).toBe('available');
    for (const [i, cusp] of result.houses!.entries())
      expect(
        angularDistance(cusp.longitude, fixture.cusps[i]!),
        `latitude ${fixture.latitude}, RAMC ${fixture.ramc}, house ${i + 1}`,
      ).toBeLessThan(0.00001);
  }
});

describe('independent numerical reference fixtures, 1900–2100', () => {
  for (const fixture of reference.cases) {
    it(`matches tropical positions and house systems at ${fixture.utc}, latitude ${fixture.latitude}`, async () => {
      for (const system of ['placidus', 'equal', 'whole-sign'] as const) {
        const data = await provider.calculate({ ...fixture, houseSystem: system });
        const model = createModel(data);
        expect(data.houseStatus).toBe('available');
        expect(model.bodies).toHaveLength(14);
        for (const [i, planet] of fixture.planets.entries()) {
          const body = model.bodies[i]!;
          // Different future ΔT models shift the Moon by >1 arcminute in 2100.
          expect(
            angularDistance(body.longitude, planet.longitude),
            `${body.name} position`,
          ).toBeLessThan(2 / 60);
          expect(body.retrograde, `${body.name} motion`).toBe(planet.speed < 0);
        }
        expect(
          angularDistance(model.angles.ascendant!, fixture.houses[system].ascendant),
        ).toBeLessThan(0.005);
        expect(
          angularDistance(model.angles.midheaven!, fixture.houses[system].midheaven),
        ).toBeLessThan(0.005);
        for (const id of ['ascendant', 'midheaven'] as const)
          expect(model.bodies.find((body) => body.id === id)?.longitude).toBe(model.angles[id]);
        for (const [i, house] of model.houses.entries())
          expect(
            angularDistance(house.longitude, fixture.houses[system].cusps[i]!),
            `house ${i + 1}, ${system}`,
          ).toBeLessThan(0.005);
      }
    });
  }
});

it('matches independent true-node positions and speeds, including direct motion and zodiac wrap', async () => {
  let direct = false,
    retrograde = false;
  for (const fixture of nodes.cases) {
    const data = await provider.calculateTransits({ utc: fixture.utc });
    const north = data.bodies.find((body) => body.id === 'north-node')!;
    const south = data.bodies.find((body) => body.id === 'south-node')!;
    expect(data.metadata?.lunarNodeType).toBe('true');
    expect(north.metadata?.nodeType).toBe('true');
    expect(north.latitude).toBe(0);
    expect(south.latitude).toBe(0);
    expect(angularDistance(north.longitude, fixture.longitude), fixture.utc).toBeLessThan(1 / 60);
    expect(angularDistance(north.longitude, south.longitude)).toBeCloseTo(180, 10);
    expect(south.speed).toBe(north.speed);
    expect(Math.abs(north.speed! - fixture.speed), fixture.utc).toBeLessThan(0.01);
    // Nodes can briefly turn direct. Engines can disagree very near a station.
    if (Math.abs(fixture.speed) > 0.01) {
      expect(north.retrograde, fixture.utc).toBe(fixture.speed < 0);
      expect(south.retrograde).toBe(north.retrograde);
      direct ||= !north.retrograde;
      retrograde ||= !!north.retrograde;
    }
  }
  expect(direct && retrograde).toBe(true);
});

it('includes angles and nodes in house occupancy, selection, and calculated aspects', async () => {
  const data = await provider.calculate({
    utc: '2000-01-01T12:00:00Z',
    latitude: 51.5074,
    longitude: -0.1278,
    houseSystem: 'whole-sign',
  });
  const model = createModel(data);
  expect(model.angles.midheaven).not.toBe(model.houses[9]!.longitude);
  for (const id of ['ascendant', 'midheaven', 'north-node', 'south-node']) {
    const details = getSelectionDetails(model, { kind: 'body', id })!;
    expect(details.object).toMatchObject({ id, house: expect.any(Number) });
    expect(details.aspects.length).toBeGreaterThan(0);
    expect(details.houses.some((house) => house.bodyIds.includes(id))).toBe(true);
  }
});

it('reports polar Placidus as unavailable without switching the house system', async () => {
  const data = await provider.calculate({
    utc: '2024-01-01T00:00:00Z',
    latitude: 70,
    longitude: 10,
  });
  expect(data.houseStatus).toBe('unavailable');
  expect(data.houses).toBeUndefined();
  expect(data.bodies.find((body) => body.id === 'ascendant')?.longitude).toBe(
    data.angles?.ascendant,
  );
  expect(data.warnings?.[0]).toContain('Placidus');
  expect(
    (
      await provider.calculate({
        utc: '2024-01-01T00:00:00Z',
        latitude: 70,
        longitude: 10,
        houseSystem: 'equal',
      })
    ).houseStatus,
  ).toBe('available');
  expect(calculateHouses(100, 90, 23.4, 'equal')).toMatchObject({
    status: 'unavailable',
    angles: {},
  });
  const polar = await provider.calculate({
    utc: '2024-01-01T00:00:00Z',
    latitude: 90,
    longitude: 10,
  });
  expect(polar.bodies).toHaveLength(12);
  expect(polar.bodies.some((body) => ['ascendant', 'midheaven'].includes(body.id))).toBe(false);
});

it('omits houses and angles for an uncertain reference time', async () => {
  const data = await provider.calculate({
    utc: '2024-01-01T12:00:00Z',
    latitude: 40,
    longitude: -74,
    timeUncertain: true,
  });
  expect(data.houses).toBeUndefined();
  expect(data.angles).toBeUndefined();
  expect(data.bodies).toHaveLength(12);
  expect(data.bodies.some((body) => ['ascendant', 'midheaven'].includes(body.id))).toBe(false);
  expect(data.bodies.some((body) => body.id === 'north-node')).toBe(true);
  expect(data).toMatchObject({ houseStatus: 'unknown', timeUncertain: true });
});

it('validates coordinates, timezones and the supported date interval', async () => {
  const request = { utc: '2024-01-01T00:00:00Z', latitude: 40, longitude: 10 };
  await expect(provider.calculate({ ...request, latitude: 91 })).rejects.toThrow('Latitude');
  await expect(provider.calculate({ ...request, utc: '2024-01-01T12:00' })).rejects.toThrow(
    'offset',
  );
  await expect(provider.calculate({ ...request, utc: '1800-01-01T00:00:00Z' })).rejects.toThrow(
    '1900',
  );
  await expect(provider.calculate({ ...request, utc: 'badZ' })).rejects.toThrow('1900');
});

it('honors already-aborted and superseded calculation requests', async () => {
  const controller = new AbortController();
  const request = { utc: '2024-01-01T00:00:00Z', latitude: 40, longitude: 10 };
  const pending = provider.calculate(request, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await expect(provider.calculate(request, { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
});
