export function validateExportDimensions(width: number, height: number, ratio = 1): void {
  if (![width, height, ratio].every((value) => Number.isFinite(value) && value > 0))
    throw new RangeError('Export size and pixelRatio must be positive and finite.');
  const w = Math.round(width * ratio),
    h = Math.round(height * ratio);
  if (w < 1 || h < 1 || w > 8192 || h > 8192 || w * h > 32_000_000)
    throw new RangeError(
      'Export dimensions must be 1–8192 pixels per side and at most 32 million pixels.',
    );
}
