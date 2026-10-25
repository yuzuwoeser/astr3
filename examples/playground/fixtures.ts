import { ASPECT_DEFINITIONS, calculateAspects } from 'astr3/model';
import type { ChartInput } from 'astr3/model';

const bodies = [
  { id: 'sun', name: 'Sun', longitude: 78.4 },
  { id: 'moon', name: 'Moon', longitude: 198.9 },
  { id: 'mercury', name: 'Mercury', longitude: 91.7 },
  { id: 'venus', name: 'Venus', longitude: 48.2 },
  { id: 'mars', name: 'Mars', longitude: 157.2 },
  { id: 'jupiter', name: 'Jupiter', longitude: 318.1 },
  { id: 'saturn', name: 'Saturn', longitude: 276.9, retrograde: true },
  { id: 'uranus', name: 'Uranus', longitude: 337.1, retrograde: true },
  { id: 'neptune', name: 'Neptune', longitude: 302.5 },
  { id: 'pluto', name: 'Pluto', longitude: 245.4, retrograde: true },
  { id: 'ascendant', name: 'Ascendant', longitude: 13 },
  { id: 'midheaven', name: 'Midheaven', longitude: 278 },
  { id: 'north-node', name: 'North Node', longitude: 35.6, retrograde: true },
  { id: 'south-node', name: 'South Node', longitude: 215.6, retrograde: true },
];
// Supply every supported contact so the demo's minor-aspect switches can reveal
// them while the chart's default enablement keeps its original appearance.
const aspects = calculateAspects(
  bodies,
  {},
  Object.fromEntries(Object.keys(ASPECT_DEFINITIONS).map((type) => [type, true])),
);
const members = ['sun', 'moon', 'jupiter'];

/** Synthetic teaching fixture: supplied positions and an explicitly supplied group. */
export const study: ChartInput = {
  title: 'Grand trine study',
  bodies,
  aspects,
  houses: [13, 47, 73, 98, 124, 154, 193, 227, 253, 278, 304, 334].map((longitude, i) => ({
    id: `house-${i + 1}`,
    number: i + 1,
    longitude,
  })),
  angles: { ascendant: 13, midheaven: 278 },
  groups: [
    {
      id: 'air-grand-trine',
      name: 'Air grand trine',
      bodyIds: members,
      aspectIds: aspects
        .filter(
          (aspect) => aspect.type === 'trine' && aspect.bodyIds.every((id) => members.includes(id)),
        )
        .map((aspect) => aspect.id),
      metadata: {
        description:
          'Three trines connect the Sun, Moon, and Jupiter across the air signs. In Western astrology, this configuration is traditionally associated with an easy exchange of ideas and social understanding. Select its individual aspects to inspect the geometry and orbs.',
      },
    },
  ],
};
