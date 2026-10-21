import type { ChartInput } from '../../src/model/index.js';

// Invented positions, independent of any person's birth information. The nearby
// Mercury/Pluto/Uranus trio exercises crowded labels beside the house circle.
export const syntheticNatal: ChartInput = {
  title: 'Synthetic clustered chart',
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 150 },
    { id: 'moon', name: 'Moon', longitude: 25 },
    { id: 'mercury', name: 'Mercury', longitude: 194.25, retrograde: true },
    { id: 'venus', name: 'Venus', longitude: 168 },
    { id: 'mars', name: 'Mars', longitude: 140 },
    { id: 'jupiter', name: 'Jupiter', longitude: 80 },
    { id: 'saturn', name: 'Saturn', longitude: 235 },
    { id: 'uranus', name: 'Uranus', longitude: 202.5 },
    { id: 'neptune', name: 'Neptune', longitude: 263 },
    { id: 'pluto', name: 'Pluto', longitude: 186 },
  ],
  houses: Array.from({ length: 12 }, (_, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    longitude: i * 30,
  })),
  angles: { ascendant: 0, midheaven: 270 },
};
