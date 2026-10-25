export type TimeStep = 'hour' | 'day' | 'week' | 'month' | 'year';

/** Calendar operations in UTC; month steps clamp rather than overflowing. */
export function stepTransitTime(utc: string, unit: TimeStep, direction: number): string {
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime()) || ![-1, 1].includes(direction))
    throw new RangeError('Choose a valid UTC time and step direction.');
  if (unit === 'month' || unit === 'year') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    if (unit === 'year') date.setUTCFullYear(date.getUTCFullYear() + direction);
    else date.setUTCMonth(date.getUTCMonth() + direction);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else
    date.setTime(
      date.getTime() + direction * { hour: 3600000, day: 86400000, week: 604800000 }[unit],
    );
  if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100)
    throw new RangeError('Choose a transit time from 1900 through 2100 UTC.');
  return date.toISOString();
}
