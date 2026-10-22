import { ChartDataError } from './errors.js';
import type { AspectEnabledConfig, AspectType, OrbConfig } from './types.js';

interface AspectDefinition {
  readonly name: string;
  readonly angle: number;
  readonly orb: number;
  readonly major: boolean;
}

/** Insertion order preserves the original major-aspect priority for exact ties. */
export const ASPECT_DEFINITIONS: Readonly<Record<AspectType, AspectDefinition>> = Object.freeze({
  conjunction: Object.freeze({ name: 'Conjunction', angle: 0, orb: 8, major: true }),
  sextile: Object.freeze({ name: 'Sextile', angle: 60, orb: 4, major: true }),
  square: Object.freeze({ name: 'Square', angle: 90, orb: 6, major: true }),
  trine: Object.freeze({ name: 'Trine', angle: 120, orb: 6, major: true }),
  opposition: Object.freeze({ name: 'Opposition', angle: 180, orb: 8, major: true }),
  semisextile: Object.freeze({ name: 'Semi-sextile', angle: 30, orb: 2, major: false }),
  semisquare: Object.freeze({ name: 'Semi-square', angle: 45, orb: 2, major: false }),
  quintile: Object.freeze({ name: 'Quintile', angle: 72, orb: 2, major: false }),
  sesquiquadrate: Object.freeze({ name: 'Sesquiquadrate', angle: 135, orb: 2, major: false }),
  biquintile: Object.freeze({ name: 'Biquintile', angle: 144, orb: 2, major: false }),
  quincunx: Object.freeze({ name: 'Quincunx', angle: 150, orb: 3, major: false }),
});

const TYPES = Object.keys(ASPECT_DEFINITIONS) as AspectType[];
export const ASPECT_ANGLES: Readonly<Record<AspectType, number>> = Object.freeze(
  Object.fromEntries(TYPES.map((type) => [type, ASPECT_DEFINITIONS[type].angle])) as Record<
    AspectType,
    number
  >,
);
export const DEFAULT_ORBS: Readonly<Record<AspectType, number>> = Object.freeze(
  Object.fromEntries(TYPES.map((type) => [type, ASPECT_DEFINITIONS[type].orb])) as Record<
    AspectType,
    number
  >,
);
export const DEFAULT_ENABLED_ASPECTS: Readonly<Record<AspectType, boolean>> = Object.freeze(
  Object.fromEntries(TYPES.map((type) => [type, ASPECT_DEFINITIONS[type].major])) as Record<
    AspectType,
    boolean
  >,
);

export interface AspectSettings {
  orbs: Record<AspectType, number>;
  enabled: Record<AspectType, boolean>;
}

export function resolveAspectSettings(
  orbs: OrbConfig = {},
  enabledAspects: AspectEnabledConfig = {},
): AspectSettings {
  if (!orbs || typeof orbs !== 'object' || Array.isArray(orbs))
    throw new ChartDataError('Orb limits must be an aspect-to-degree map.');
  for (const [type, value] of Object.entries(orbs))
    if (
      !Object.hasOwn(ASPECT_DEFINITIONS, type) ||
      !Number.isFinite(value) ||
      value! < 0 ||
      value! > 180
    )
      throw new ChartDataError(`Orb for ${type} must be between 0 and 180 degrees.`);
  if (!enabledAspects || typeof enabledAspects !== 'object' || Array.isArray(enabledAspects))
    throw new ChartDataError('enabledAspects must be an aspect-to-boolean map.');
  for (const [type, value] of Object.entries(enabledAspects))
    if (!Object.hasOwn(ASPECT_DEFINITIONS, type) || typeof value !== 'boolean')
      throw new ChartDataError(
        `enabledAspects.${type} must name a supported aspect and be boolean.`,
      );
  return {
    orbs: { ...DEFAULT_ORBS, ...orbs },
    enabled: { ...DEFAULT_ENABLED_ASPECTS, ...enabledAspects },
  };
}

/** All orb matches, including disabled types, for validating supplied group references. */
export function aspectCandidates(separation: number, settings: AspectSettings) {
  return TYPES.map((type) => ({ type, orb: Math.abs(separation - ASPECT_ANGLES[type]) }))
    .filter(({ type, orb }) => orb <= settings.orbs[type] + 1e-10)
    .sort((a, b) => a.orb - b.orb);
}

export function matchAspect(separation: number, settings: AspectSettings) {
  return aspectCandidates(separation, settings).find(({ type }) => settings.enabled[type]);
}
