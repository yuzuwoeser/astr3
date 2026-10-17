import { angularDistance, normalize, zodiacPosition } from './math.js';
import type {
  Aspect,
  AspectInput,
  AspectType,
  Body,
  BodyInput,
  ChartInput,
  ChartModel,
  ChartObject,
  House,
  ModelOptions,
  OrbConfig,
  Selection,
  SelectionDetails,
} from './types.js';

export const ASPECT_ANGLES: Readonly<Record<AspectType, number>> = Object.freeze({
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
});
export const DEFAULT_ORBS: Readonly<Record<AspectType, number>> = Object.freeze({
  conjunction: 8,
  sextile: 4,
  square: 6,
  trine: 6,
  opposition: 8,
});
export class ChartDataError extends Error {
  readonly code = 'INVALID_CHART_DATA';
  constructor(message: string) {
    super(message);
    this.name = 'ChartDataError';
  }
}
const fail = (message: string): never => {
  throw new ChartDataError(message);
};
function finite(value: number, path: string): number {
  if (!Number.isFinite(value)) fail(`${path} must be a finite number.`);
  return value;
}
function text(value: string, path: string): void {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} must be a nonempty string.`);
}
function checkOrbs(orbs: OrbConfig): void {
  for (const [type, value] of Object.entries(orbs)) {
    if (
      !Object.hasOwn(ASPECT_ANGLES, type) ||
      !Number.isFinite(value) ||
      value! < 0 ||
      value! > 180
    )
      fail(`Orb for ${type} must be between 0 and 180 degrees.`);
  }
}

export function calculateAspects(bodies: readonly BodyInput[], orbs: OrbConfig = {}): Aspect[] {
  checkOrbs(orbs);
  const limits = { ...DEFAULT_ORBS, ...orbs };
  const result: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!,
        b = bodies[j]!;
      const separation = angularDistance(a.longitude, b.longitude);
      // Large custom orbs can overlap: keep the closest exact aspect deterministically.
      const candidates = (Object.keys(ASPECT_ANGLES) as AspectType[])
        .map((type) => ({ type, orb: Math.abs(separation - ASPECT_ANGLES[type]) }))
        .filter(({ type, orb }) => orb <= limits[type] + 1e-10)
        .sort((x, y) => x.orb - y.orb);
      const hit = candidates[0];
      if (hit) {
        const ids = [a.id, b.id].sort();
        result.push({
          id: `aspect:${JSON.stringify(ids)}:${hit.type}`,
          bodyIds: [a.id, b.id],
          type: hit.type,
          angle: ASPECT_ANGLES[hit.type],
          separation,
          orb: hit.orb,
        });
      }
    }
  }
  return result;
}

/** Pure, framework-independent validation and normalization. Never mutates the input. */
export function createModel(input: ChartInput, options: ModelOptions = {}): ChartModel {
  if (!input || !Array.isArray(input.bodies)) fail('bodies must be an array.');
  checkOrbs(options.orbs ?? {});
  const ids = new Set<string>();
  function register(id: string, path: string): void {
    text(id, `${path}.id`);
    if (ids.has(id)) fail(`Duplicate ID "${id}" at ${path}. IDs must be unique across the chart.`);
    ids.add(id);
  }
  const bodies: Body[] = input.bodies.map((body, i) => {
    register(body.id, `bodies[${i}]`);
    text(body.name, `bodies[${i}].name`);
    if (body.latitude !== undefined && Math.abs(finite(body.latitude, `${body.id}.latitude`)) > 90)
      fail(`${body.id}.latitude must be in [-90, 90].`);
    if (body.speed !== undefined) finite(body.speed, `${body.id}.speed`);
    const longitude = normalize(finite(body.longitude, `${body.id}.longitude`));
    return {
      ...body,
      // A previously normalized model may be reused as input. Never carry its
      // derived house into a chart whose houses have since become unknown.
      house: undefined,
      longitude,
      ...zodiacPosition(longitude),
      retrograde: body.retrograde ?? (body.speed !== undefined && body.speed < 0),
    };
  });
  const bodyMap = new Map(bodies.map((body) => [body.id, body]));
  const houses: House[] = (input.houses ?? [])
    .map((house, i) => {
      register(house.id, `houses[${i}]`);
      if (!Number.isInteger(house.number) || house.number < 1 || house.number > 12)
        fail(`${house.id}.number must be an integer in [1, 12].`);
      return {
        ...house,
        longitude: normalize(finite(house.longitude, `${house.id}.longitude`)),
        bodyIds: [],
      };
    })
    .sort((a, b) => a.number - b.number);
  if (
    houses.length &&
    (houses.length !== 12 || new Set(houses.map((house) => house.number)).size !== 12)
  )
    fail('houses must contain exactly twelve uniquely numbered cusps, or be omitted.');
  if (houses.length) {
    const spans = houses.map((house, i) =>
      normalize(houses[(i + 1) % 12]!.longitude - house.longitude),
    );
    if (
      spans.some((span) => span <= 1e-8) ||
      Math.abs(spans.reduce((a, b) => a + b, 0) - 360) > 1e-6
    )
      fail('House cusps must advance once around the zodiac in house-number order.');
    for (const body of bodies) {
      const index = houses.findIndex(
        (house, i) => normalize(body.longitude - house.longitude) < spans[i]!,
      );
      Object.assign(body, { house: houses[index]!.number });
    }
    for (const house of houses)
      (house as { bodyIds: readonly string[] }).bodyIds = bodies
        .filter((body) => body.house === house.number)
        .map((body) => body.id);
  }
  const angles = { ...input.angles };
  for (const key of ['ascendant', 'midheaven'] as const)
    if (angles[key] !== undefined) angles[key] = normalize(finite(angles[key], `angles.${key}`));
  if (
    input.houseStatus &&
    input.houseStatus !== 'available' &&
    input.houseStatus !== 'unknown' &&
    input.houseStatus !== 'unavailable'
  )
    fail('Invalid houseStatus.');
  if (input.houseStatus === 'available' && !houses.length)
    fail('houseStatus "available" requires twelve cusps.');
  if (input.houseStatus && input.houseStatus !== 'available' && houses.length)
    fail('Unknown or unavailable houses cannot have cusps.');
  const aspects =
    input.aspects === undefined
      ? calculateAspects(bodies, options.orbs)
      : input.aspects.map((aspect: AspectInput) => {
          if (!Object.hasOwn(ASPECT_ANGLES, aspect.type))
            fail(`Unsupported aspect type "${aspect.type}".`);
          if (
            !Array.isArray(aspect.bodyIds) ||
            aspect.bodyIds.length !== 2 ||
            aspect.bodyIds[0] === aspect.bodyIds[1]
          )
            fail(`${aspect.id} requires two distinct body IDs.`);
          for (const id of aspect.bodyIds)
            if (!bodyMap.has(id)) fail(`${aspect.id} references missing body "${id}".`);
          const separation = angularDistance(
            bodyMap.get(aspect.bodyIds[0])!.longitude,
            bodyMap.get(aspect.bodyIds[1])!.longitude,
          );
          return {
            ...aspect,
            bodyIds: [...aspect.bodyIds] as [string, string],
            angle: ASPECT_ANGLES[aspect.type],
            separation,
            orb: Math.abs(separation - ASPECT_ANGLES[aspect.type]),
          };
        });
  for (const aspect of aspects) register(aspect.id, 'aspects');
  const aspectIds = new Set(aspects.map((aspect) => aspect.id));
  const groups = (input.groups ?? []).map((group) => {
    register(group.id, 'groups');
    text(group.name, `${group.id}.name`);
    if (
      !Array.isArray(group.bodyIds) ||
      !Array.isArray(group.aspectIds) ||
      (!group.bodyIds.length && !group.aspectIds.length)
    )
      fail(`${group.id} needs bodyIds or aspectIds.`);
    for (const id of group.bodyIds)
      if (!bodyMap.has(id)) fail(`${group.id} references missing body "${id}".`);
    for (const id of group.aspectIds)
      if (!aspectIds.has(id)) fail(`${group.id} references missing aspect "${id}".`);
    return {
      ...group,
      bodyIds: [...new Set(group.bodyIds)],
      aspectIds: [...new Set(group.aspectIds)],
    };
  });
  const model: ChartModel = {
    title: input.title ?? 'Natal chart',
    bodies,
    houses,
    aspects,
    groups,
    angles,
    timeUncertain: input.timeUncertain ?? false,
    houseStatus: input.houseStatus ?? (houses.length ? 'available' : 'unknown'),
    warnings: [...(input.warnings ?? [])],
    metadata: input.metadata,
  };
  // Freeze normalized structures; application-owned metadata remains opaque and is never modified.
  for (const object of [...bodies, ...houses, ...aspects, ...groups]) {
    if ('bodyIds' in object) Object.freeze(object.bodyIds);
    if ('aspectIds' in object) Object.freeze(object.aspectIds);
    Object.freeze(object);
  }
  for (const array of [bodies, houses, aspects, groups, model.warnings]) Object.freeze(array);
  Object.freeze(angles);
  return Object.freeze(model);
}

export const selectionKey = (selection: Selection): string => `${selection.kind}:${selection.id}`;
function findObject(model: ChartModel, selection: Selection): ChartObject | undefined {
  const collection = {
    body: model.bodies,
    house: model.houses,
    aspect: model.aspects,
    group: model.groups,
  }[selection.kind];
  return collection?.find((object) => object.id === selection.id);
}
export function hasSelection(model: ChartModel, selection: Selection): boolean {
  return !!findObject(model, selection);
}

export function getSelectionDetails(
  model: ChartModel,
  selection: Selection,
): SelectionDetails | null {
  const object = findObject(model, selection);
  if (!object) return null;
  const bodyIds = new Set<string>(),
    aspectIds = new Set<string>();
  if (selection.kind === 'body') {
    bodyIds.add(selection.id);
    for (const aspect of model.aspects)
      if (aspect.bodyIds.includes(selection.id)) aspectIds.add(aspect.id);
  } else if (selection.kind === 'aspect') aspectIds.add(selection.id);
  else if (selection.kind === 'house')
    for (const id of model.houses.find((house) => house.id === selection.id)!.bodyIds)
      bodyIds.add(id);
  else {
    const group = model.groups.find((group) => group.id === selection.id)!;
    for (const id of group.bodyIds) bodyIds.add(id);
    for (const id of group.aspectIds) aspectIds.add(id);
  }
  const aspects = model.aspects.filter((aspect) => aspectIds.has(aspect.id));
  for (const aspect of aspects) for (const id of aspect.bodyIds) bodyIds.add(id);
  const bodies = model.bodies.filter((body) => bodyIds.has(body.id));
  const houses = model.houses.filter(
    (house) =>
      (selection.kind === 'house' && house.id === selection.id) ||
      bodies.some((body) => body.house === house.number),
  );
  const groups = model.groups.filter(
    (group) =>
      (selection.kind === 'group' && group.id === selection.id) ||
      group.bodyIds.some((id) => bodyIds.has(id)) ||
      group.aspectIds.some((id) => aspectIds.has(id)),
  );
  return { selection, object, bodies, houses, aspects, groups };
}
