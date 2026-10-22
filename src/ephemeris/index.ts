import { Body, Ecliptic, GeoVector, Rotation_ECT_EQD, SiderealTime } from 'astronomy-engine';
import { normalize, signedDistance } from '../model/math.js';
import type {
  BodyInput,
  CalculationRequest,
  ChartInput,
  EphemerisProvider,
} from '../model/types.js';
import { calculateHouses } from './houses.js';
import { calculateLunarNodes } from './nodes.js';

export { calculateHouses } from './houses.js';
export type { HouseCalculation } from './houses.js';
export type { EphemerisProvider, CalculationRequest, HouseSystem } from '../model/types.js';

const BODIES = [
  Body.Sun,
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
  Body.Pluto,
] as const;
export class CalculationError extends Error {
  readonly code = 'CALCULATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

function parseTime(request: { utc: Date | string }): Date {
  if (typeof request.utc === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(request.utc))
    throw new CalculationError('utc must include Z or an explicit timezone offset.');
  const date = new Date(request.utc);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2100
  )
    throw new CalculationError('The browser adapter supports UTC dates from 1900 through 2100.');
  return date;
}

function parseRequest(request: CalculationRequest): Date {
  const date = parseTime(request);
  if (
    !Number.isFinite(request.latitude) ||
    Math.abs(request.latitude) > 90 ||
    !Number.isFinite(request.longitude) ||
    Math.abs(request.longitude) > 180
  )
    throw new CalculationError(
      'Latitude must be in [-90, 90] and longitude in [-180, 180], east positive.',
    );
  if (request.houseSystem && !['placidus', 'whole-sign', 'equal'].includes(request.houseSystem))
    throw new CalculationError('Unsupported house system.');
  return date;
}

/** Optional browser/Node adapter. No network, DOM, timezone database, or WebGL. */
export interface AstronomyProvider extends EphemerisProvider {
  calculateTransits(
    request: { utc: Date | string },
    options?: { signal?: AbortSignal },
  ): Promise<ChartInput>;
}

async function calculatePositions(date: Date, signal?: AbortSignal): Promise<BodyInput[]> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  signal?.throwIfAborted();
  const before = new Date(date.getTime() - 30 * 60_000),
    after = new Date(date.getTime() + 30 * 60_000);
  const planets = BODIES.map((body) => {
    const position = Ecliptic(GeoVector(body, date, true));
    const earlier = Ecliptic(GeoVector(body, before, true)).elon;
    const later = Ecliptic(GeoVector(body, after, true)).elon;
    const speed = signedDistance(earlier, later) * 24;
    return {
      id: body.toLowerCase(),
      name: body,
      longitude: position.elon,
      latitude: position.elat,
      speed,
      retrograde: speed < 0,
    };
  });
  return [...planets, ...calculateLunarNodes(date)];
}

export function createAstronomyProvider(): AstronomyProvider {
  return {
    async calculateTransits(request, { signal } = {}) {
      signal?.throwIfAborted();
      const date = parseTime(request);
      const bodies = await calculatePositions(date, signal);
      signal?.throwIfAborted();
      return {
        title: 'Transits',
        bodies,
        metadata: {
          provider: 'astronomy-engine',
          utc: date.toISOString(),
          zodiac: 'tropical',
          frame: 'geocentric true ecliptic of date',
          aberration: true,
          lunarNodeType: 'true',
        },
      };
    },
    async calculate(request, { signal } = {}): Promise<ChartInput> {
      signal?.throwIfAborted();
      const date = parseRequest(request);
      const positions = await calculatePositions(date, signal);
      const rotation = Rotation_ECT_EQD(date).rot;
      const obliquity = (Math.atan2(rotation[1]![2]!, rotation[1]![1]!) * 180) / Math.PI;
      const system = request.houseSystem ?? 'placidus';
      const result = request.timeUncertain
        ? undefined
        : calculateHouses(
            normalize(SiderealTime(date) * 15 + request.longitude),
            request.latitude,
            obliquity,
            system,
          );
      signal?.throwIfAborted();
      return {
        title: 'Natal chart',
        bodies: [
          ...positions,
          ...(['ascendant', 'midheaven'] as const).flatMap((id): BodyInput[] => {
            const longitude = result?.angles[id];
            return longitude === undefined
              ? []
              : [{ id, name: id === 'ascendant' ? 'Ascendant' : 'Midheaven', longitude }];
          }),
        ],
        houses: result?.houses,
        angles: result?.angles,
        timeUncertain: request.timeUncertain ?? false,
        houseStatus: result?.status ?? 'unknown',
        warnings: [
          ...(request.timeUncertain
            ? [
                'Birth time is uncertain. Positions use the supplied reference instant; houses and angles are omitted.',
              ]
            : []),
          ...(result?.reason ? [result.reason] : []),
        ],
        metadata: {
          provider: 'astronomy-engine',
          utc: date.toISOString(),
          latitude: request.latitude,
          longitude: request.longitude,
          houseSystem: system,
          zodiac: 'tropical',
          frame: 'geocentric true ecliptic of date',
          aberration: true,
          lunarNodeType: 'true',
        },
      };
    },
  };
}
