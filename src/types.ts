export type AccountType =
  | 'cash-isa'
  | 'stocks-isa'
  | 'lifetime-isa'
  | 'pension'
  | 'savings'
  | 'cash'
  | 'general-investment'
  | 'other';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  'cash-isa': 'Cash ISA',
  'stocks-isa': 'Stocks & Shares ISA',
  'lifetime-isa': 'Lifetime ISA',
  pension: 'Pension',
  savings: 'Savings',
  cash: 'Cash',
  'general-investment': 'General Investment Account',
  other: 'Other',
};

export type Frequency = 'weekly' | 'monthly' | 'annual';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: '/wk',
  monthly: '/mo',
  annual: '/yr',
};

export interface Person {
  id: string;
  name: string;
  /** Hex colour shown as an identifying dot for this person throughout the app. */
  color: string;
}

/** Reserved ownerId value for jointly-owned items (a mortgage, a joint savings account, etc). */
export const SHARED_OWNER = 'shared';

/** Cycled through when a new person is added, so each gets a distinct default colour. */
export const PERSON_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#10b981', // emerald
  '#a855f7', // purple
  '#ec4899', // pink
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#ef4444', // red
];

/** Default colour for the "Shared" bucket before the user picks their own. */
export const DEFAULT_SHARED_COLOR = '#94a3b8';

/** A scheduled change to a rate — used wherever a flat annual rate (account growth, asset growth/depreciation, loan interest) can vary over time. */
export interface RateChange {
  id: string;
  /** ISO date this rate takes effect from */
  date: string;
  /** New annual rate, as a percentage — same units/sign convention as the field it overrides */
  rate: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  /** Expected annual growth rate, as a percentage, e.g. 5 for 5% */
  annualGrowthRate: number;
  /** Regular contribution into this account */
  contributionAmount: number;
  contributionFrequency: Frequency;
  /** A Person.id, or SHARED_OWNER */
  ownerId: string;
  /** Scheduled future changes to annualGrowthRate, e.g. a fixed-term bond maturing into a lower rate. */
  rateChanges?: RateChange[];
}

export type ExpenseCategory = 'regular' | 'variable';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  regular: 'Regular Payments',
  variable: 'Variable Spending',
};

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  /** A Person.id, or SHARED_OWNER */
  ownerId: string;
  /** Only meaningful for expenses — which spending category this falls under */
  category?: ExpenseCategory;
}

export type OneOffKind = 'income' | 'expense';

export interface OneOffEvent {
  id: string;
  name: string;
  /** Which card this belongs to (Income tab vs Outgoings tab) — set at creation, independent of amount's sign. */
  kind: OneOffKind;
  /** Positive = one-off income, negative = one-off expense */
  amount: number;
  /** ISO date string, e.g. "2028-06-01" */
  date: string;
  /** Which account the amount is applied to. If omitted (and no loanId/assetId), treated as pure cash flow. */
  accountId?: string;
  /** Which loan this is an extra repayment against. Mutually exclusive with accountId/assetId. Only offered for kind: 'expense'. */
  loanId?: string;
  /** Which asset's value this adjusts directly (signed). Mutually exclusive with accountId/loanId. Only offered for kind: 'expense'. */
  assetId?: string;
}

export interface Asset {
  id: string;
  name: string;
  value: number;
  /** Percentage; negative models depreciation (e.g. a car) */
  annualGrowthRate: number;
  /** A Person.id, or SHARED_OWNER */
  ownerId: string;
  /** Scheduled future changes to annualGrowthRate, e.g. depreciation slowing after the first few years. */
  rateChanges?: RateChange[];
}

export interface TaxBand {
  /** Annual gross (post-sacrifice) income above this threshold is taxed at `rate`, up to the next band's threshold. */
  threshold: number;
  /** Percentage, e.g. 20 for 20% */
  rate: number;
}

export interface TaxSettings {
  /** Ascending thresholds. Band 0's threshold is the (untapered) personal allowance. */
  incomeTaxBands: TaxBand[];
  /** Income above this tapers away the personal allowance at £1 per £2 over (UK rule). */
  personalAllowanceTaperStart: number;
  niPrimaryThreshold: number;
  niUpperEarningsLimit: number;
  /** NI rate between the primary threshold and the upper earnings limit, as a percentage */
  niMainRate: number;
  /** NI rate above the upper earnings limit, as a percentage */
  niUpperRate: number;
}

export interface SalaryDeduction {
  id: string;
  name: string;
  /** Flat amount, not a percentage of salary */
  amount: number;
  frequency: Frequency;
}

export interface SalaryBonus {
  id: string;
  name: string;
  /** Gross (pre-tax) amount */
  amount: number;
  /** ISO date string, e.g. "2028-06-01" */
  date: string;
}

export interface Salary {
  id: string;
  name: string;
  grossAnnual: number;
  /** Employee salary sacrifice into pension, % of gross, pre-tax and pre-NI */
  sacrificePercent: number;
  /** Employer pension contribution, % of gross, never touches pay or tax */
  employerContributionPercent: number;
  /** Which Account receives the sacrifice + employer contribution */
  pensionAccountId?: string;
  /** Other flat-amount salary sacrifice deductions with no savings destination (e.g. health insurance) — reduce taxable and NI-able pay the same way pension sacrifice does */
  otherDeductions: SalaryDeduction[];
  /** One-off gross bonuses, taxed at this salary's marginal rate in the month they land */
  bonuses: SalaryBonus[];
  /** A Person.id, or SHARED_OWNER */
  ownerId: string;
}

export interface Loan {
  id: string;
  name: string;
  /** Outstanding debt, positive */
  balance: number;
  /** The debt's starting balance, for a "paid off" progress figure */
  originalAmount: number;
  /** Percentage */
  annualInterestRate: number;
  /** Regular payment (interest + principal); stops automatically once the balance hits 0 */
  monthlyPayment: number;
  /** Which Asset this loan is secured against, if any (e.g. a mortgage against a house) */
  assetId?: string;
  /** A Person.id, or SHARED_OWNER */
  ownerId: string;
  /** Scheduled future changes to annualInterestRate, e.g. a mortgage's fixed-rate period ending. */
  rateChanges?: RateChange[];
}

export interface Settings {
  currentAge: number;
  retirementAge: number;
  projectionEndAge: number;
  /** Assumed annual inflation rate, as a percentage */
  inflationRate: number;
  currency: 'GBP' | 'USD' | 'EUR';
  tax: TaxSettings;
  /** Hex colour shown as the identifying dot for the "Shared" bucket. */
  sharedColor: string;
}

export interface AppData {
  income: RecurringItem[];
  expenses: RecurringItem[];
  accounts: Account[];
  assets: Asset[];
  salaries: Salary[];
  loans: Loan[];
  oneOffs: OneOffEvent[];
  people: Person[];
  settings: Settings;
}

export interface ProjectionPoint {
  monthIndex: number;
  isoDate: string;
  age: number;
  accountBalances: Record<string, number>;
  assetBalances: Record<string, number>;
  loanBalances: Record<string, number>;
  totalNetWorth: number;
  totalNetWorthReal: number;
  totalDebt: number;
  totalAssetValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyContributions: number;
  monthlyCashSurplus: number;
  eventsThisMonth: OneOffEvent[];
}
