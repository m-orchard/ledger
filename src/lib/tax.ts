import type { Salary, TaxSettings } from '../types';
import { toMonthlyAmount } from './frequency';

/** 2024/25 rest-of-UK Income Tax and Class 1 NI rates. Edit in Settings if these change. */
export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  incomeTaxBands: [
    { threshold: 12570, rate: 20 },
    { threshold: 50270, rate: 40 },
    { threshold: 125140, rate: 45 },
  ],
  personalAllowanceTaperStart: 100000,
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niMainRate: 8,
  niUpperRate: 2,
};

/**
 * UK Income Tax on annual taxable (post-sacrifice) gross income.
 * Only the personal allowance (band 0) shrinks with the high-income taper —
 * the higher/additional-rate thresholds are fixed absolute amounts.
 */
export function calcIncomeTax(taxableGross: number, tax: TaxSettings): number {
  const bands = tax.incomeTaxBands;
  if (bands.length === 0 || taxableGross <= 0) return 0;

  const baseAllowance = bands[0].threshold;
  const allowance = Math.max(
    0,
    baseAllowance - Math.max(0, taxableGross - tax.personalAllowanceTaperStart) / 2
  );

  let total = 0;
  for (let i = 0; i < bands.length; i++) {
    const lower = i === 0 ? allowance : bands[i].threshold;
    const upper = i + 1 < bands.length ? bands[i + 1].threshold : Infinity;
    if (taxableGross > lower) {
      total += (Math.min(taxableGross, upper) - lower) * (bands[i].rate / 100);
    }
  }
  return total;
}

/** UK Class 1 employee National Insurance on annual taxable (post-sacrifice) gross income. */
export function calcNI(taxableGross: number, tax: TaxSettings): number {
  const { niPrimaryThreshold: pt, niUpperEarningsLimit: uel, niMainRate, niUpperRate } = tax;
  let total = 0;
  if (taxableGross > pt) {
    total += (Math.min(taxableGross, uel) - pt) * (niMainRate / 100);
  }
  if (taxableGross > uel) {
    total += (taxableGross - uel) * (niUpperRate / 100);
  }
  return total;
}

/** A salary's annual taxable pay: gross minus pension sacrifice and other flat sacrifice deductions. */
function taxableAnnualFor(salary: Salary): number {
  const sacrificeAnnual = salary.grossAnnual * (salary.sacrificePercent / 100);
  const otherDeductionsAnnual = salary.otherDeductions.reduce(
    (sum, d) => sum + toMonthlyAmount(d.amount, d.frequency) * 12,
    0
  );
  return salary.grossAnnual - sacrificeAnnual - otherDeductionsAnnual;
}

export interface SalaryBreakdown {
  takeHomeMonthly: number;
  incomeTaxMonthly: number;
  niMonthly: number;
  sacrificeMonthly: number;
  employerContributionMonthly: number;
  pensionContributionMonthly: number;
  otherDeductionsMonthly: number;
}

/** Splits a gross salary into take-home pay, tax/NI, and pension contributions. */
export function calcSalaryBreakdown(salary: Salary, tax: TaxSettings): SalaryBreakdown {
  const sacrificeAnnual = salary.grossAnnual * (salary.sacrificePercent / 100);
  const otherDeductionsAnnual = salary.otherDeductions.reduce(
    (sum, d) => sum + toMonthlyAmount(d.amount, d.frequency) * 12,
    0
  );
  const taxableAnnual = taxableAnnualFor(salary);
  const incomeTaxAnnual = calcIncomeTax(taxableAnnual, tax);
  const niAnnual = calcNI(taxableAnnual, tax);
  const takeHomeAnnual = taxableAnnual - incomeTaxAnnual - niAnnual;
  const employerContributionAnnual = salary.grossAnnual * (salary.employerContributionPercent / 100);

  return {
    takeHomeMonthly: takeHomeAnnual / 12,
    incomeTaxMonthly: incomeTaxAnnual / 12,
    niMonthly: niAnnual / 12,
    sacrificeMonthly: sacrificeAnnual / 12,
    employerContributionMonthly: employerContributionAnnual / 12,
    pensionContributionMonthly: (sacrificeAnnual + employerContributionAnnual) / 12,
    otherDeductionsMonthly: otherDeductionsAnnual / 12,
  };
}

export interface BonusBreakdown {
  grossBonus: number;
  taxOnBonus: number;
  niOnBonus: number;
  netBonus: number;
}

/**
 * Tax on a one-off bonus, at the salary's marginal rate: computed as the
 * difference between tax/NI on (annual taxable pay + bonus) and on annual
 * taxable pay alone. This correctly reflects a bonus pushing income into a
 * higher band, without needing to model PAYE's cumulative in-year mechanics.
 */
export function calcBonusNet(salary: Salary, grossBonus: number, tax: TaxSettings): BonusBreakdown {
  const baseTaxable = taxableAnnualFor(salary);
  const withBonusTaxable = baseTaxable + grossBonus;

  const taxOnBonus = calcIncomeTax(withBonusTaxable, tax) - calcIncomeTax(baseTaxable, tax);
  const niOnBonus = calcNI(withBonusTaxable, tax) - calcNI(baseTaxable, tax);

  return {
    grossBonus,
    taxOnBonus,
    niOnBonus,
    netBonus: grossBonus - taxOnBonus - niOnBonus,
  };
}
