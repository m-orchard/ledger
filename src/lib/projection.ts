import type { AppData, ProjectionPoint, RateChange } from '../types';
import { calcSalaryBreakdown, calcBonusNet } from './tax';
import { toMonthlyAmount } from './frequency';
import { calcLisaBonus } from './lisa';

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Parses an ISO "YYYY-MM-DD" string as a local date. `new Date(isoString)`
 * parses date-only strings as UTC midnight, but every other date in this
 * module is built from local calendar components (`new Date(y, m, d)`) — mixing
 * the two shifts comparisons by a day (or a whole month, near a month
 * boundary) depending on the browser's timezone offset from UTC.
 */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The rate in effect for `date`, given a base rate and any scheduled future changes — the latest change dated on or before `date` wins. */
function effectiveRate(baseRate: number, changes: RateChange[] | undefined, date: Date): number {
  if (!changes || changes.length === 0) return baseRate;
  let rate = baseRate;
  let latest: Date | null = null;
  for (const c of changes) {
    const d = parseLocalDate(c.date);
    if (d <= date && (!latest || d > latest)) {
      rate = c.rate;
      latest = d;
    }
  }
  return rate;
}

/**
 * Runs a month-by-month simulation from today out to the configured
 * projection end age. Growth is applied first each month, then the
 * regular contribution, then any one-off events dated in that month.
 *
 * This is a deterministic, fixed-rate model (not a Monte Carlo
 * simulation) — it answers "what happens if my assumed rates hold",
 * which is the right starting point before layering in uncertainty.
 * Salaries are likewise modelled as a fixed nominal gross figure.
 */
export function runProjection(data: AppData): ProjectionPoint[] {
  const { settings, accounts, assets, income, expenses, salaries, loans, oneOffs } = data;
  const totalMonths = Math.max(
    0,
    Math.round((settings.projectionEndAge - settings.currentAge) * 12)
  );

  const balances: Record<string, number> = {};
  accounts.forEach((a) => (balances[a.id] = a.balance));

  const assetBalances: Record<string, number> = {};
  assets.forEach((a) => (assetBalances[a.id] = a.value));

  const loanBalances: Record<string, number> = {};
  loans.forEach((l) => (loanBalances[l.id] = l.balance));

  const salaryBreakdowns = salaries.map((s) => calcSalaryBreakdown(s, settings.tax));

  // Each account's own monthly contribution, plus any salary sacrifice/employer
  // pension contributions routed to it, and any Lifetime ISA government bonus.
  // This merged map drives balance growth.
  const contributionsByAccount: Record<string, number> = {};
  accounts.forEach((a) => {
    const ownMonthly = toMonthlyAmount(a.contributionAmount, a.contributionFrequency);
    const bonus = a.type === 'lifetime-isa' ? calcLisaBonus(ownMonthly) : 0;
    contributionsByAccount[a.id] = ownMonthly + bonus;
  });
  salaries.forEach((s, i) => {
    if (s.pensionAccountId && contributionsByAccount[s.pensionAccountId] !== undefined) {
      contributionsByAccount[s.pensionAccountId] += salaryBreakdowns[i].pensionContributionMonthly;
    }
  });

  const recurringIncome = income.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0);
  const recurringExpenses = expenses.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0);
  const salaryTakeHome = salaryBreakdowns.reduce((s, b) => s + b.takeHomeMonthly, 0);
  const baseIncome = recurringIncome + salaryTakeHome;

  // Cash surplus only reflects money that actually moved through take-home pay:
  // salary sacrifice/employer contributions and the Lifetime ISA government bonus
  // never left your bank, so they must not be subtracted again here — only
  // accounts' own contributions count.
  const cashContributions = accounts.reduce(
    (s, a) => s + toMonthlyAmount(a.contributionAmount, a.contributionFrequency),
    0
  );

  const startDate = new Date();
  const points: ProjectionPoint[] = [];

  for (let m = 0; m <= totalMonths; m++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
    const age = settings.currentAge + m / 12;

    const eventsThisMonth = oneOffs.filter((e) => sameMonth(new Date(e.date), date));

    let loanPaymentsThisMonth = 0;

    if (m > 0) {
      // 1. Apply growth (converted from annual to a compounding monthly rate)
      accounts.forEach((a) => {
        const monthlyRate = Math.pow(1 + effectiveRate(a.annualGrowthRate, a.rateChanges, date) / 100, 1 / 12) - 1;
        balances[a.id] = balances[a.id] * (1 + monthlyRate);
      });

      // 2. Apply regular contributions (own + routed salary sacrifice/employer)
      accounts.forEach((a) => {
        balances[a.id] += contributionsByAccount[a.id] ?? 0;
      });

      // 3. Apply one-off events targeted at an account
      eventsThisMonth.forEach((e) => {
        if (e.accountId && balances[e.accountId] !== undefined) {
          balances[e.accountId] += e.amount;
        }
      });

      // 3b. Apply asset growth/depreciation, then one-off events targeted at an asset
      assets.forEach((a) => {
        const monthlyRate = Math.pow(1 + effectiveRate(a.annualGrowthRate, a.rateChanges, date) / 100, 1 / 12) - 1;
        assetBalances[a.id] = assetBalances[a.id] * (1 + monthlyRate);
      });
      eventsThisMonth.forEach((e) => {
        if (e.assetId && assetBalances[e.assetId] !== undefined) {
          assetBalances[e.assetId] += e.amount;
        }
      });

      // 4. Accrue loan interest, then make the regular payment (capped at the
      // remaining balance so payments — and their cost — stop at payoff)
      loans.forEach((l) => {
        const monthlyRate = Math.pow(1 + effectiveRate(l.annualInterestRate, l.rateChanges, date) / 100, 1 / 12) - 1;
        loanBalances[l.id] += loanBalances[l.id] * monthlyRate;
        const payment = Math.min(l.monthlyPayment, loanBalances[l.id]);
        loanBalances[l.id] -= payment;
        loanPaymentsThisMonth += payment;
      });

      // 5. Apply one-off overpayments targeted at a loan
      eventsThisMonth.forEach((e) => {
        if (e.loanId && loanBalances[e.loanId] !== undefined) {
          loanBalances[e.loanId] = Math.max(0, loanBalances[e.loanId] - Math.abs(e.amount));
        }
      });
    } else {
      loanPaymentsThisMonth = loans.reduce(
        (s, l) => s + Math.min(l.monthlyPayment, loanBalances[l.id]),
        0
      );
    }

    const totalDebt = Object.values(loanBalances).reduce((s, v) => s + v, 0);
    const totalAssetValue = Object.values(assetBalances).reduce((s, v) => s + v, 0);
    const totalNetWorth =
      Object.values(balances).reduce((s, v) => s + v, 0) + totalAssetValue - totalDebt;
    const inflationFactor = Math.pow(1 + settings.inflationRate / 100, m / 12);
    const totalNetWorthReal = totalNetWorth / inflationFactor;

    const monthlyExpenses = recurringExpenses + loanPaymentsThisMonth;

    // A salary bonus is taxed at that salary's marginal rate (pushing into a
    // higher band if it's large enough), not treated as flat untaxed cash.
    const netBonusThisMonth = salaries.reduce((s, salary) => {
      const bonusesThisMonth = salary.bonuses.filter((b) => sameMonth(new Date(b.date), date));
      return (
        s + bonusesThisMonth.reduce((sum, b) => sum + calcBonusNet(salary, b.amount, settings.tax).netBonus, 0)
      );
    }, 0);
    const monthlyIncome = baseIncome + netBonusThisMonth;

    // Cash flow not tied to an account, loan, or asset (unassigned one-offs) shown for context only
    const unassignedEventTotal = eventsThisMonth
      .filter((e) => !e.accountId && !e.loanId && !e.assetId)
      .reduce((s, e) => s + e.amount, 0);

    points.push({
      monthIndex: m,
      isoDate: date.toISOString().slice(0, 10),
      age: Math.round(age * 100) / 100,
      accountBalances: { ...balances },
      assetBalances: { ...assetBalances },
      loanBalances: { ...loanBalances },
      totalNetWorth,
      totalNetWorthReal,
      totalDebt,
      totalAssetValue,
      monthlyIncome,
      monthlyExpenses,
      monthlyContributions: cashContributions,
      monthlyCashSurplus:
        monthlyIncome - monthlyExpenses - cashContributions + unassignedEventTotal,
      eventsThisMonth,
    });
  }

  return points;
}

/** Downsamples monthly points to one point per year, for cleaner charting. */
export function toYearlyPoints(points: ProjectionPoint[]): ProjectionPoint[] {
  const yearly: ProjectionPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i % 12 === 0 || i === points.length - 1) {
      yearly.push(points[i]);
    }
  }
  return yearly;
}

export function pointAtAge(
  points: ProjectionPoint[],
  age: number
): ProjectionPoint | undefined {
  return points.find((p) => p.age >= age) ?? points[points.length - 1];
}
