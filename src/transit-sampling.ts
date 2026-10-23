import { angularDistance, normalize, signedDistance } from './model/math.js';
import { createModel } from './model/model.js';
import type { ChartInput } from './model/types.js';

export type TransitCalculator = (
  request: { utc: Date | string },
  options?: { signal?: AbortSignal },
) => Promise<ChartInput>;

const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const FRAME_MS = 1000 / 30;
const OUTER = new Set(['jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
const MAX_FRAMES = 8192;

export function animationTime(value: Date | string): number {
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    throw new RangeError('Animation times must include Z or an explicit timezone offset.');
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2100
  )
    throw new RangeError('Choose an animation time from 1900 through 2100 UTC.');
  return date.getTime();
}

export async function transitSample(
  calculate: TransitCalculator,
  time: number,
  signal: AbortSignal,
): Promise<ChartInput> {
  signal.throwIfAborted();
  const data = await calculate({ utc: new Date(time) }, { signal });
  signal.throwIfAborted();
  createModel(data); // Reject invalid samples before they can replace a valid chart.
  return data;
}

/** Uniform time spacing keeps the clock steady; refinement changes the speed cap. */
export async function prepareTransitAnimation(
  calculate: TransitCalculator,
  from: number,
  to: number,
  signal: AbortSignal,
  outerBodyIds: ReadonlySet<string> = OUTER,
) {
  const span = Math.abs(to - from);
  const short = span <= 7 * DAY;
  const maxGap = short ? 6 * HOUR : DAY;
  const preferredDuration =
    span <= HOUR
      ? 600
      : span <= DAY
        ? 1000
        : span <= 7 * DAY
          ? 2000
          : span <= 31 * DAY
            ? 4000
            : 15000;
  let frames = Math.max(1, Math.ceil(span / maxGap), Math.ceil(preferredDuration / FRAME_MS));
  const first = await transitSample(calculate, from, signal);
  // Only three samples are retained during preflight, even for a year-long step.
  while (frames <= MAX_FRAMES) {
    let before = first;
    let refine = false;
    const gap = span / frames;
    for (let i = 1; i <= frames; i++) {
      const middle = await transitSample(
        calculate,
        from + ((to - from) * (i - 0.5)) / frames,
        signal,
      );
      const after = await transitSample(calculate, from + ((to - from) * i) / frames, signal);
      const midBodies = new Map(middle.bodies.map((body) => [body.id, body]));
      const endBodies = new Map(after.bodies.map((body) => [body.id, body]));
      if (
        before.bodies.length !== midBodies.size ||
        before.bodies.length !== endBodies.size ||
        before.bodies.some((body) => !midBodies.has(body.id) || !endBodies.has(body.id))
      )
        throw new RangeError('Animated body IDs must remain stable.');
      for (const a of before.bodies) {
        if (!short && !outerBodyIds.has(a.id)) continue;
        const m = midBodies.get(a.id),
          b = endBodies.get(a.id);
        if (!m || !b) throw new RangeError('Animated body IDs must remain stable.');
        const chordMiddle = normalize(a.longitude + signedDistance(a.longitude, b.longitude) / 2);
        const turns =
          signedDistance(a.longitude, m.longitude) * signedDistance(m.longitude, b.longitude) < 0 ||
          (a.speed !== undefined && b.speed !== undefined && a.speed * b.speed < 0);
        if (angularDistance(m.longitude, chordMiddle) > 0.05 || (turns && gap > maxGap / 2)) {
          refine = true;
          break;
        }
      }
      if (refine) break;
      before = after;
    }
    if (!refine)
      return {
        first,
        frames,
        durationMs: Math.max(preferredDuration, Math.ceil((frames * 1000) / 30)),
      };
    frames *= 2;
  }
  throw new RangeError(
    'This trajectory needs too many animation samples. Choose a shorter interval.',
  );
}
