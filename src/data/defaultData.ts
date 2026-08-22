import type { AppData } from '../types';
import { SHARED_OWNER, PERSON_COLOR_PALETTE, DEFAULT_SHARED_COLOR } from '../types';
import { newId } from '../lib/storage';
import { DEFAULT_TAX_SETTINGS } from '../lib/tax';

export function buildDefaultData(): AppData {
  const pensionAccountId = newId();
  const houseId = newId();
  const meId = newId();

  return {
    income: [],
    expenses: [
      { id: newId(), name: 'Bills', amount: 400, frequency: 'monthly', ownerId: SHARED_OWNER, category: 'regular' },
      { id: newId(), name: 'Groceries & fuel', amount: 500, frequency: 'monthly', ownerId: SHARED_OWNER, category: 'variable' },
      { id: newId(), name: 'Everything else', amount: 300, frequency: 'monthly', ownerId: SHARED_OWNER, category: 'variable' },
    ],
    accounts: [
      {
        id: pensionAccountId,
        name: 'Workplace pension',
        type: 'pension',
        balance: 25000,
        annualGrowthRate: 5,
        contributionAmount: 0,
        contributionFrequency: 'monthly',
        ownerId: meId,
      },
      {
        id: newId(),
        name: 'Stocks & Shares ISA',
        type: 'stocks-isa',
        balance: 8000,
        annualGrowthRate: 6,
        contributionAmount: 300,
        contributionFrequency: 'monthly',
        ownerId: meId,
      },
      {
        id: newId(),
        name: 'Cash savings',
        type: 'cash',
        balance: 6000,
        annualGrowthRate: 3,
        contributionAmount: 100,
        contributionFrequency: 'monthly',
        ownerId: SHARED_OWNER,
      },
    ],
    salaries: [
      {
        id: newId(),
        name: 'Salary',
        grossAnnual: 45000,
        sacrificePercent: 5,
        employerContributionPercent: 3,
        pensionAccountId,
        otherDeductions: [],
        bonuses: [],
        ownerId: meId,
      },
    ],
    assets: [
      {
        id: houseId,
        name: 'House',
        value: 300000,
        annualGrowthRate: 3,
        ownerId: SHARED_OWNER,
      },
    ],
    loans: [
      {
        id: newId(),
        name: 'Mortgage',
        balance: 220000,
        originalAmount: 240000,
        annualInterestRate: 4.5,
        monthlyPayment: 1200,
        assetId: houseId,
        ownerId: SHARED_OWNER,
      },
    ],
    oneOffs: [],
    people: [{ id: meId, name: 'Me', color: PERSON_COLOR_PALETTE[0] }],
    settings: {
      currentAge: 35,
      retirementAge: 65,
      projectionEndAge: 90,
      inflationRate: 2.5,
      currency: 'GBP',
      tax: DEFAULT_TAX_SETTINGS,
      sharedColor: DEFAULT_SHARED_COLOR,
    },
  };
}
