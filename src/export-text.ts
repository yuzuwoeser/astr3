import { EXPORT_GLYPHS } from './export-font-data.js';
import type { TextSize, TextSpec } from './chart-text.js';
import type { ChartWeight } from './types.js';
import { weightProfile } from './wheel-drawing.js';

/** Variation selector 15 requests monochrome text, already guaranteed by paths. */
const characters = (text: string) => [...text].filter((character) => character !== '\ufe0e');
export function assertExportText(text: string): void {
  const missing = [
    ...new Set(characters(text).filter((character) => !Object.hasOwn(EXPORT_GLYPHS, character))),
  ];
  if (missing.length) {
    const names = missing.map(
      (character) =>
        `${JSON.stringify(character)} (U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`,
    );
    throw new Error(
      `Cannot export label ${JSON.stringify(text)}: unsupported characters ${names.join(', ')}.`,
    );
  }
}
export function exportRun(text: string, size: number) {
  assertExportText(text);
  let advance = 0,
    left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  const paths: { x: number; path: string }[] = [];
  for (const character of characters(text)) {
    const [width, x1, y1, x2, y2, path] = EXPORT_GLYPHS[character]!;
    if (path) {
      paths.push({ x: (advance * size) / 1000, path });
      left = Math.min(left, advance + x1);
      right = Math.max(right, advance + x2);
      top = Math.min(top, y1);
      bottom = Math.max(bottom, y2);
    }
    advance += width;
  }
  return {
    paths,
    size,
    left: (left * size) / 1000,
    width: ((Math.max(advance, right) - left) * size) / 1000,
    top: (top * size) / 1000,
    bottom: (bottom * size) / 1000,
  };
}
export function exportTextStroke(weight: ChartWeight | undefined, symbol: boolean): number {
  const profile = weightProfile(weight);
  // Synthetic emboldening matches the three visual weight levels without
  // shipping separate font files. Symbols also retain their explicit stroke.
  return (profile.fontWeight - 400) / 1000 + (symbol ? profile.symbolStroke : 0);
}
export function createExportMeasurer(weight: ChartWeight | undefined, innerBands: boolean) {
  const cache = new Map<string, TextSize>();
  return (spec: TextSpec): TextSize => {
    const key = JSON.stringify([
      spec.text,
      spec.size,
      spec.className,
      spec.caption,
      spec.captionSize,
      spec.body,
      spec.compact,
    ]);
    const cached = cache.get(key);
    if (cached) return cached;
    const symbol = !!spec.body || spec.className === 'astr3-symbol';
    const run = exportRun(spec.text, spec.size);
    const stroke = exportTextStroke(weight, symbol);
    let width = run.width + stroke;
    let height = Math.max(spec.size * 1.15, run.bottom - run.top + stroke);
    if (spec.caption) {
      const captionSize = spec.captionSize ?? 10;
      const caption = exportRun(spec.caption, captionSize);
      width = Math.max(
        width,
        caption.width +
          Math.max(0, [...spec.caption].length - 1) * captionSize * 0.01 +
          exportTextStroke(weight, false),
      );
      height += 2 + Math.max(captionSize * 1.15, caption.bottom - caption.top);
    }
    if (spec.body) {
      const tight = innerBands && spec.compact;
      width = Math.max(spec.compact ? 0 : 34, width + (tight ? 4 : 8));
      height += tight ? 2 : 6;
    }
    const result = { width, height };
    cache.set(key, result);
    return result;
  };
}
