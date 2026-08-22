/** Current HMRC Lifetime ISA rules — edit here if they change. */
export const LISA_ANNUAL_CONTRIBUTION_CAP = 4000;
export const LISA_BONUS_RATE = 0.25;

/**
 * Monthly government bonus on a Lifetime ISA. Only the first £4,000/year of
 * contributions earn the 25% bonus (approximated here as a flat monthly cap
 * of £4,000/12, consistent with this app's monthly-simulation model).
 * Only regular contributions are eligible — one-off deposits don't get a
 * bonus, since those are applied as raw balance adjustments elsewhere.
 */
export function calcLisaBonus(monthlyContribution: number): number {
  const eligible = Math.min(Math.max(0, monthlyContribution), LISA_ANNUAL_CONTRIBUTION_CAP / 12);
  return eligible * LISA_BONUS_RATE;
}
