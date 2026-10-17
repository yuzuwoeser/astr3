/** All longitudes are tropical ecliptic degrees unless the caller documents another convention. */
export interface BodyInput {
  readonly id: string;
  readonly name: string;
  readonly longitude: number;
  readonly latitude?: number;
  readonly speed?: number;
  readonly retrograde?: boolean;
  readonly glyph?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface HouseInput {
  readonly id: string;
  readonly number: number;
  readonly longitude: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChartAngles {
  readonly ascendant?: number;
  readonly midheaven?: number;
}

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export interface AspectInput {
  readonly id: string;
  readonly type: AspectType;
  readonly bodyIds: readonly [string, string];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GroupInput {
  readonly id: string;
  readonly name: string;
  readonly bodyIds: readonly string[];
  readonly aspectIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type HouseStatus = 'available' | 'unknown' | 'unavailable';
export interface ChartInput {
  readonly title?: string;
  readonly bodies: readonly BodyInput[];
  /** Omit when unknown. If supplied, provide twelve cusps in zodiac order. */
  readonly houses?: readonly HouseInput[];
  readonly angles?: ChartAngles;
  /** Omitted: calculate. Empty array: deliberately display no aspects. */
  readonly aspects?: readonly AspectInput[];
  readonly groups?: readonly GroupInput[];
  readonly timeUncertain?: boolean;
  readonly houseStatus?: HouseStatus;
  readonly warnings?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ZodiacPosition {
  readonly sign: string;
  readonly signIndex: number;
  readonly degree: number;
}
export interface Body extends BodyInput, ZodiacPosition {
  readonly house?: number;
}
export interface Aspect extends AspectInput {
  readonly angle: number;
  readonly separation: number;
  readonly orb: number;
}
export interface House extends HouseInput {
  readonly bodyIds: readonly string[];
}

export interface ChartModel {
  readonly title: string;
  readonly bodies: readonly Body[];
  readonly houses: readonly House[];
  readonly aspects: readonly Aspect[];
  readonly groups: readonly GroupInput[];
  readonly angles: ChartAngles;
  readonly timeUncertain: boolean;
  readonly houseStatus: HouseStatus;
  readonly warnings: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type Selection =
  | { readonly kind: 'body'; readonly id: string }
  | { readonly kind: 'house'; readonly id: string }
  | { readonly kind: 'aspect'; readonly id: string }
  | { readonly kind: 'group'; readonly id: string };
export type ChartObject = Body | House | Aspect | GroupInput;

export interface SelectionDetails {
  readonly selection: Selection;
  readonly object: ChartObject;
  readonly bodies: readonly Body[];
  readonly houses: readonly House[];
  readonly aspects: readonly Aspect[];
  readonly groups: readonly GroupInput[];
}

export type OrbConfig = Partial<Record<AspectType, number>>;
export interface ModelOptions {
  readonly orbs?: OrbConfig;
}

export type HouseSystem = 'placidus' | 'whole-sign' | 'equal';
export interface CalculationRequest {
  /** Date, or an ISO timestamp with an explicit UTC/offset suffix. */
  readonly utc: Date | string;
  readonly latitude: number;
  readonly longitude: number;
  readonly houseSystem?: HouseSystem;
  readonly timeUncertain?: boolean;
}
export interface EphemerisProvider {
  calculate(request: CalculationRequest, options?: { signal?: AbortSignal }): Promise<ChartInput>;
}
