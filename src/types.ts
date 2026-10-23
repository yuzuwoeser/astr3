import type {
  ChartInput,
  ChartModel,
  ModelOptions,
  Selection,
  SelectionDetails,
  AspectType,
} from './model/types.js';

export interface ChartTheme {
  background: string;
  foreground: string;
  muted: string;
  ring: string;
  accent: string;
  group: string;
  elements: readonly [string, string, string, string];
  aspects: Record<AspectType, string>;
}
export interface ChartLayers {
  zodiac: boolean;
  bodies: boolean;
  houses: boolean;
  axes: boolean;
  aspects: boolean;
  groups: boolean;
  degrees: boolean;
}
export interface LineStyle {
  width?: number;
  dash?: readonly [number, number];
}
export type ThemeOptions = Partial<Omit<ChartTheme, 'aspects'>> & {
  aspects?: Partial<ChartTheme['aspects']>;
};
export type ChartWeight = 'light' | 'regular' | 'bold';
export type ChartLayout = 'default' | 'alternative';
export interface ChartOptions extends ModelOptions {
  data: ChartInput;
  /** Ring arrangement. Defaults to the original layout. */
  layout?: ChartLayout;
  /** Visual stroke/text weight. Defaults to light for existing integrations. */
  chartWeight?: ChartWeight;
  theme?: ThemeOptions;
  glyphs?: Readonly<Record<string, string>>;
  layers?: Partial<ChartLayers>;
  lineStyles?: Partial<Record<AspectType, LineStyle>>;
  dimUnrelated?: boolean;
  selectionEffects?: { color?: string; dimOpacity?: number; lineWidth?: number };
  /** Display name for the synchronized accessible representation. */
  ariaLabel?: string;
}
export interface ChartError {
  readonly code: 'WEBGL_UNAVAILABLE' | 'CONTEXT_LOST';
  readonly message: string;
  readonly cause?: unknown;
}
export interface ChartEvents {
  dispose: undefined;
  selection: {
    selection: Selection | null;
    details: SelectionDetails | null;
    source: 'pointer' | 'keyboard' | 'programmatic' | 'update';
  };
  hover: { selection: Selection | null; details: SelectionDetails | null; x: number; y: number };
  update: { model: ChartModel };
  error: ChartError;
  view: { zoom: number; pan: { x: number; y: number } };
}
export interface Chart {
  readonly model: ChartModel;
  readonly selection: Selection | null;
  readonly element: HTMLElement;
  readonly error: ChartError | null;
  update(data: ChartInput): void;
  setOptions(options: Partial<Omit<ChartOptions, 'data'>>): void;
  select(selection: Selection | null): void;
  clearSelection(): void;
  resetView(): void;
  zoomBy(factor: number): void;
  on<K extends keyof ChartEvents>(
    event: K,
    listener: (payload: ChartEvents[K]) => void,
  ): () => void;
  dispose(): void;
}
