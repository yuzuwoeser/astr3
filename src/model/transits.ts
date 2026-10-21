import { angularDistance, normalize } from './math.js';
import { ASPECT_ANGLES, ChartDataError, DEFAULT_ORBS, createModel } from './model.js';
import type {
  Aspect,
  AspectType,
  Body,
  ChartInput,
  ChartModel,
  GroupInput,
  House,
  OrbConfig,
} from './types.js';

export type ChartSide = 'natal' | 'transit';
export type AspectFamily = ChartSide | 'cross';
export interface BodyReference {
  readonly chart: ChartSide;
  readonly id: string;
}
export interface CrossAspectInput {
  readonly id: string;
  readonly type: AspectType;
  readonly bodyRefs: readonly [BodyReference, BodyReference];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface CrossAspect extends CrossAspectInput {
  readonly angle: number;
  readonly separation: number;
  readonly orb: number;
}
export interface TransitChartInput {
  readonly natal: ChartInput;
  readonly transit: ChartInput;
  readonly crossAspects?: readonly CrossAspectInput[];
}
export type TransitOrbs = Partial<Record<AspectFamily, OrbConfig>>;
export interface TransitBody extends Body {
  readonly natalHouse?: number;
}
export interface TransitChartModel {
  readonly natal: ChartModel;
  readonly transit: Omit<ChartModel, 'bodies'> & { readonly bodies: readonly TransitBody[] };
  readonly crossAspects: readonly CrossAspect[];
}
export type TransitSelection =
  | { readonly kind: 'body' | 'group'; readonly chart: ChartSide; readonly id: string }
  | { readonly kind: 'house'; readonly chart: 'natal'; readonly id: string }
  | { readonly kind: 'aspect'; readonly chart: AspectFamily; readonly id: string };
export type ScopedBody =
  (Body & { readonly chart: 'natal' }) | (TransitBody & { readonly chart: 'transit' });
export type ScopedAspect =
  | (Aspect & {
      readonly chart: ChartSide;
      readonly bodyRefs: readonly [BodyReference, BodyReference];
    })
  | (CrossAspect & { readonly chart: 'cross' });
export type ScopedGroup = GroupInput & { readonly chart: ChartSide };
export interface TransitSelectionDetails {
  readonly selection: TransitSelection;
  readonly object: ScopedBody | ScopedAspect | ScopedGroup | (House & { readonly chart: 'natal' });
  readonly bodies: readonly ScopedBody[];
  readonly houses: readonly House[];
  readonly aspects: readonly ScopedAspect[];
  readonly groups: readonly ScopedGroup[];
}
export const transitSelectionKey = (reference: TransitSelection): string =>
  JSON.stringify([reference.chart, reference.kind, reference.id]);
export const bodyReferenceKey = (reference: BodyReference): string =>
  JSON.stringify([reference.chart, reference.id]);

/** Pure bi-wheel model. Transit houses/axes are intentionally not used. */
export function createTransitModel(
  input: TransitChartInput,
  options: { orbs?: TransitOrbs } = {},
): TransitChartModel {
  if (!input?.natal || !input?.transit)
    throw new ChartDataError('A transit chart requires natal and transit data.');
  const natal = createModel(input.natal, { orbs: options.orbs?.natal });
  const transit = createModel(
    { ...input.transit, houses: [], angles: {}, houseStatus: 'unknown' },
    { orbs: options.orbs?.transit },
  );
  // Validate cross limits even when the caller supplies an authoritative aspect list.
  createModel({ bodies: [] }, { orbs: options.orbs?.cross });
  const limits = { ...DEFAULT_ORBS, ...options.orbs?.cross };
  const refs = new Map<string, Body>();
  for (const [chart, model] of [
    ['natal', natal],
    ['transit', transit],
  ] as const)
    for (const body of model.bodies) refs.set(bodyReferenceKey({ chart, id: body.id }), body);
  let supplied = input.crossAspects;
  if (supplied === undefined) {
    const calculated: CrossAspectInput[] = [];
    for (const a of natal.bodies)
      for (const b of transit.bodies) {
        const separation = angularDistance(a.longitude, b.longitude);
        const hit = (Object.keys(ASPECT_ANGLES) as AspectType[])
          .map((type) => ({ type, orb: Math.abs(separation - ASPECT_ANGLES[type]) }))
          .filter(({ type, orb }) => orb <= limits[type] + 1e-10)
          .sort((a, b) => a.orb - b.orb)[0];
        if (hit)
          calculated.push({
            id: JSON.stringify([a.id, b.id, hit.type]),
            type: hit.type,
            bodyRefs: [
              { chart: 'natal', id: a.id },
              { chart: 'transit', id: b.id },
            ],
          });
      }
    supplied = calculated;
  }
  if (!Array.isArray(supplied)) throw new ChartDataError('crossAspects must be an array.');
  const ids = new Set<string>();
  const crossAspects = (supplied as readonly CrossAspectInput[]).map((aspect): CrossAspect => {
    if (!aspect || typeof aspect !== 'object')
      throw new ChartDataError('Cross aspects must be objects.');
    if (typeof aspect.id !== 'string' || !aspect.id.trim() || ids.has(aspect.id))
      throw new ChartDataError('Cross aspect IDs must be nonempty and unique.');
    ids.add(aspect.id);
    if (!Object.hasOwn(ASPECT_ANGLES, aspect.type))
      throw new ChartDataError('Unsupported cross aspect type.');
    if (
      !Array.isArray(aspect.bodyRefs) ||
      aspect.bodyRefs.length !== 2 ||
      new Set(aspect.bodyRefs.map((ref: BodyReference) => ref?.chart)).size !== 2 ||
      aspect.bodyRefs.some((ref: BodyReference) => !ref || !refs.has(bodyReferenceKey(ref)))
    )
      throw new ChartDataError(
        'A cross aspect needs one existing natal body and one existing transit body.',
      );
    const separation = angularDistance(
      ...(aspect.bodyRefs.map(
        (ref: BodyReference) => refs.get(bodyReferenceKey(ref))!.longitude,
      ) as [number, number]),
    );
    return Object.freeze({
      ...aspect,
      bodyRefs: Object.freeze(
        aspect.bodyRefs.map((ref: BodyReference) => Object.freeze({ ...ref })),
      ) as unknown as CrossAspect['bodyRefs'],
      angle: ASPECT_ANGLES[aspect.type],
      separation,
      orb: Math.abs(separation - ASPECT_ANGLES[aspect.type]),
    });
  });
  const bodies = transit.bodies.map((body) => {
    const house = natal.houses.find(
      (house, i) =>
        normalize(body.longitude - house.longitude) <
        normalize(natal.houses[(i + 1) % 12]!.longitude - house.longitude),
    );
    return Object.freeze({ ...body, natalHouse: house?.number });
  });
  return Object.freeze({
    natal,
    transit: Object.freeze({ ...transit, bodies: Object.freeze(bodies) }),
    crossAspects: Object.freeze(crossAspects),
  });
}

export function transitAspects(model: TransitChartModel): ScopedAspect[] {
  return [
    ...(['natal', 'transit'] as const).flatMap((chart) =>
      model[chart].aspects.map((aspect) => ({
        ...aspect,
        chart,
        bodyRefs: aspect.bodyIds.map((id) => ({ chart, id })) as [BodyReference, BodyReference],
      })),
    ),
    ...model.crossAspects.map((aspect) => ({ ...aspect, chart: 'cross' as const })),
  ];
}

export function getTransitSelectionDetails(
  model: TransitChartModel,
  selection: TransitSelection,
): TransitSelectionDetails | null {
  if (!selection || !['body', 'aspect', 'group', 'house'].includes(selection.kind)) return null;
  const allBodies: ScopedBody[] = [
    ...model.natal.bodies.map((body) => ({ ...body, chart: 'natal' as const })),
    ...model.transit.bodies.map((body) => ({ ...body, chart: 'transit' as const })),
  ];
  const allAspects = transitAspects(model);
  const allGroups: ScopedGroup[] = (['natal', 'transit'] as const).flatMap((chart) =>
    model[chart].groups.map((group) => ({ ...group, chart })),
  );
  const object =
    selection.kind === 'body'
      ? allBodies.find((body) => body.chart === selection.chart && body.id === selection.id)
      : selection.kind === 'aspect'
        ? allAspects.find(
            (aspect) => aspect.chart === selection.chart && aspect.id === selection.id,
          )
        : selection.kind === 'group'
          ? allGroups.find((group) => group.chart === selection.chart && group.id === selection.id)
          : selection.chart === 'natal'
            ? model.natal.houses
                .map((house) => ({ ...house, chart: 'natal' as const }))
                .find((house) => house.id === selection.id)
            : undefined;
  if (!object) return null;
  const bodyKeys = new Set<string>(),
    aspectKeys = new Set<string>();
  const key = (aspect: ScopedAspect) =>
    transitSelectionKey({ kind: 'aspect', chart: aspect.chart, id: aspect.id });
  if (selection.kind === 'body') {
    bodyKeys.add(bodyReferenceKey(selection as BodyReference));
    for (const aspect of allAspects)
      if (
        aspect.bodyRefs.some(
          (ref: BodyReference) =>
            bodyReferenceKey(ref) === bodyReferenceKey(selection as BodyReference),
        )
      )
        aspectKeys.add(key(aspect));
  } else if (selection.kind === 'aspect') aspectKeys.add(transitSelectionKey(selection));
  else if (selection.kind === 'house') {
    const number = model.natal.houses.find((house) => house.id === selection.id)!.number;
    for (const body of allBodies)
      if ((body.chart === 'transit' ? (body as TransitBody).natalHouse : body.house) === number)
        bodyKeys.add(bodyReferenceKey(body));
  } else {
    const group = object as ScopedGroup;
    for (const id of group.bodyIds) bodyKeys.add(bodyReferenceKey({ chart: group.chart, id }));
    for (const id of group.aspectIds)
      aspectKeys.add(transitSelectionKey({ kind: 'aspect', chart: group.chart, id }));
  }
  const aspects = allAspects.filter((aspect) => aspectKeys.has(key(aspect)));
  for (const aspect of aspects)
    for (const ref of aspect.bodyRefs) bodyKeys.add(bodyReferenceKey(ref));
  const bodies = allBodies.filter((body) => bodyKeys.has(bodyReferenceKey(body)));
  const houses = model.natal.houses.filter(
    (house) =>
      (selection.kind === 'house' && house.id === selection.id) ||
      bodies.some(
        (body) =>
          (body.chart === 'transit' ? (body as TransitBody).natalHouse : body.house) ===
          house.number,
      ),
  );
  const groups = allGroups.filter(
    (group) =>
      (selection.kind === 'group' &&
        group.chart === selection.chart &&
        group.id === selection.id) ||
      group.bodyIds.some((id) => bodyKeys.has(bodyReferenceKey({ chart: group.chart, id }))) ||
      group.aspectIds.some((id) =>
        aspectKeys.has(transitSelectionKey({ kind: 'aspect', chart: group.chart, id })),
      ),
  );
  return { selection: { ...selection }, object, bodies, houses, aspects, groups };
}
