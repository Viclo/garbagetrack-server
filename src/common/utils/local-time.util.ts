import { DayOfWeek } from '../enums/day-of-week.enum';

export const OPERATIONAL_TIMEZONE = 'America/La_Paz';

/** Calendar date (YYYY-MM-DD) in the operational timezone. */
export function localDateString(now: Date = new Date()): string {
  // en-CA formats as ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const WEEKDAY_TO_ENUM: Record<string, DayOfWeek> = {
  Mon: DayOfWeek.MON,
  Tue: DayOfWeek.TUE,
  Wed: DayOfWeek.WED,
  Thu: DayOfWeek.THU,
  Fri: DayOfWeek.FRI,
  Sat: DayOfWeek.SAT,
  Sun: DayOfWeek.SUN,
};

/** Day of week in the operational timezone. Covers all 7 days; null only as a
 *  defensive fallback if the locale ever yields an unexpected weekday string. */
export function localDayOfWeek(now: Date = new Date()): DayOfWeek | null {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONAL_TIMEZONE,
    weekday: 'short',
  }).format(now);
  return WEEKDAY_TO_ENUM[weekday] ?? null;
}
