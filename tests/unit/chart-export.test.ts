import { describe, expect, it } from 'vitest';
import { DARK_THEME } from '../../src/renderer.js';
import { renderSvg, escapeXml, exportColor } from '../../src/chart-export.js';
import type { ExportSnapshot } from '../../src/chart-export.js';
import { createModel } from '../../src/model/model.js';
import { BODY_GLYPHS, SIGN_GLYPHS } from '../../src/model/math.js';
import { buildWheelDrawing } from '../../src/wheel-drawing.js';
import { createExportMeasurer, exportRun, assertExportText } from '../../src/export-text.js';
import { validateExportDimensions } from '../../src/export-options.js';
import { resolveWheelGeometry } from '../../src/wheel-geometry.js';
import { boxesOverlap, polar } from '../../src/layout.js';
import type { ChartLayout } from '../../src/types.js';
import { formatGlyphPosition } from '../../src/chart-text.js';

function snapshot(layout: ChartLayout = 'default'): ExportSnapshot {
  const data = {
    title: 'Invented <wheel> & "study"',
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 5, retrograde: true },
      { id: 'moon', name: 'Moon', longitude: 125 },
      { id: 'mars', name: 'Mars', longitude: 245 },
    ],
    houses: Array.from({ length: 12 }, (_, i) => ({
      id: `h${i}`,
      number: i + 1,
      longitude: i * 30,
    })),
  };
  const geometry = resolveWheelGeometry(layout);
  return {
    model: createModel(data),
    options: { data, layout },
    colors: DARK_THEME,
    visible: {
      zodiac: true,
      bodies: true,
      houses: true,
      axes: true,
      aspects: true,
      groups: true,
      degrees: true,
    },
    geometry,
    view: {
      width: 1024,
      height: 1024,
      pan: { x: 0, y: 0 },
      pixelsPerUnit: 1024 / (2 * geometry.extent),
    },
    selected: null,
    outputWidth: 1024,
    outputHeight: 1024,
    transparent: false,
  };
}
const drawing = (input: ExportSnapshot) =>
  buildWheelDrawing({
    ...input,
    measure: createExportMeasurer(input.options.chartWeight, input.geometry.layout !== 'default'),
  });

describe('outlined chart exports', () => {
  it('covers built-in glyphs, printable ASCII, Latin-1, and all wheel captions', () => {
    const text = [
      ...Object.values(BODY_GLYPHS),
      ...SIGN_GLYPHS,
      'AC MC DC IC 29°59′ ℞ · Houses unknown',
      ...Array.from({ length: 95 }, (_, i) => String.fromCodePoint(i + 32)),
      ...Array.from({ length: 96 }, (_, i) => String.fromCodePoint(i + 160)),
    ].join('');
    expect(() => assertExportText(text)).not.toThrow();
    expect(exportRun(text, 24).paths.length).toBeGreaterThan(200);
    expect(exportRun('♈︎', 24)).toEqual(exportRun('♈', 24));
  });
  it('rejects unsupported labels with characters and code points', () => {
    const input = snapshot();
    input.options.glyphs = { sun: '☃中' };
    expect(() => renderSvg(input)).toThrow(/label "☃中".*U\+2603.*U\+4E2D/);
    input.options.bodyVisibility = { sun: false };
    expect(() => renderSvg(input)).not.toThrow();
  });
  it('writes standalone, deterministic vectors with escaped accessible text', () => {
    const input = snapshot();
    const svg = renderSvg(input);
    expect(svg).toBe(renderSvg(input));
    expect(svg).toContain('width="1024" height="1024"');
    expect(svg).toContain('Invented &lt;wheel&gt; &amp; &quot;study&quot;');
    expect(svg).toContain('clip-path="url(#wheel-clip)"');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<path transform=');
    expect(svg).not.toMatch(
      /<(?:text|image|script|foreignObject)\b|(?:href|style)=|data:|NaN|Infinity/,
    );
    expect(svg.indexOf('stroke-width=')).toBeLessThan(svg.indexOf('<path transform='));
    expect(escapeXml('a\u0000b\ud800<&')).toBe('a�b�&lt;&amp;');
  });
  it('uses explicit backgrounds, clipping, stroke weights and dashes', () => {
    const input = snapshot();
    input.options.chartWeight = 'bold';
    input.options.lineStyles = { trine: { width: 3, dash: [7, 2] } };
    const svg = renderSvg(input);
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('stroke-dasharray="7 2"');
    expect(svg).toContain('height="1024" fill="#111c20"');
    input.transparent = true;
    expect(renderSvg(input)).not.toContain('height="1024" fill="#111c20"');
  });
  for (const layout of ['default', 'alternative', 'advanced'] as const) {
    it(`packs outlined ${layout} labels inside their band without moving anchors`, () => {
      const input = snapshot(layout);
      const result = drawing(input);
      const labels = result.labels.filter((label) => label.body);
      expect(labels).toHaveLength(3);
      const scale = result.view.pixelsPerUnit;
      for (const label of labels) {
        const x = (label.x - 512) / scale,
          y = (512 - label.y) / scale;
        const halfWidth = label.box.width / scale / 2,
          halfHeight = label.box.height / scale / 2;
        expect(
          Math.hypot(Math.max(0, Math.abs(x) - halfWidth), Math.max(0, Math.abs(y) - halfHeight)),
        ).toBeGreaterThanOrEqual(input.geometry.natal.inner + 3.5 / scale);
        expect(Math.hypot(Math.abs(x) + halfWidth, Math.abs(y) + halfHeight)).toBeLessThanOrEqual(
          input.geometry.natal.outer - 3.5 / scale,
        );
        const anchor = polar(
          input.model.bodies.find((body) => body.id === label.selection!.id)!.longitude,
          input.geometry.anchor,
        );
        expect(
          result.shapes.some(
            (shape) =>
              shape.kind === 'disc' && shape.center.x === anchor.x && shape.center.y === anchor.y,
          ),
        ).toBe(true);
      }
      labels.forEach((a, i) =>
        labels
          .slice(i + 1)
          .forEach((b) => expect(boxesOverlap({ ...a, ...a.box }, { ...b, ...b.box })).toBe(false)),
      );
    });
  }
  it('renders full advanced positions with correctly rounded sign and minute boundaries', () => {
    const input = snapshot('advanced');
    expect(formatGlyphPosition(29.999)).toBe(`0° ${SIGN_GLYPHS[1]} 00′`);
    expect(formatGlyphPosition(359.999)).toBe(`0° ${SIGN_GLYPHS[0]} 00′`);
    expect(formatGlyphPosition(-0.02)).toBe(`29° ${SIGN_GLYPHS[11]} 59′`);
    const result = drawing(input);
    expect(result.labels.find((label) => label.selection?.id === 'sun')?.caption).toBe(
      `5° ${SIGN_GLYPHS[0]} 00′ ℞`,
    );
    expect(result.labels.filter((label) => label.className === 'astr3-cusp')).toHaveLength(12);
    expect(() => renderSvg(input)).not.toThrow();
    input.visible.degrees = false;
    const hidden = drawing(input);
    expect(
      hidden.labels.find((label) => label.body && label.selection?.id === 'sun')?.caption,
    ).toBe(' ℞');
    expect(hidden.labels.filter((label) => label.className === 'astr3-cusp')).toHaveLength(0);
  });

  it('omits colliding advanced cusp captions while retaining exact house sectors and axes', () => {
    const input = snapshot('advanced');
    const data = {
      ...input.options.data,
      houses: [0, 0.1, 0.2, 30, 60, 90, 120, 150, 180, 210, 240, 270].map((longitude, i) => ({
        id: `h${i}`,
        number: i + 1,
        longitude,
      })),
      angles: { ascendant: 0, midheaven: 270 },
    };
    input.model = createModel(data);
    input.options = { ...input.options, data };
    const result = drawing(input);
    const cusps = result.labels.filter((label) => label.className === 'astr3-cusp');
    expect(cusps.length).toBeGreaterThan(0);
    expect(cusps.length).toBeLessThan(12);
    const outer = result.labels.filter((label) =>
      ['astr3-cusp', 'astr3-axis'].includes(label.className ?? ''),
    );
    outer.forEach((a, i) =>
      outer.slice(i + 1).forEach((b) => {
        expect(boxesOverlap({ ...a, ...a.box }, { ...b, ...b.box })).toBe(false);
      }),
    );
    expect(
      result.targets.filter(
        (target) => target.shape === 'polygon' && target.selection.kind === 'house',
      ),
    ).toHaveLength(12);
    for (const label of cusps) {
      const house = input.model.houses.find((house) => house.id === label.selection!.id)!;
      const point = polar(house.longitude, input.geometry.house.cuspLabel!);
      expect(label.x).toBeCloseTo(512 + point.x * input.view.pixelsPerUnit);
      expect(label.y).toBeCloseTo(512 - point.y * input.view.pixelsPerUnit);
      expect(label.x - label.box.width / 2).toBeGreaterThanOrEqual(0);
      expect(label.x + label.box.width / 2).toBeLessThanOrEqual(1024);
      expect(label.y - label.box.height / 2).toBeGreaterThanOrEqual(0);
      expect(label.y + label.box.height / 2).toBeLessThanOrEqual(1024);
    }
    input.visible.houses = false;
    const hidden = drawing(input);
    expect(hidden.labels.some((label) => label.className === 'astr3-cusp')).toBe(false);
    expect(
      hidden.shapes.some(
        (shape) =>
          shape.kind === 'stroke' &&
          shape.points.length === 181 &&
          Math.abs(shape.points[0]!.x - input.geometry.anchor) < 1e-8,
      ),
    ).toBe(true);
    input.visible.houses = true;
    input.model = createModel({ bodies: input.model.bodies });
    expect(drawing(input).labels.some((label) => label.selection?.kind === 'house')).toBe(false);
  });
  it('retains crowding badges and meaningful unknown-house notices', () => {
    const input = snapshot();
    const data = {
      bodies: Array.from({ length: 55 }, (_, i) => ({
        id: `p${i}`,
        name: `Point ${i}`,
        longitude: i / 100,
        glyph: '☉',
      })),
      aspects: [],
    };
    input.model = createModel(data);
    input.options = { data };
    input.view = {
      ...input.view,
      width: 350,
      height: 350,
      pixelsPerUnit: 350 / (2 * input.geometry.extent),
    };
    const result = drawing(input);
    expect(result.badges.length).toBeGreaterThan(0);
    expect(result.notice).toContain('Houses unknown');
    expect(result.notice).toContain('cluster');
    expect(() => renderSvg(input)).not.toThrow();
  });
  it('never emits external paint references or XML attribute injection', () => {
    expect(() => exportColor('url(https://example.com/paint)')).toThrow();
    expect(() => exportColor('red" onload="alert(1)')).toThrow();
    expect(() => exportColor('var(--chart-color)')).toThrow();
    expect(exportColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
  });
  it('bounds SVG dimensions and raster memory before allocating', () => {
    for (const value of [0, -1, NaN, Infinity, 0.1])
      expect(() => validateExportDimensions(value, 1024)).toThrow(RangeError);
    expect(() => validateExportDimensions(8193, 1)).toThrow(RangeError);
    expect(() => validateExportDimensions(8192, 8192)).toThrow(RangeError);
    expect(() => validateExportDimensions(4096, 4096, 2)).toThrow(RangeError);
    expect(() => validateExportDimensions(1024, 1024, 2)).not.toThrow();
  });
});
