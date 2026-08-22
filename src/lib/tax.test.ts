import { describe, expect, it } from 'vitest';
import { calcBonusNet, calcIncomeTax, calcNI, calcSalaryBreakdown, DEFAULT_TAX_SETTINGS } from './tax';
import type { Salary } from '../types';

describe('calcIncomeTax', () => {
  it('is zero at or below the personal allowance', () => {
    expect(calcIncomeTax(0, DEFAULT_TAX_SETTINGS)).toBe(0);
    expect(calcIncomeTax(12570, DEFAULT_TAX_SETTINGS)).toBe(0);
  });

  it('taxes only the basic rate band for a middling salary', () => {
    // (45000 - 12570) * 20% = 6486
    expect(calcIncomeTax(45000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(6486, 5);
  });

  it('spans the basic and higher rate bands', () => {
    // (50270-12570)*20% + (60000-50270)*40% = 7540 + 3892 = 11432
    expect(calcIncomeTax(60000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(11432, 5);
  });

  it('spans all three bands for a very high earner', () => {
    // allowance fully tapered away at £130k: 12570 - (130000-100000)/2 = -2430 -> 0
    // (50270-0)*20% + (125140-50270)*40% + (130000-125140)*45%
    // = 10054 + 29948 + 2187 = 42189
    expect(calcIncomeTax(130000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(42189, 5);
  });

  it('tapers the personal allowance between £100k and £125,140', () => {
    // allowance = 12570 - (110000-100000)/2 = 7570
    // (50270-7570)*20% + (110000-50270)*40% = 8540 + 23892 = 32432
    expect(calcIncomeTax(110000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(32432, 5);
  });
});

describe('calcNI', () => {
  it('is zero below the primary threshold', () => {
    expect(calcNI(10000, DEFAULT_TAX_SETTINGS)).toBe(0);
  });

  it('applies the main rate up to the upper earnings limit', () => {
    // (45000-12570)*8% = 2594.4
    expect(calcNI(45000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(2594.4, 5);
  });

  it('applies the upper rate above the upper earnings limit', () => {
    // (50270-12570)*8% + (60000-50270)*2% = 3016 + 194.6 = 3210.6
    expect(calcNI(60000, DEFAULT_TAX_SETTINGS)).toBeCloseTo(3210.6, 5);
  });
});

describe('calcSalaryBreakdown', () => {
  const baseSalary: Salary = {
    id: 's1',
    name: 'Salary',
    grossAnnual: 45000,
    sacrificePercent: 0,
    employerContributionPercent: 0,
    otherDeductions: [],
      bonuses: [],
    ownerId: 'shared',
  };

  it('matches take-home pay to gross minus tax minus NI when there is no sacrifice', () => {
    const b = calcSalaryBreakdown(baseSalary, DEFAULT_TAX_SETTINGS);
    const expectedAnnual = 45000 - 6486 - 2594.4;
    expect(b.takeHomeMonthly).toBeCloseTo(expectedAnnual / 12, 5);
    expect(b.sacrificeMonthly).toBe(0);
    expect(b.pensionContributionMonthly).toBe(0);
  });

  it('reduces both tax and NI when salary sacrifice is used', () => {
    const sacrificed: Salary = { ...baseSalary, sacrificePercent: 10 };
    const withoutSacrifice = calcSalaryBreakdown(baseSalary, DEFAULT_TAX_SETTINGS);
    const withSacrifice = calcSalaryBreakdown(sacrificed, DEFAULT_TAX_SETTINGS);

    expect(withSacrifice.incomeTaxMonthly).toBeLessThan(withoutSacrifice.incomeTaxMonthly);
    expect(withSacrifice.niMonthly).toBeLessThan(withoutSacrifice.niMonthly);
    // 10% of 45000 = 4500/yr = 375/mo
    expect(withSacrifice.sacrificeMonthly).toBeCloseTo(375, 5);
  });

  it('adds the employer contribution to the pension without touching pay or tax', () => {
    const withEmployer: Salary = { ...baseSalary, employerContributionPercent: 5 };
    const withoutEmployer = calcSalaryBreakdown(baseSalary, DEFAULT_TAX_SETTINGS);
    const result = calcSalaryBreakdown(withEmployer, DEFAULT_TAX_SETTINGS);

    expect(result.takeHomeMonthly).toBeCloseTo(withoutEmployer.takeHomeMonthly, 5);
    expect(result.incomeTaxMonthly).toBeCloseTo(withoutEmployer.incomeTaxMonthly, 5);
    // 5% of 45000 = 2250/yr = 187.5/mo
    expect(result.employerContributionMonthly).toBeCloseTo(187.5, 5);
    expect(result.pensionContributionMonthly).toBeCloseTo(187.5, 5);
  });

  it('reduces taxable pay and take-home by a flat other-deduction, on top of any pension sacrifice', () => {
    const withDeduction: Salary = {
      ...baseSalary,
      otherDeductions: [{ id: 'd1', name: 'Health insurance', amount: 5, frequency: 'weekly' }],
    };
    const withoutDeduction = calcSalaryBreakdown(baseSalary, DEFAULT_TAX_SETTINGS);
    const result = calcSalaryBreakdown(withDeduction, DEFAULT_TAX_SETTINGS);

    // £5/wk * 52/12 ≈ £21.67/mo
    expect(result.otherDeductionsMonthly).toBeCloseTo((5 * 52) / 12, 5);
    expect(result.incomeTaxMonthly).toBeLessThan(withoutDeduction.incomeTaxMonthly);
    expect(result.niMonthly).toBeLessThan(withoutDeduction.niMonthly);
    // Take-home drops by more than the deduction itself, since it also saves some tax/NI
    expect(withoutDeduction.takeHomeMonthly - result.takeHomeMonthly).toBeLessThan(result.otherDeductionsMonthly);
  });
});

describe('calcBonusNet', () => {
  it('taxes a bonus that stays within the basic rate band at the flat marginal rate', () => {
    const salary: Salary = {
      id: 's1',
      name: 'Salary',
      grossAnnual: 45000,
      sacrificePercent: 0,
      employerContributionPercent: 0,
      otherDeductions: [],
      bonuses: [],
      ownerId: 'shared',
    };
    // 45000 + 3000 = 48000, still under the 50270 higher-rate threshold
    const result = calcBonusNet(salary, 3000, DEFAULT_TAX_SETTINGS);

    expect(result.taxOnBonus).toBeCloseTo(3000 * 0.2, 5);
    expect(result.niOnBonus).toBeCloseTo(3000 * 0.08, 5);
    expect(result.netBonus).toBeCloseTo(3000 * (1 - 0.2 - 0.08), 5);
  });

  it('taxes the portion of a bonus that crosses into a higher band at that higher rate', () => {
    const salary: Salary = {
      id: 's1',
      name: 'Salary',
      grossAnnual: 48000,
      sacrificePercent: 0,
      employerContributionPercent: 0,
      otherDeductions: [],
      bonuses: [],
      ownerId: 'shared',
    };
    // 48000 + 5000 = 53000, crossing the 50270 higher-rate threshold
    const result = calcBonusNet(salary, 5000, DEFAULT_TAX_SETTINGS);

    // taxOnIncomeTax(53000) - calcIncomeTax(48000) = 8632 - 7086 = 1546
    expect(result.taxOnBonus).toBeCloseTo(1546, 5);
    // Higher than a flat 20% (1000), since part of the bonus falls in the 40% band
    expect(result.taxOnBonus).toBeGreaterThan(5000 * 0.2);
    expect(result.netBonus).toBeCloseTo(5000 - result.taxOnBonus - result.niOnBonus, 10);
  });

  it('accounts for existing salary sacrifice when computing the bonus baseline', () => {
    // Without sacrifice, £52,000 taxable pay is already in the 40% band, so a
    // £3,000 bonus is taxed entirely at 40%.
    const withoutSacrifice: Salary = {
      id: 's1',
      name: 'Salary',
      grossAnnual: 52000,
      sacrificePercent: 0,
      employerContributionPercent: 0,
      otherDeductions: [],
      bonuses: [],
      ownerId: 'shared',
    };
    // With 10% sacrifice, taxable pay drops to £46,800 — back in the 20% band —
    // so the same bonus is taxed at 20% instead.
    const withSacrifice: Salary = { ...withoutSacrifice, sacrificePercent: 10 };

    const a = calcBonusNet(withoutSacrifice, 3000, DEFAULT_TAX_SETTINGS);
    const b = calcBonusNet(withSacrifice, 3000, DEFAULT_TAX_SETTINGS);

    expect(a.taxOnBonus).toBeCloseTo(3000 * 0.4, 5);
    expect(b.taxOnBonus).toBeCloseTo(3000 * 0.2, 5);
    expect(b.taxOnBonus).toBeLessThan(a.taxOnBonus);
  });
});
