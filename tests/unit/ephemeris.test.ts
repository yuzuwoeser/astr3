import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAstronomyProvider, calculateHouses } from '../../src/ephemeris/index.js';
import { angularDistance, createModel } from '../../src/model/index.js';
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
        for (const [i, body] of model.bodies.entries()) {
          // Different future ΔT models shift the Moon by >1 arcminute in 2100.
          expect(
            angularDistance(body.longitude, fixture.planets[i]!.longitude),
            `${body.name} position`,
          ).toBeLessThan(2 / 60);
          expect(body.retrograde, `${body.name} motion`).toBe(fixture.planets[i]!.speed < 0);
        }
        expect(
          angularDistance(model.angles.ascendant!, fixture.houses[system].ascendant),
        ).toBeLessThan(0.005);
        expect(
          angularDistance(model.angles.midheaven!, fixture.houses[system].midheaven),
        ).toBeLessThan(0.005);
        for (const [i, house] of model.houses.entries())
          expect(
            angularDistance(house.longitude, fixture.houses[system].cusps[i]!),
            `house ${i + 1}, ${system}`,
          ).toBeLessThan(0.005);
      }
    });
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
