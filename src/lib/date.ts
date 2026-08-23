/**
 * Today's date as a local "YYYY-MM-DD" string. Deliberately not
 * `new Date().toISOString().slice(0, 10)` — `toISOString()` converts to UTC,
 * which can shift the date by a day depending on the timezone offset and
 * time-of-day, the same class of bug fixed by `parseLocalDate` in
 * `projection.ts`.
 */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
