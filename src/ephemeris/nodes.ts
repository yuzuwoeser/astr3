import { GeoMoonState, RotateState, Rotation_EQJ_ECT } from 'astronomy-engine';
import { normalize, signedDistance } from '../model/math.js';
import type { BodyInput } from '../model/types.js';

/** Osculating ascending node, in the same true ecliptic/equinox of date as the planets. */
function northNode(date: Date): number {
  const state = RotateState(Rotation_EQJ_ECT(date), GeoMoonState(date));
  // h = r × v is normal to the instantaneous lunar orbital plane.
  // k × h = (-h.y, h.x, 0) points along its ascending intersection with the ecliptic.
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  return normalize((Math.atan2(hx, -hy) * 180) / Math.PI);
}

export function calculateLunarNodes(date: Date): BodyInput[] {
  const longitude = northNode(date);
  const before = northNode(new Date(date.getTime() - 30 * 60_000));
  const after = northNode(new Date(date.getTime() + 30 * 60_000));
  const speed = signedDistance(before, after) * 24;
  return (['north', 'south'] as const).map((direction) => ({
    id: `${direction}-node`,
    name: `${direction === 'north' ? 'North' : 'South'} Node`,
    longitude: normalize(longitude + (direction === 'south' ? 180 : 0)),
    latitude: 0,
    speed,
    retrograde: speed < 0,
    metadata: { nodeType: 'true' },
  }));
}
