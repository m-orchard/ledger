import { describe, expect, it } from 'vitest';
import { migrations, CURRENT_SCHEMA_VERSION } from './migrations';
import { SHARED_OWNER } from '../types';
import { todayISO } from './date';

function migrateFrom(schemaVersion: number, data: any) {
  let result = data;
  for (let v = schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    result = migrations[v - 1](result);
  }
  return result;
}

describe('migrations', () => {
  it('upgrades a v1 (original shape) blob all the way to current', () => {
    const v1 = {
      income: [{ id: 'i1', name: 'Salary', amount: 3200 }],
      expenses: [{ id: 'e1', name: 'Rent', amount: 1200 }],
      accounts: [
        { id: 'a1', name: 'ISA', type: 'isa', balance: 8000, annualGrowthRate: 6, monthlyContribution: 300 },
      ],
      oneOffs: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
      },
    };

    const result = migrateFrom(1, v1);

    expect(result.people).toEqual([]);
    expect(result.salaries).toEqual([]);
    expect(result.loans).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.settings.tax).toBeDefined();

    expect(result.income[0]).toMatchObject({ frequency: 'monthly', ownerId: SHARED_OWNER, amount: 3200 });
    expect(result.expenses[0]).toMatchObject({ frequency: 'monthly', ownerId: SHARED_OWNER, amount: 1200, category: 'regular' });

    const account = result.accounts[0];
    expect(account.type).toBe('stocks-isa');
    expect(account.contributionAmount).toBe(300);
    expect(account.contributionFrequency).toBe('monthly');
    expect(account.ownerId).toBe(SHARED_OWNER);
    expect(account.monthlyContribution).toBeUndefined();
  });

  it('upgrades a v2 (salaries/loans/tax already present) blob without disturbing them', () => {
    const v2 = {
      income: [],
      expenses: [],
      accounts: [],
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 45000,
          sacrificePercent: 5,
          employerContributionPercent: 3,
        },
      ],
      loans: [{ id: 'l1', name: 'Mortgage', balance: 200000, annualInterestRate: 4.5, monthlyPayment: 1200 }],
      oneOffs: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [{ threshold: 12570, rate: 20 }], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(2, v2);

    expect(result.people).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.salaries[0]).toMatchObject({ ownerId: SHARED_OWNER, grossAnnual: 45000 });
    expect(result.loans[0]).toMatchObject({ ownerId: SHARED_OWNER, balance: 200000, originalAmount: 200000 });
    // Pre-existing tax settings are left untouched by the v2 migration function
    expect(result.settings.tax.incomeTaxBands).toEqual([{ threshold: 12570, rate: 20 }]);
  });

  it('upgrades a v3 (people/frequency/ownership already present) blob, backfilling assets and loan original amounts', () => {
    const v3 = {
      income: [],
      expenses: [],
      accounts: [],
      salaries: [],
      loans: [
        { id: 'l1', name: 'Mortgage', balance: 180000, annualInterestRate: 4.5, monthlyPayment: 1200, ownerId: SHARED_OWNER },
      ],
      oneOffs: [],
      people: [{ id: 'p1', name: 'Me' }],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(3, v3);

    expect(result.assets).toEqual([]);
    expect(result.loans[0]).toMatchObject({ balance: 180000, originalAmount: 180000 });
  });

  it('upgrades a v4 (assets/originalAmount already present) blob, backfilling expense categories', () => {
    const v4 = {
      income: [{ id: 'i1', name: 'Salary', amount: 3200, frequency: 'monthly', ownerId: SHARED_OWNER }],
      expenses: [
        { id: 'e1', name: 'Council Tax', amount: 150, frequency: 'monthly', ownerId: SHARED_OWNER },
        { id: 'e2', name: 'Groceries', amount: 400, frequency: 'monthly', ownerId: SHARED_OWNER, category: 'variable' },
      ],
      accounts: [],
      assets: [],
      salaries: [],
      loans: [],
      oneOffs: [],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(4, v4);

    // Missing category defaults to 'regular'
    expect(result.expenses[0]).toMatchObject({ name: 'Council Tax', category: 'regular' });
    // Already-set category is left untouched
    expect(result.expenses[1]).toMatchObject({ name: 'Groceries', category: 'variable' });
    // Income items are untouched by this migration (category isn't meaningful there)
    expect(result.income[0].category).toBeUndefined();
  });

  it('upgrades a v5 (expense categories already present) blob, backfilling salary otherDeductions', () => {
    const v5 = {
      income: [],
      expenses: [],
      accounts: [],
      assets: [],
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 45000,
          sacrificePercent: 5,
          employerContributionPercent: 3,
          ownerId: SHARED_OWNER,
        },
      ],
      loans: [],
      oneOffs: [],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(5, v5);

    expect(result.salaries[0]).toMatchObject({ grossAnnual: 45000, otherDeductions: [] });
  });

  it('upgrades a v6 blob, moving salary-targeted one-off events into that salary\'s bonuses', () => {
    const v6 = {
      income: [],
      expenses: [],
      accounts: [],
      assets: [],
      salaries: [
        {
          id: 's1',
          name: 'Salary',
          grossAnnual: 45000,
          sacrificePercent: 5,
          employerContributionPercent: 3,
          otherDeductions: [],
          ownerId: SHARED_OWNER,
        },
      ],
      loans: [],
      oneOffs: [
        { id: 'o1', name: 'Annual bonus', amount: 3000, date: '2027-03-01', salaryId: 's1' },
        { id: 'o2', name: 'Car', amount: -5000, date: '2027-06-01', accountId: 'a1' },
      ],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(6, v6);

    expect(result.salaries[0].bonuses).toEqual([
      { id: 'o1', name: 'Annual bonus', amount: 3000, date: '2027-03-01' },
    ]);
    // The salary-targeted event is removed from oneOffs; unrelated ones are left alone
    // (and picked up a backfilled `kind` from the later v7->v8 migration)
    expect(result.oneOffs).toEqual([
      { id: 'o2', name: 'Car', kind: 'expense', amount: -5000, date: '2027-06-01', accountId: 'a1' },
    ]);
  });

  it('upgrades a v7 blob, backfilling one-off event `kind` from target/sign', () => {
    const v7 = {
      income: [],
      expenses: [],
      accounts: [],
      assets: [],
      salaries: [],
      loans: [],
      oneOffs: [
        { id: 'o1', name: 'Inheritance', amount: 10000, date: '2027-01-01' }, // unassigned, positive -> income
        { id: 'o2', name: 'Car', amount: -5000, date: '2027-02-01', accountId: 'a1' }, // negative -> expense
        { id: 'o3', name: 'Deposit', amount: 20000, date: '2027-03-01', accountId: 'a1' }, // positive, account -> income
        { id: 'o4', name: 'Overpayment', amount: 300, date: '2027-04-01', loanId: 'l1' }, // loan -> always expense
        { id: 'o5', name: 'Renovation', amount: 15000, date: '2027-05-01', assetId: 'as1' }, // asset -> always expense
      ],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(7, v7);

    expect(result.oneOffs.map((e: any) => e.kind)).toEqual([
      'income', // o1
      'expense', // o2
      'income', // o3
      'expense', // o4
      'expense', // o5
    ]);
  });

  it('upgrades a v8 blob, backfilling person colours and a default shared colour', () => {
    const v8 = {
      income: [],
      expenses: [],
      accounts: [],
      assets: [],
      salaries: [],
      loans: [],
      oneOffs: [],
      people: [
        { id: 'p1', name: 'Me' },
        { id: 'p2', name: 'Partner' },
      ],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(8, v8);

    expect(result.people[0]).toMatchObject({ id: 'p1', name: 'Me' });
    expect(result.people[1]).toMatchObject({ id: 'p2', name: 'Partner' });
    expect(typeof result.people[0].color).toBe('string');
    expect(typeof result.people[1].color).toBe('string');
    expect(result.people[0].color).not.toBe(result.people[1].color);
    expect(typeof result.settings.sharedColor).toBe('string');
  });

  it('upgrades a v9 blob, converting maturityDate/postMaturityGrowthRate into rateChanges', () => {
    const v9 = {
      income: [],
      expenses: [],
      accounts: [
        {
          id: 'a1',
          name: 'Fixed bond',
          type: 'savings',
          balance: 10000,
          annualGrowthRate: 5,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
          maturityDate: '2027-06-01',
          postMaturityGrowthRate: 1.5,
        },
        {
          id: 'a2',
          name: 'Plain savings',
          type: 'cash',
          balance: 500,
          annualGrowthRate: 2,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId: SHARED_OWNER,
        },
      ],
      assets: [],
      salaries: [],
      loans: [],
      oneOffs: [],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
        sharedColor: '#94a3b8',
      },
    };

    const result = migrateFrom(9, v9);

    expect(result.accounts[0].rateChanges).toEqual([
      { id: expect.any(String), date: '2027-06-01', rate: 1.5 },
    ]);
    expect(result.accounts[0].maturityDate).toBeUndefined();
    expect(result.accounts[0].postMaturityGrowthRate).toBeUndefined();
    expect(result.accounts[1].rateChanges).toEqual([]);
  });

  it('upgrades a v10 blob, backfilling balanceAsOf/valueAsOf to today', () => {
    const v10 = {
      income: [],
      expenses: [],
      accounts: [
        { id: 'a1', name: 'Savings', type: 'cash', balance: 500, annualGrowthRate: 2, contributionAmount: 0, contributionFrequency: 'monthly', ownerId: SHARED_OWNER },
      ],
      assets: [
        { id: 'as1', name: 'Car', value: 15000, annualGrowthRate: -10, ownerId: SHARED_OWNER },
      ],
      salaries: [],
      loans: [
        { id: 'l1', name: 'Loan', balance: 5000, originalAmount: 5000, annualInterestRate: 5, monthlyPayment: 200, ownerId: SHARED_OWNER },
      ],
      oneOffs: [],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
        sharedColor: '#94a3b8',
      },
    };

    const result = migrateFrom(10, v10);
    const today = todayISO();

    expect(result.accounts[0].balanceAsOf).toBe(today);
    expect(result.assets[0].valueAsOf).toBe(today);
    expect(result.loans[0].balanceAsOf).toBe(today);
  });

  it('leaves an already-current blob effectively unchanged', () => {
    const current = {
      income: [{ id: 'i1', name: 'Rent income', amount: 500, frequency: 'monthly', ownerId: SHARED_OWNER }],
      expenses: [],
      accounts: [],
      assets: [],
      salaries: [],
      loans: [],
      oneOffs: [],
      people: [{ id: 'p1', name: 'Me' }],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    const result = migrateFrom(CURRENT_SCHEMA_VERSION, current);
    expect(result).toEqual(current);
  });

  it('is idempotent, so re-running the full chain backfills fields missing from a blob tagged as current', () => {
    // Simulates a dev hot-reload (or any other) save that persisted schemaVersion 3
    // but with some array items still missing their newer fields — the bug that
    // produced NaN totals in the app.
    const staleButTaggedCurrent = {
      income: [{ id: 'i1', name: 'Salary', amount: 3200 }], // missing frequency/ownerId
      expenses: [],
      accounts: [
        { id: 'a1', name: 'ISA', type: 'stocks-isa', balance: 8000, annualGrowthRate: 6, contributionAmount: 300 }, // missing contributionFrequency/ownerId
      ],
      salaries: [],
      loans: [
        { id: 'l1', name: 'Mortgage', balance: 180000, annualInterestRate: 4.5, monthlyPayment: 1200, ownerId: SHARED_OWNER }, // missing originalAmount
      ],
      oneOffs: [],
      people: [],
      settings: {
        currentAge: 35,
        retirementAge: 65,
        projectionEndAge: 90,
        inflationRate: 2.5,
        currency: 'GBP',
        tax: { incomeTaxBands: [], personalAllowanceTaperStart: 100000, niPrimaryThreshold: 12570, niUpperEarningsLimit: 50270, niMainRate: 8, niUpperRate: 2 },
      },
    };

    let result = staleButTaggedCurrent as any;
    for (const migrate of migrations) {
      result = migrate(result);
    }

    expect(result.income[0]).toMatchObject({ frequency: 'monthly', ownerId: SHARED_OWNER });
    expect(result.accounts[0]).toMatchObject({ contributionFrequency: 'monthly', ownerId: SHARED_OWNER, contributionAmount: 300 });
    expect(result.loans[0]).toMatchObject({ originalAmount: 180000 });
    expect(result.assets).toEqual([]);
  });
});
