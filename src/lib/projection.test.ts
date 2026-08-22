import { describe, expect, it } from 'vitest';
import { runProjection } from './projection';
import { DEFAULT_TAX_SETTINGS } from './tax';
import { SHARED_OWNER } from '../types';
import type { AppData } from '../types';

function baseData(overrides: Partial<AppData> = {}): AppData {
  return {
    income: [],
    expenses: [],
    accounts: [],
    assets: [],
    salaries: [],
    loans: [],
    oneOffs: [],
    people: [],
    settings: {
      currentAge: 30,
      retirementAge: 65,
      projectionEndAge: 31, // default to a short, fast-running 1-year window
      inflationRate: 0,
      currency: 'GBP',
      tax: DEFAULT_TAX_SETTINGS,
      sharedColor: '#94a3b8',
    },
    ...overrides,
  };
}

/**
 * Returns an ISO date string `monthsFromNow` months after today (day 1), for
 * one-off event fixtures. Built from local Y/M/D directly rather than via
 * `toISOString()`, which converts to UTC and can shift the date by a day (or,
 * for day 1, a whole month) depending on the timezone offset and current
 * time-of-day — the same class of bug fixed in `projection.ts`'s
 * `parseLocalDate`.
 */
function isoDateMonthsFromNow(monthsFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

describe('runProjection — account growth', () => {
  it('compounds an account at its annual growth rate over a year with no contributions', () => {
    const data = baseData({
      accounts: [
        {
          id: 'a1',
          name: 'ISA',
          type: 'stocks-isa',
          balance: 10000,
          annualGrowthRate: 12,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    const afterOneYear = points[12];
    expect(afterOneYear.accountBalances.a1).toBeCloseTo(10000 * 1.12, 6);
  });

  it('applies contributions at the requested frequency', () => {
    const weekly = baseData({
      accounts: [
        {
          id: 'a1',
          name: 'Savings',
          type: 'cash',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 100,
          contributionFrequency: 'weekly',
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(weekly);
    // 100/wk * 52/12 = 433.33/mo, over 12 months (months 1..12 contribute, month 0 is the start)
    expect(points[12].accountBalances.a1).toBeCloseTo(((100 * 52) / 12) * 12, 6);
  });

  it('reverts a fixed-term account to a scheduled rate once its date has passed', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 6 / 12 },
      accounts: [
        {
          id: 'a1',
          name: 'Fixed bond',
          type: 'savings',
          balance: 10000,
          annualGrowthRate: 12,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
          rateChanges: [{ id: 'c1', date: isoDateMonthsFromNow(3), rate: 0 }],
        },
      ],
    });

    const points = runProjection(data);
    // A change dated for month 3 takes effect starting that month (not the month after) —
    // so only months 1-2 compound at the base 12% rate before it reverts to 0%.
    const monthlyRate = Math.pow(1.12, 1 / 12) - 1;
    const atChange = 10000 * Math.pow(1 + monthlyRate, 2);
    expect(points[3].accountBalances.a1).toBeCloseTo(atChange, 6);
    // The scheduled rate is 0%, so the balance stays flat from month 3 onward
    expect(points[6].accountBalances.a1).toBeCloseTo(atChange, 6);
  });

  it('uses the latest applicable rate when several changes are scheduled, regardless of array order', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 6 / 12 },
      accounts: [
        {
          id: 'a1',
          name: 'Tracker',
          type: 'savings',
          balance: 10000,
          annualGrowthRate: 0,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
          rateChanges: [
            // Listed out of chronological order on purpose — the later date should still win once both have passed.
            { id: 'c1', date: isoDateMonthsFromNow(4), rate: 10 },
            { id: 'c2', date: isoDateMonthsFromNow(2), rate: 5 },
          ],
        },
      ],
    });

    const points = runProjection(data);
    // Month 1 at base 0%, months 2-3 at 5% (c2), months 4-6 at 10% (c1)
    const atC2 = 10000 * Math.pow(1 + (Math.pow(1.05, 1 / 12) - 1), 2);
    const atEnd = atC2 * Math.pow(1 + (Math.pow(1.1, 1 / 12) - 1), 3);
    expect(points[3].accountBalances.a1).toBeCloseTo(atC2, 6);
    expect(points[6].accountBalances.a1).toBeCloseTo(atEnd, 6);
  });
});

describe('runProjection — lifetime ISA', () => {
  it('adds the 25% government bonus on top of the contribution', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 1 / 12 },
      accounts: [
        {
          id: 'lisa',
          name: 'LISA',
          type: 'lifetime-isa',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 200,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // 200 contribution + 25% bonus (200 is under the £333.33 monthly cap) = 250
    expect(points[1].accountBalances.lisa).toBeCloseTo(250, 6);
  });

  it('caps the bonus at the monthly-equivalent of the £4,000 annual limit', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 1 / 12 },
      accounts: [
        {
          id: 'lisa',
          name: 'LISA',
          type: 'lifetime-isa',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 1000,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // Bonus caps at (4000/12) * 25% ≈ 83.33, regardless of the 1000 contributed
    expect(points[1].accountBalances.lisa).toBeCloseTo(1000 + (4000 / 12) * 0.25, 6);
  });

  it('does not subtract the government bonus from cash surplus', () => {
    const data = baseData({
      accounts: [
        {
          id: 'lisa',
          name: 'LISA',
          type: 'lifetime-isa',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 200,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // Only the 200 actually paid from the bank counts against cash surplus, not the 50 bonus
    expect(points[0].monthlyContributions).toBe(200);
  });
});

describe('runProjection — salaries', () => {
  it('routes sacrifice + employer pension contributions into the linked account', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 1 / 12 },
      accounts: [
        {
          id: 'pension',
          name: 'Workplace pension',
          type: 'pension',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 60000,
          sacrificePercent: 5,
          employerContributionPercent: 3,
          pensionAccountId: 'pension',
          otherDeductions: [],
          bonuses: [],
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // (5% + 3%) of 60000 / 12 = 400/mo
    expect(points[1].accountBalances.pension).toBeCloseTo(400, 6);
  });

  it('excludes salary sacrifice from the cash-surplus contributions figure (no double counting)', () => {
    const data = baseData({
      accounts: [
        {
          id: 'pension',
          name: 'Workplace pension',
          type: 'pension',
          balance: 0,
          annualGrowthRate: 0,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 45000,
          sacrificePercent: 5,
          employerContributionPercent: 0,
          pensionAccountId: 'pension',
          otherDeductions: [],
          bonuses: [],
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // No account has its own contributionAmount, so cash "contributions" should be 0
    // even though the salary is sacrificing into the pension.
    expect(points[0].monthlyContributions).toBe(0);
    expect(points[0].monthlyCashSurplus).toBeCloseTo(points[0].monthlyIncome, 6);
  });
});

describe('runProjection — bonuses', () => {
  it('adds a net (taxed) bonus to income only in the month it is dated', () => {
    const bonusMonth = 2;
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 31 },
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 45000,
          sacrificePercent: 0,
          employerContributionPercent: 0,
          otherDeductions: [],
          bonuses: [{ id: 'b1', name: 'Annual bonus', amount: 3000, date: isoDateMonthsFromNow(bonusMonth) }],
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    const baseIncome = points[0].monthlyIncome;
    // Net of 20% tax + 8% NI on the bonus (stays within the basic rate band): 3000 * 0.72 = 2160
    expect(points[bonusMonth].monthlyIncome).toBeCloseTo(baseIncome + 2160, 5);
    expect(points[bonusMonth].monthlyCashSurplus).toBeCloseTo(points[bonusMonth].monthlyIncome, 5);
    // Unaffected in a month without the bonus
    expect(points[bonusMonth - 1].monthlyIncome).toBeCloseTo(baseIncome, 6);
  });

  it('taxes the portion of a bonus crossing into a higher band at that higher rate', () => {
    const bonusMonth = 1;
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 31 },
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 48000,
          sacrificePercent: 0,
          employerContributionPercent: 0,
          otherDeductions: [],
          bonuses: [{ id: 'b1', name: 'Big bonus', amount: 5000, date: isoDateMonthsFromNow(bonusMonth) }],
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    const baseIncome = points[0].monthlyIncome;
    // From the calcBonusNet test: taxOnBonus=1546, niOnBonus=236.2 -> netBonus=3217.8
    expect(points[bonusMonth].monthlyIncome).toBeCloseTo(baseIncome + 3217.8, 3);
  });
});

describe('runProjection — assets', () => {
  it('compounds an asset at its own annual growth rate', () => {
    const data = baseData({
      assets: [
        { id: 'house', name: 'House', value: 300000, annualGrowthRate: 12, ownerId: SHARED_OWNER },
      ],
    });

    const points = runProjection(data);
    expect(points[12].assetBalances.house).toBeCloseTo(300000 * 1.12, 3);
  });

  it('depreciates an asset with a negative growth rate', () => {
    const data = baseData({
      assets: [
        { id: 'car', name: 'Car', value: 20000, annualGrowthRate: -15, ownerId: SHARED_OWNER },
      ],
    });

    const points = runProjection(data);
    expect(points[12].assetBalances.car).toBeCloseTo(20000 * 0.85, 3);
  });

  it('applies a one-off event targeted at an asset as a direct signed adjustment', () => {
    const adjustmentMonth = 2;
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 31 },
      assets: [
        { id: 'house', name: 'House', value: 300000, annualGrowthRate: 0, ownerId: SHARED_OWNER },
      ],
      oneOffs: [
        {
          id: 'o1',
          name: 'Kitchen renovation',
          kind: 'expense',
          amount: 20000,
          date: isoDateMonthsFromNow(adjustmentMonth),
          assetId: 'house',
        },
      ],
    });

    const points = runProjection(data);
    expect(points[adjustmentMonth].assetBalances.house).toBe(320000);
  });

  it('applies a scheduled rate change to an asset', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 6 / 12 },
      assets: [
        {
          id: 'car',
          name: 'Car',
          value: 20000,
          annualGrowthRate: -20,
          ownerId: SHARED_OWNER,
          rateChanges: [{ id: 'c1', date: isoDateMonthsFromNow(3), rate: -5 }],
        },
      ],
    });

    const points = runProjection(data);
    // The change (dated for month 3) takes effect starting that month, so only months 1-2
    // depreciate at the base -20% rate before it slows to -5%.
    const rate1 = Math.pow(1 - 0.2, 1 / 12) - 1;
    const rate2 = Math.pow(1 - 0.05, 1 / 12) - 1;
    const atChange = 20000 * Math.pow(1 + rate1, 2) * Math.pow(1 + rate2, 1);
    const atEnd = atChange * Math.pow(1 + rate2, 3);
    expect(points[3].assetBalances.car).toBeCloseTo(atChange, 3);
    expect(points[6].assetBalances.car).toBeCloseTo(atEnd, 3);
  });

  it('includes assets in total net worth alongside accounts and loans', () => {
    const data = baseData({
      accounts: [
        {
          id: 'a1',
          name: 'Savings',
          type: 'cash',
          balance: 5000,
          annualGrowthRate: 0,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
      assets: [
        { id: 'house', name: 'House', value: 300000, annualGrowthRate: 0, ownerId: SHARED_OWNER },
      ],
      loans: [
        {
          id: 'l1',
          name: 'Mortgage',
          balance: 220000,
          originalAmount: 220000,
          annualInterestRate: 0,
          monthlyPayment: 0,
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    expect(points[0].totalAssetValue).toBe(300000);
    // 5000 (savings) + 300000 (house) - 220000 (mortgage) = 85000
    expect(points[0].totalNetWorth).toBe(85000);
  });
});

describe('runProjection — loans', () => {
  it('amortizes a loan to zero and stops paying once it is paid off', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 31 },
      loans: [
        {
          id: 'l1',
          name: 'Small loan',
          balance: 1000,
          originalAmount: 1000,
          annualInterestRate: 0,
          monthlyPayment: 300,
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    // 1000 / 300 => paid off during month 4 (300*3=900, remaining 100 paid in month 4)
    expect(points[3].loanBalances.l1).toBeCloseTo(100, 6);
    expect(points[4].loanBalances.l1).toBe(0);
    expect(points[5].loanBalances.l1).toBe(0);
    // Once paid off, the loan no longer costs anything each month
    expect(points[5].monthlyExpenses).toBe(0);
  });

  it('applies a scheduled rate change to a loan (e.g. a fixed-rate deal ending)', () => {
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 30 + 6 / 12 },
      loans: [
        {
          id: 'l1',
          name: 'Mortgage',
          balance: 200000,
          originalAmount: 200000,
          annualInterestRate: 0,
          monthlyPayment: 0,
          ownerId: SHARED_OWNER,
          rateChanges: [{ id: 'c1', date: isoDateMonthsFromNow(3), rate: 6 }],
        },
      ],
    });

    const points = runProjection(data);
    // No interest for months 1-2 (rate 0%); the change (dated for month 3) takes effect
    // that month, so interest starts accruing at 6%/yr from month 3 onward.
    expect(points[2].loanBalances.l1).toBeCloseTo(200000, 6);
    expect(points[3].loanBalances.l1).toBeGreaterThan(200000);
    expect(points[6].loanBalances.l1).toBeGreaterThan(points[3].loanBalances.l1);
  });

  it('nets loan balances out of total net worth', () => {
    const data = baseData({
      accounts: [
        {
          id: 'a1',
          name: 'Savings',
          type: 'cash',
          balance: 5000,
          annualGrowthRate: 0,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
      loans: [
        {
          id: 'l1',
          name: 'Loan',
          balance: 2000,
          originalAmount: 2000,
          annualInterestRate: 0,
          monthlyPayment: 0,
          ownerId: SHARED_OWNER,
        },
      ],
    });

    const points = runProjection(data);
    expect(points[0].totalDebt).toBe(2000);
    expect(points[0].totalNetWorth).toBe(3000);
  });

  it('applies a one-off event targeted at a loan as an extra repayment', () => {
    const overpaymentMonth = 2;
    const data = baseData({
      settings: { ...baseData().settings, projectionEndAge: 31 },
      loans: [
        {
          id: 'l1',
          name: 'Loan',
          balance: 1000,
          originalAmount: 1000,
          annualInterestRate: 0,
          monthlyPayment: 100,
          ownerId: SHARED_OWNER,
        },
      ],
      oneOffs: [
        {
          id: 'o1',
          name: 'Bonus overpayment',
          kind: 'expense',
          amount: -300,
          date: isoDateMonthsFromNow(overpaymentMonth),
          loanId: 'l1',
        },
      ],
    });

    const points = runProjection(data);
    // Without the overpayment, balance after month 2 would be 1000 - 200 = 800.
    // With a 300 extra repayment that same month: 800 - 300 = 500.
    expect(points[overpaymentMonth].loanBalances.l1).toBeCloseTo(500, 6);
  });
});
