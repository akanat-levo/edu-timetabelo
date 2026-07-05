// Small date helpers. All dates are handled as local YYYY-MM-DD strings to
// avoid timezone drift from Date.toISOString().

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing d (weeks start Monday). */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const weekday = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - weekday);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Python-style weekday: 0 = Monday ... 6 = Sunday. */
export function pyWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function isWeekend(d: Date): boolean {
  const wd = pyWeekday(d);
  return wd === 5 || wd === 6;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatRange(start: Date, end: Date): string {
  const s = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
  const e = `${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
  return `${s} – ${e}`;
}
