import { normalize, SIGN_GLYPHS } from './model/math.js';

export interface ChartText {
  glyph: number;
  number: number;
  scale: number;
  caption: number;
  tier: string;
}

/** Effective scale includes both the viewport and camera zoom. */
export function chartText(scale: number): ChartText {
  if (scale < 0.65)
    return {
      glyph: Math.max(10, Math.round(((14 * scale) / 0.65) * 2) / 2),
      number: 8,
      scale: 0,
      caption: 0,
      tier: 'small',
    };
  if (scale < 0.9) return { glyph: 18, number: 9, scale: 0, caption: 0, tier: 'medium' };
  if (scale < 1.6) return { glyph: 24, number: 10, scale: 9, caption: 10, tier: 'large' };
  return { glyph: 32, number: 13, scale: 12, caption: 13, tier: 'largest' };
}

export interface TextSize {
  width: number;
  height: number;
}
export interface TextSpec {
  text: string;
  size: number;
  className?: string;
  caption?: string;
  captionSize?: number;
  body?: boolean;
  compact?: boolean;
  radial?: boolean;
  /** Clockwise screen angle; omitted radial measurements reserve any angle. */
  rotation?: number;
}

export interface RadialTextRun extends TextSize {
  text: string;
  size: number;
  caption: boolean;
  x: number;
  characters: { text: string; x: number }[];
}
export interface RadialTextLayout extends TextSize {
  runs: RadialTextRun[];
}
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Space upright characters along a radial baseline without overlapping them. */
export function layoutRadialText(
  spec: TextSpec,
  measure: (spec: TextSpec) => TextSize,
): RadialTextLayout {
  const angle = ((spec.rotation ?? 0) * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(angle)),
    sine = Math.abs(Math.sin(angle));
  const runs: RadialTextRun[] = [];
  for (const [text, size, caption] of [
    [spec.text, spec.size, false],
    [spec.caption ?? '', spec.captionSize ?? 10, true],
  ] as const) {
    if (!text) continue;
    let width = 0,
      height = 0;
    const characters = [...segmenter.segment(text)].map(({ segment }) => {
      const measured = measure({
        text: segment,
        size,
        className: caption ? 'astr3-caption' : 'astr3-symbol',
      });
      const along =
        spec.rotation === undefined
          ? Math.hypot(measured.width, measured.height)
          : measured.width * cosine + measured.height * sine;
      const across =
        spec.rotation === undefined
          ? Math.hypot(measured.width, measured.height)
          : measured.width * sine + measured.height * cosine;
      const character = { text: segment, x: width + along / 2 };
      width += along;
      height = Math.max(height, across);
      return character;
    });
    for (const character of characters) character.x -= width / 2;
    runs.push({ text, size, caption, x: 0, width, height, characters });
  }
  const contentWidth =
    runs.reduce((width, run) => width + run.width, 0) + Math.max(0, runs.length - 1) * 4;
  let offset = -contentWidth / 2;
  for (const run of runs) {
    run.x = offset + run.width / 2;
    offset += run.width + 4;
  }
  return {
    width: contentWidth + 8,
    height: Math.max(0, ...runs.map((run) => run.height)) + 6,
    runs,
  };
}

/** Measures cache misses in an invisible probe, never in the live chart labels. */
export function createTextMeasurer(root: HTMLElement) {
  const doc = root.ownerDocument;
  const probe = doc.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;contain:layout style';
  root.append(probe);
  const cache = new Map<string, TextSize>();
  let styleKey = '';
  const measurer = {
    reset() {
      cache.clear();
    },
    style(key: string) {
      if (key !== styleKey) {
        cache.clear();
        styleKey = key;
        return true;
      }
      return false;
    },
    measure(spec: TextSpec): TextSize {
      const key = JSON.stringify(spec);
      const cached = cache.get(key);
      if (cached) return cached;
      if (spec.radial) {
        const size = layoutRadialText(spec, (part) => measurer.measure(part));
        if (cache.size >= 2048) cache.clear();
        cache.set(key, size);
        return size;
      }
      const element = doc.createElement('span');
      element.className = `astr3-label ${spec.className ?? ''}${spec.body ? ' astr3-body' : ''}`;
      element.style.fontSize = `${spec.size}px`;
      if (spec.body) {
        element.dataset.compact = String(!!spec.compact);
        element.dataset.radial = String(!!spec.radial);
        const symbol = doc.createElement('span');
        symbol.className = 'astr3-symbol';
        symbol.textContent = spec.text;
        element.append(symbol);
      } else element.textContent = spec.text;
      if (spec.caption) {
        const caption = doc.createElement('small');
        caption.textContent = spec.caption;
        caption.style.fontSize = `${spec.captionSize}px`;
        element.append(caption);
      }
      probe.append(element);
      const rect = element.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      element.remove();
      if (cache.size >= 2048) cache.clear();
      cache.set(key, size);
      return size;
    },
    dispose() {
      cache.clear();
      probe.remove();
    },
  };
  return measurer;
}

/** Round once, carrying minutes into the next sign just like formatPosition. */
export function formatGlyphPosition(longitude: number): string {
  const minutes = Math.round(normalize(longitude) * 60) % 21600;
  return `${Math.floor((minutes % 1800) / 60)}° ${SIGN_GLYPHS[Math.floor(minutes / 1800)]} ${String(minutes % 60).padStart(2, '0')}′`;
}
