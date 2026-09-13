/**
 * Whether `date` collides with another entry already in `items` (excluding `excludeId`, the
 * entry being edited). Since a scheduled change only ever has a start date — it's in effect
 * until the next-dated entry takes over — "no overlapping ranges" reduces to this one rule:
 * no two entries in the same list may share a date. Shared between RateSchedule and
 * SalarySchedule, which both resolve their changes the same "latest date on or before" way.
 */
export function hasDateCollision<T extends { id: string; date: string }>(
  items: T[],
  excludeId: string,
  date: string
): boolean {
  return items.some((item) => item.id !== excludeId && item.date === date);
}

/**
 * The earliest date on/after `date` (ISO "YYYY-MM-DD") that doesn't collide with an existing
 * entry — used to pick a sane default when adding a new change. Built from local calendar
 * components throughout, never `toISOString()` — that converts to UTC, which can shift the
 * date backward a day depending on timezone offset, silently turning "add a day" into "add
 * nothing" and looping forever (the same class of bug `parseLocalDate`/`todayISO()` exist to
 * avoid elsewhere in this codebase).
 */
export function firstFreeDate<T extends { id: string; date: string }>(items: T[], date: string): string {
  let [y, m, d] = date.split('-').map(Number);
  while (items.some((item) => item.date === `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)) {
    const next = new Date(y, m - 1, d + 1); // Date normalises day/month overflow correctly
    y = next.getFullYear();
    m = next.getMonth() + 1;
    d = next.getDate();
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
