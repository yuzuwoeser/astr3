export const SIGNS = Object.freeze([
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]);
// Text presentation prevents operating systems from substituting colored emoji tiles.
export const SIGN_GLYPHS = Object.freeze([
  '♈︎',
  '♉︎',
  '♊︎',
  '♋︎',
  '♌︎',
  '♍︎',
  '♎︎',
  '♏︎',
  '♐︎',
  '♑︎',
  '♒︎',
  '♓︎',
]);
export const BODY_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  'north-node': '☊',
  'south-node': '☋',
  chiron: '⚷',
});

export const normalize = (degrees: number): number => ((degrees % 360) + 360) % 360;
export const signedDistance = (from: number, to: number): number =>
  normalize(to - from + 180) - 180;
export const angularDistance = (a: number, b: number): number => Math.abs(signedDistance(a, b));

export function zodiacPosition(longitude: number) {
  const value = normalize(longitude);
  const signIndex = Math.floor(value / 30);
  return { sign: SIGNS[signIndex]!, signIndex, degree: value % 30 };
}

export function formatPosition(longitude: number): string {
  // Round once, carrying minutes into the next sign when needed.
  const minutes = Math.round(normalize(longitude) * 60) % 21600;
  const index = Math.floor(minutes / 1800);
  return `${Math.floor((minutes % 1800) / 60)}°${String(minutes % 60).padStart(2, '0')}′ ${SIGNS[index]}`;
}
