import type { ChartInput } from 'astr3';

// Invented teaching positions; no birth time, location, houses, or axes.
export function chartData(offset = 0): ChartInput {
  return {
    title: 'Synthetic trine study',
    bodies: [
      { id: 'sun', name: 'Sun', longitude: offset % 360 },
      { id: 'moon', name: 'Moon', longitude: (120 + offset) % 360 },
      { id: 'jupiter', name: 'Jupiter', longitude: (240 + offset) % 360 },
    ],
  };
}
