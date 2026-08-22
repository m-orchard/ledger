import { describe, expect, it } from 'vitest';
import { calcLisaBonus, LISA_ANNUAL_CONTRIBUTION_CAP, LISA_BONUS_RATE } from './lisa';

describe('calcLisaBonus', () => {
  it('pays 25% on a contribution under the monthly-equivalent cap', () => {
    expect(calcLisaBonus(200)).toBeCloseTo(50, 6);
  });

  it('caps the bonus at the monthly-equivalent of the £4,000 annual limit', () => {
    const capMonthly = LISA_ANNUAL_CONTRIBUTION_CAP / 12;
    expect(calcLisaBonus(capMonthly)).toBeCloseTo(capMonthly * LISA_BONUS_RATE, 6);
    expect(calcLisaBonus(capMonthly * 2)).toBeCloseTo(capMonthly * LISA_BONUS_RATE, 6);
  });

  it('is zero for a zero or negative contribution', () => {
    expect(calcLisaBonus(0)).toBe(0);
    expect(calcLisaBonus(-100)).toBe(0);
  });
});
