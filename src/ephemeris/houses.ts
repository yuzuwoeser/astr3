import { normalize } from '../model/math.js';
import type { ChartAngles, HouseInput, HouseSystem } from '../model/types.js';

const RAD = Math.PI / 180;
const degrees = (value: number) => value / RAD;

export interface HouseCalculation {
  readonly status: 'available' | 'unavailable';
  readonly houses?: readonly HouseInput[];
  readonly angles: ChartAngles;
  readonly reason?: string;
}

/**
 * Independent geometric implementation. Placidus divides each ecliptic point's
 * semi-diurnal arc in thirds. Solve RA(lambda) - RAMC = fraction * SDA(lambda)
 * by bisection; opposite cusps complete the wheel. No Swiss Ephemeris code.
 * siderealDegrees is LOCAL apparent sidereal time; obliquity is true of date.
 */
export function calculateHouses(
  siderealDegrees: number,
  latitude: number,
  obliquity: number,
  system: HouseSystem,
): HouseCalculation {
  if (
    ![siderealDegrees, latitude, obliquity].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    obliquity <= 0 ||
    obliquity >= 90
  )
    throw new RangeError('Invalid house calculation coordinates.');
  if (!['placidus', 'equal', 'whole-sign'].includes(system))
    throw new RangeError('Unsupported house system.');
  if (Math.abs(latitude) >= 89.999999)
    return {
      status: 'unavailable',
      angles: {},
      reason: 'The ascendant is undefined at the geographic poles.',
    };
  const theta = normalize(siderealDegrees) * RAD,
    phi = latitude * RAD,
    eps = obliquity * RAD;
  const midheaven = normalize(
    degrees(Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(eps))),
  );
  const ascendant = normalize(
    degrees(
      Math.atan2(
        Math.cos(theta),
        -(Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)),
      ),
    ),
  );
  const angles = { ascendant, midheaven };
  let cusps: number[];
  if (system === 'equal' || system === 'whole-sign') {
    const start = system === 'equal' ? ascendant : Math.floor(ascendant / 30) * 30;
    cusps = Array.from({ length: 12 }, (_, i) => normalize(start + i * 30));
  } else {
    if (Math.abs(latitude) >= 90 - obliquity)
      return {
        status: 'unavailable',
        angles,
        reason:
          'Placidus is unavailable at or beyond the polar circle. Choose Equal or Whole Sign houses.',
      };
    const ramc = normalize(siderealDegrees);
    const rightAscension = (longitude: number) => {
      const value = longitude * RAD;
      return normalize(degrees(Math.atan2(Math.sin(value) * Math.cos(eps), Math.cos(value))));
    };
    const solve = (fraction: number): number | undefined => {
      const east = fraction > 0;
      const residual = (longitude: number) => {
        const delta = Math.asin(Math.sin(eps) * Math.sin(longitude * RAD));
        const argument = -Math.tan(phi) * Math.tan(delta);
        if (Math.abs(argument) >= 1) return NaN;
        const sda = degrees(Math.acos(argument));
        let raOffset = normalize(rightAscension(longitude) - ramc);
        if (!east && raOffset > 1e-7) raOffset -= 360;
        return raOffset - fraction * sda;
      };
      let low = east ? midheaven : midheaven - 179.999999;
      let high = east ? midheaven + 179.999999 : midheaven;
      // Root is bracketed on the corresponding side of the meridian.
      for (let i = 0; i < 80; i++) {
        const middle = (low + high) / 2;
        const value = residual(middle);
        if (!Number.isFinite(value)) return undefined;
        if (Math.abs(value) < 1e-10) return normalize(middle);
        if (value < 0) low = middle;
        else high = middle;
      }
      const candidate = (low + high) / 2;
      return Math.abs(residual(candidate)) < 1e-7 ? normalize(candidate) : undefined;
    };
    const h11 = solve(1 / 3),
      h12 = solve(2 / 3),
      h9 = solve(-1 / 3),
      h8 = solve(-2 / 3);
    if ([h11, h12, h9, h8].some((value) => value === undefined))
      return {
        status: 'unavailable',
        angles,
        reason:
          'Placidus did not converge for these coordinates. Choose Equal or Whole Sign houses.',
      };
    cusps = [
      ascendant,
      normalize(h8! + 180),
      normalize(h9! + 180),
      normalize(midheaven + 180),
      normalize(h11! + 180),
      normalize(h12! + 180),
      normalize(ascendant + 180),
      h8!,
      h9!,
      midheaven,
      h11!,
      h12!,
    ];
  }
  return {
    status: 'available',
    angles,
    houses: cusps.map((longitude, i) => ({ id: `house-${i + 1}`, number: i + 1, longitude })),
  };
}
