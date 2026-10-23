import { describe, expect, it } from 'vitest';
import { createAstronomyProvider } from '../../src/ephemeris/index.js';
import { angularDistance, normalize, signedDistance } from '../../src/model/math.js';
import type { ChartInput } from '../../src/model/types.js';
import { DAY, prepareTransitAnimation } from '../../src/transit-sampling.js';
import type { TransitCalculator } from '../../src/transit-animation.js';

const signal = () => new AbortController().signal;

describe('transit trajectory sampling', () => {
  it('subdivides a curved path through wraparound rather than using endpoint interpolation', async () => {
    const from = Date.UTC(2024, 0, 1),
      to = from + DAY;
    const calculate: TransitCalculator = async ({ utc }) => {
      const phase = (new Date(utc).getTime() - from) / DAY;
      return {
        bodies: [
          {
            id: 'mercury',
            name: 'Mercury',
            longitude: normalize(359 + 20 * Math.sin(2 * Math.PI * phase)),
          },
        ],
      };
    };
    const prepared = await prepareTransitAnimation(calculate, from, to, signal());
    expect(prepared.frames).toBeGreaterThan(30);
    expect(prepared.durationMs).toBeGreaterThan(1000);
    for (let i = 0; i < prepared.frames; i++) {
      const a = await calculate({ utc: new Date(from + (DAY * i) / prepared.frames) });
      const b = await calculate({ utc: new Date(from + (DAY * (i + 1)) / prepared.frames) });
      for (const fraction of [0.25, 0.5, 0.75]) {
        const exact = await calculate({
          utc: new Date(from + (DAY * (i + fraction)) / prepared.frames),
        });
        const chord = normalize(
          a.bodies[0]!.longitude +
            fraction * signedDistance(a.bodies[0]!.longitude, b.bodies[0]!.longitude),
        );
        expect(angularDistance(exact.bodies[0]!.longitude, chord)).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it('refines around a reversal and limits short transitions to sub-day samples', async () => {
    const from = Date.UTC(2024, 0, 1),
      to = from + 7 * DAY;
    const calculate: TransitCalculator = async ({ utc }) => {
      const days = (new Date(utc).getTime() - from) / DAY;
      return {
        bodies: [
          {
            id: 'mercury',
            name: 'Mercury',
            longitude: 100 + 0.005 * (days - 3.5) ** 2,
            speed: 0.01 * (days - 3.5),
          },
        ],
      };
    };
    const prepared = await prepareTransitAnimation(calculate, from, to, signal());
    expect((to - from) / prepared.frames).toBeLessThanOrEqual(DAY / 4);
    const reverse = await prepareTransitAnimation(calculate, to, from, signal());
    expect(reverse.frames).toBe(prepared.frames);
    expect(reverse.durationMs).toBe(prepared.durationMs);
  });

  it('rejects changing identity and invalid intermediate samples without mutating inputs', async () => {
    const from = Date.UTC(2024, 0, 1);
    const first: ChartInput = { bodies: [{ id: 'saturn', name: 'Saturn', longitude: 10 }] };
    await expect(
      prepareTransitAnimation(
        async ({ utc }) =>
          new Date(utc).getTime() === from
            ? first
            : { bodies: [{ id: 'other', name: 'Other', longitude: 10 }] },
        from,
        from + 30 * DAY,
        signal(),
      ),
    ).rejects.toThrow('stable');
    await expect(
      prepareTransitAnimation(
        async ({ utc }) =>
          new Date(utc).getTime() === from
            ? first
            : { bodies: [{ id: 'saturn', name: 'Saturn', longitude: NaN }] },
        from,
        from + DAY,
        signal(),
      ),
    ).rejects.toThrow();
    expect(Object.isFrozen(first)).toBe(false);
    expect(first.bodies[0]!.longitude).toBe(10);
  });

  it('supports provider-specific outer-body IDs for long-step trajectory protection', async () => {
    const from = Date.UTC(2024, 0, 1),
      to = from + 30 * DAY;
    const calculate: TransitCalculator = async ({ utc }) => {
      const day = (new Date(utc).getTime() - from) / DAY;
      return {
        bodies: [
          {
            id: 'custom-outer',
            name: 'Outer',
            longitude: normalize(359 + 20 * Math.sin(2 * Math.PI * day)),
          },
        ],
      };
    };
    const coarse = await prepareTransitAnimation(calculate, from, to, signal());
    const detailed = await prepareTransitAnimation(
      calculate,
      from,
      to,
      signal(),
      new Set(['custom-outer']),
    );
    expect(detailed.frames).toBeGreaterThan(coarse.frames);
    expect(detailed.durationMs).toBeGreaterThan(coarse.durationMs);
  });

  // Public reference year; this tests animation resolution against direct provider
  // calculations, not the independent astronomical accuracy of that provider.
  it('retains every outer-planet retrograde loop in a leap year within one day and 0.05 degrees', async () => {
    const from = Date.UTC(2024, 0, 1),
      to = Date.UTC(2025, 0, 1);
    const provider = createAstronomyProvider();
    const outer = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const prepared = await prepareTransitAnimation(provider.calculateTransits, from, to, signal());
    const gap = (to - from) / prepared.frames;
    expect(gap).toBeLessThanOrEqual(DAY);
    expect(prepared.durationMs).toBeGreaterThanOrEqual(15000);
    const samples = [prepared.first];
    for (let i = 1; i <= prepared.frames; i++)
      samples.push(await provider.calculateTransits({ utc: new Date(from + gap * i) }));
    const turns = new Map(outer.map((id) => [id, [] as number[]]));
    for (let i = 1; i < samples.length; i++) {
      for (const id of outer) {
        const a = samples[i - 1]!.bodies.find((body) => body.id === id)!;
        const b = samples[i]!.bodies.find((body) => body.id === id)!;
        if (a.speed! * b.speed! < 0) turns.get(id)!.push(from + gap * (i - 0.5));
      }
    }
    const referenceTurns = new Map(outer.map((id) => [id, [] as number[]]));
    let previous = prepared.first;
    for (let time = from + DAY / 4; time <= to; time += DAY / 4) {
      const exact = await provider.calculateTransits({ utc: new Date(time) });
      const index = Math.min(prepared.frames - 1, Math.floor((time - from) / gap));
      const fraction = (time - from) / gap - index;
      for (const id of outer) {
        const a = samples[index]!.bodies.find((body) => body.id === id)!;
        const b = samples[index + 1]!.bodies.find((body) => body.id === id)!;
        const body = exact.bodies.find((body) => body.id === id)!;
        const chord = normalize(a.longitude + fraction * signedDistance(a.longitude, b.longitude));
        expect(angularDistance(body.longitude, chord)).toBeLessThanOrEqual(0.05);
        if (previous.bodies.find((point) => point.id === id)!.speed! * body.speed! < 0)
          referenceTurns.get(id)!.push(time - DAY / 8);
      }
      previous = exact;
    }
    for (const id of outer) {
      expect(referenceTurns.get(id)!.length).toBeGreaterThanOrEqual(1);
      expect(turns.get(id)).toHaveLength(referenceTurns.get(id)!.length);
      for (const time of referenceTurns.get(id)!)
        expect(
          Math.min(...turns.get(id)!.map((turn) => Math.abs(turn - time))),
        ).toBeLessThanOrEqual(DAY);
    }
  }, 20000);
});
