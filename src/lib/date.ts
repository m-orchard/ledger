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

/** A compact "as of" label — "today", "3d ago", "5mo ago" — falling back to a short absolute date for future dates. */
export function formatRelativeDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays > 1 && diffDays < 30) return `${diffDays}d ago`;
  if (diffDays >= 30 && diffDays < 365) return `${Math.round(diffDays / 30)}mo ago`;
  if (diffDays >= 365) return `${Math.round(diffDays / 365)}y ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
