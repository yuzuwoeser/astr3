import { validateExportDimensions } from './export-options.js';
import { buildWheelDrawing, projectWheel } from './wheel-drawing.js';
import type { WheelDrawingInput, WheelLabel } from './wheel-drawing.js';
import { createExportMeasurer, exportRun, exportTextStroke } from './export-text.js';
import type { ChartWeight } from './types.js';

export interface ExportSnapshot extends Omit<WheelDrawingInput, 'measure' | 'cache'> {
  outputWidth: number;
  outputHeight: number;
  transparent: boolean;
}
// XML cannot contain lone surrogates or most controls, even when entity-escaped.
export const escapeXml = (value: string) =>
  value
    .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '\ufffd')
    .replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
    );
const number = (value: number) => String(Math.round(value * 10000) / 10000);

/** Only literal colors can enter SVG paint attributes; never URL paint servers. */
export function exportColor(value: string): string {
  if (
    /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]*\))$/i.test(value.trim()) &&
    !/^(?:currentcolor|inherit|initial|unset|revert)$/i.test(value.trim())
  )
    return escapeXml(value.trim());
  throw new Error(
    `Cannot export unsupported color ${JSON.stringify(value)}. Use a literal hex, named, rgb(), or hsl() color.`,
  );
}
function textPaths(
  text: string,
  size: number,
  x: number,
  y: number,
  color: string,
  weight: ChartWeight | undefined,
  symbol = false,
): string {
  const run = exportRun(text, size);
  const stroke = exportTextStroke(weight, symbol);
  const left = x - run.width / 2 - run.left;
  const baseline = y - (run.top + run.bottom) / 2;
  return `<g fill="${exportColor(color)}"${stroke ? ` stroke="${exportColor(color)}" stroke-width="${number(stroke)}" stroke-linejoin="round" paint-order="stroke fill"` : ''}>${run.paths
    .map(
      (glyph) =>
        `<path transform="translate(${number(left + glyph.x)} ${number(baseline)}) scale(${number(size / 1000)})"${stroke ? ` stroke-width="${number((stroke * 1000) / size)}"` : ''} d="${glyph.path}"/>`,
    )
    .join('')}</g>`;
}
function labelSvg(label: WheelLabel, snapshot: ExportSnapshot): string {
  const body = !!label.body;
  const { x, y, color, size, box } = label;
  const weight = snapshot.options.chartWeight;
  const accent = snapshot.options.selectionEffects?.color ?? snapshot.colors.accent;
  let result = `<g opacity="${number(label.opacity)}">`;
  if (body) {
    if (label.active)
      result += `<rect x="${number(x - box.width / 2 - 2)}" y="${number(y - box.height / 2 - 2)}" width="${number(box.width + 4)}" height="${number(box.height + 4)}" rx="9" fill="${exportColor(accent)}" opacity="0.18"/>`;
    result += `<rect x="${number(x - box.width / 2)}" y="${number(y - box.height / 2)}" width="${number(box.width)}" height="${number(box.height)}" rx="7" fill="${exportColor(snapshot.colors.background)}"${label.active ? ` stroke="${exportColor(accent)}"` : ''}/>`;
  }
  const captionHeight = label.caption ? (label.captionSize ?? 10) * 1.15 + 2 : 0;
  result += textPaths(
    label.text,
    size,
    x,
    y - captionHeight / 2,
    color,
    weight,
    body || label.className === 'astr3-symbol',
  );
  if (label.caption)
    result += textPaths(
      label.caption,
      label.captionSize ?? 10,
      x,
      y + (size * 1.15) / 2 + 1,
      color,
      weight,
    );
  return result + '</g>';
}
export function renderSvg(snapshot: ExportSnapshot): string {
  const drawing = buildWheelDrawing({
    ...snapshot,
    measure: createExportMeasurer(
      snapshot.options.chartWeight,
      snapshot.geometry.layout === 'alternative',
    ),
  });
  const project = (point: { x: number; y: number }) => projectWheel(point, drawing.view);
  const { outputWidth: width, outputHeight: height, colors } = snapshot;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(drawing.view.width)} ${number(drawing.view.height)}" role="img" aria-labelledby="chart-title chart-description">`,
    `<title id="chart-title">${escapeXml(snapshot.options.ariaLabel ?? snapshot.model.title)}</title>`,
    '<desc id="chart-description">ASTR3 astrology wheel. Text is outlined for portable display.</desc>',
    `<defs><clipPath id="wheel-clip"><rect width="${number(drawing.view.width)}" height="${number(drawing.view.height)}"/></clipPath></defs>`,
    '<g clip-path="url(#wheel-clip)">',
  ];
  if (!snapshot.transparent)
    parts.push(
      `<rect width="${number(drawing.view.width)}" height="${number(drawing.view.height)}" fill="${exportColor(colors.background)}"/>`,
    );
  for (const shape of drawing.shapes) {
    const paint = exportColor(shape.color);
    const opacity = number(shape.opacity);
    if (shape.kind === 'disc') {
      const point = project(shape.center);
      parts.push(
        `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="${number(shape.radius * drawing.view.pixelsPerUnit)}" fill="${paint}" opacity="${opacity}"/>`,
      );
    } else {
      const points = shape.points
        .map((point, i) => {
          const p = project(point);
          return `${i ? 'L' : 'M'}${number(p.x)} ${number(p.y)}`;
        })
        .join('');
      parts.push(
        shape.kind === 'fill'
          ? `<path d="${points}Z" fill="${paint}" opacity="${opacity}"/>`
          : `<path d="${points}" fill="none" stroke="${paint}" stroke-width="${number(shape.width)}" stroke-linecap="butt" stroke-linejoin="bevel" opacity="${opacity}"${shape.dash && shape.dash.every((value) => value > 0) ? ` stroke-dasharray="${shape.dash.map(number).join(' ')}"` : ''}/>`,
      );
    }
  }
  for (const label of drawing.labels) parts.push(labelSvg(label, snapshot));
  for (const badge of drawing.badges) {
    parts.push(
      `<g opacity="${number(badge.opacity)}"><rect x="${number(badge.x - badge.width / 2)}" y="${number(badge.y - badge.height / 2)}" width="${number(badge.width)}" height="${number(badge.height)}" rx="7" fill="${exportColor(colors.background)}" stroke="${exportColor(badge.active ? (snapshot.options.selectionEffects?.color ?? colors.accent) : colors.ring)}"/>${textPaths(String(badge.bodyIds.length), 12, badge.x, badge.y, badge.color, snapshot.options.chartWeight)}</g>`,
    );
  }
  if (drawing.notice) {
    // Wrap notices without a browser layout dependency. Keep each line inside
    // the same 70%-width region as the interactive overlay.
    const maxWidth = Math.max(1, drawing.view.width * 0.7);
    const lines: string[] = [];
    let line = '';
    const notice = drawing.notice
      .replace(
        'Choose a cluster or zoom in to reveal symbols',
        'Clustered bodies · export at a larger size to reveal symbols',
      )
      .replace(
        'Zoom in to reveal planet symbols',
        'Export at a larger size to reveal planet symbols',
      );
    for (const word of notice.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && exportRun(next, 11).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    lines.forEach((value, i) =>
      parts.push(
        textPaths(
          value,
          11,
          16 + exportRun(value, 11).width / 2,
          20 + i * 14,
          colors.muted,
          snapshot.options.chartWeight,
        ),
      ),
    );
  }
  parts.push('</g></svg>');
  return parts.join('');
}

export async function renderPng(
  snapshot: ExportSnapshot,
  doc: Document,
  pixelRatio: number,
): Promise<Blob> {
  validateExportDimensions(snapshot.outputWidth, snapshot.outputHeight, pixelRatio);
  const win = doc.defaultView;
  if (!win) throw new Error('PNG export requires a browser document.');
  const svg = renderSvg(snapshot);
  const url = win.URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = doc.createElement('img');
  const canvas = doc.createElement('canvas');
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode the exported SVG for PNG export.'));
      image.src = url;
    });
    canvas.width = Math.round(snapshot.outputWidth * pixelRatio);
    canvas.height = Math.round(snapshot.outputHeight * pixelRatio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG export requires a 2D canvas context.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the exported chart as PNG.'));
      }, 'image/png'),
    );
  } finally {
    image.onload = image.onerror = null;
    image.removeAttribute('src');
    win.URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
