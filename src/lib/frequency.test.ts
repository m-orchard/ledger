import { describe, expect, it } from 'vitest';
import { toMonthlyAmount } from './frequency';

describe('toMonthlyAmount', () => {
  it('passes monthly amounts through unchanged', () => {
    expect(toMonthlyAmount(500, 'monthly')).toBe(500);
  });

  it('converts weekly amounts using a 52-week year', () => {
    expect(toMonthlyAmount(100, 'weekly')).toBeCloseTo((100 * 52) / 12, 10);
  });

  it('converts annual amounts by dividing by 12', () => {
    expect(toMonthlyAmount(1200, 'annual')).toBe(100);
  });
});
