import type { AppData, ProjectionPoint, RateChange, Salary } from '../types';
import { calcSalaryBreakdown, calcBonusNet, type SalaryBreakdown } from './tax';
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
export function parseLocalDate(iso: string): Date {
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
 * A salary's grossAnnual/sacrificePercent/employerContributionPercent as they stand for
 * `date`, given any scheduled future changes — same "latest wins" rule as effectiveRate,
 * except a change always fully replaces all three fields together, never a partial override
 * (mirrors how a SalaryChange is defined).
 */
function effectiveSalary(salary: Salary, date: Date): Salary {
  const changes = salary.scheduledChanges;
  if (!changes || changes.length === 0) return salary;
  let effective = salary;
  let latest: Date | null = null;
  for (const c of changes) {
    const d = parseLocalDate(c.date);
    if (d <= date && (!latest || d > latest)) {
      effective = {
        ...salary,
        grossAnnual: c.grossAnnual,
        sacrificePercent: c.sacrificePercent,
        employerContributionPercent: c.employerContributionPercent,
      };
      latest = d;
    }
  }
  return effective;
}

/**
 * Whether `salary` is still "live" for `date` — false from its `endDate`'s month onward, if
 * set. Ended salaries contribute nothing (income, tax, NI, pension routing, bonuses) from that
 * point, but nothing about the salary itself is deleted; this only affects the projection.
 */
function isSalaryActive(salary: Salary, date: Date): boolean {
  return !salary.endDate || date < parseLocalDate(salary.endDate);
}

/** A breakdown of all zeros, for a salary that has ended (see isSalaryActive) — avoids running its figures (e.g. flat otherDeductions) through the normal formulas against a zeroed gross, which could otherwise go negative. */
const ZERO_SALARY_BREAKDOWN: SalaryBreakdown = {
  takeHomeMonthly: 0,
  incomeTaxMonthly: 0,
  niMonthly: 0,
  sacrificeMonthly: 0,
  employerContributionMonthly: 0,
  pensionContributionMonthly: 0,
  otherDeductionsMonthly: 0,
};

/** Whole calendar months between two day-1 dates, never negative (e.g. an "as of" date in the future). */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

/**
 * Fast-forwards a balance from its "as of" date to `today`, applying the same
 * monthly growth (and, for accounts, contribution) the main projection loop
 * would have applied over that gap — so a balance that's months old doesn't
 * silently miss growth/contributions that have already happened. Assumes
 * they continued exactly as configured, consistent with this being a
 * fixed-rate model throughout.
 */
function catchUpBalance(balance: number, asOf: string, today: Date, rateAt: (date: Date) => number, monthlyContribution = 0): number {
  const asOfDate = parseLocalDate(asOf);
  const start = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
  const months = monthsBetween(start, today);
  let result = balance;
  for (let i = 1; i <= months; i++) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthlyRate = Math.pow(1 + rateAt(date) / 100, 1 / 12) - 1;
    result = result * (1 + monthlyRate) + monthlyContribution;
  }
  return result;
}

/** As `catchUpBalance`, but for a loan: interest accrues, then the payment reduces the balance (capped so it can't go negative). */
function catchUpLoanBalance(balance: number, asOf: string, today: Date, rateAt: (date: Date) => number, monthlyPayment: number): number {
  const asOfDate = parseLocalDate(asOf);
  const start = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
  const months = monthsBetween(start, today);
  let result = balance;
  for (let i = 1; i <= months; i++) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthlyRate = Math.pow(1 + rateAt(date) / 100, 1 / 12) - 1;
    result += result * monthlyRate;
    result -= Math.min(monthlyPayment, result);
  }
  return result;
}

/**
 * Runs a month-by-month simulation from today out to the configured
 * projection end age. Growth is applied first each month, then the
 * regular contribution, then any one-off events dated in that month.
 *
 * This is a deterministic, fixed-rate model (not a Monte Carlo
 * simulation) — it answers "what happens if my assumed rates hold",
 * which is the right starting point before layering in uncertainty.
 * A salary's gross/sacrifice/employer figures are likewise fixed nominal
 * values unless scheduled to change via `Salary.scheduledChanges`.
 */
export function runProjection(data: AppData): ProjectionPoint[] {
  const { settings, accounts, assets, income, expenses, salaries, loans, oneOffs } = data;
  const totalMonths = Math.max(
    0,
    Math.round((settings.projectionEndAge - settings.currentAge) * 12)
  );

  const startDate = new Date();
  const today = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  // Each account's own monthly contribution, plus any Lifetime ISA government bonus. The
  // salary-routed portion (sacrifice + employer) is added separately, per month, inside the
  // loop below — it can now vary over time via a salary's scheduledChanges, so it can no
  // longer be folded into one fixed-for-the-whole-projection map the way this used to be.
  const ownContributionByAccount: Record<string, number> = {};
  accounts.forEach((a) => {
    const ownMonthly = toMonthlyAmount(a.contributionAmount, a.contributionFrequency);
    const bonus = a.type === 'lifetime-isa' ? calcLisaBonus(ownMonthly) : 0;
    ownContributionByAccount[a.id] = ownMonthly + bonus;
  });

  // Balances are stored "as of" a date that may be in the past — fast-forward each to today
  // first (see catchUpBalance/catchUpLoanBalance above) so a months-old figure isn't silently
  // treated as true right now. The catch-up pass assumes today's effective salary figures
  // held steady during that gap — the same simplifying assumption already made for every
  // other flat rate/contribution here.
  const todaysSalaryBreakdowns = salaries.map((s) =>
    isSalaryActive(s, today) ? calcSalaryBreakdown(effectiveSalary(s, today), settings.tax) : ZERO_SALARY_BREAKDOWN
  );
  const contributionsByAccountToday: Record<string, number> = { ...ownContributionByAccount };
  salaries.forEach((s, i) => {
    if (s.pensionAccountId && contributionsByAccountToday[s.pensionAccountId] !== undefined) {
      contributionsByAccountToday[s.pensionAccountId] += todaysSalaryBreakdowns[i].pensionContributionMonthly;
    }
  });

  const balances: Record<string, number> = {};
  accounts.forEach((a) => {
    balances[a.id] = catchUpBalance(
      a.balance,
      a.balanceAsOf,
      today,
      (date) => effectiveRate(a.annualGrowthRate, a.rateChanges, date),
      contributionsByAccountToday[a.id] ?? 0
    );
  });

  const assetBalances: Record<string, number> = {};
  assets.forEach((a) => {
    assetBalances[a.id] = catchUpBalance(a.value, a.valueAsOf, today, (date) =>
      effectiveRate(a.annualGrowthRate, a.rateChanges, date)
    );
  });

  const loanBalances: Record<string, number> = {};
  loans.forEach((l) => {
    loanBalances[l.id] = catchUpLoanBalance(
      l.balance,
      l.balanceAsOf,
      today,
      (date) => effectiveRate(l.annualInterestRate, l.rateChanges, date),
      l.monthlyPayment
    );
  });

  const recurringIncome = income.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0);
  const recurringExpenses = expenses.reduce((s, i) => s + toMonthlyAmount(i.amount, i.frequency), 0);

  // Cash surplus only reflects money that actually moved through take-home pay:
  // salary sacrifice/employer contributions and the Lifetime ISA government bonus
  // never left your bank, so they must not be subtracted again here — only
  // accounts' own contributions count.
  const cashContributions = accounts.reduce(
    (s, a) => s + toMonthlyAmount(a.contributionAmount, a.contributionFrequency),
    0
  );

  const points: ProjectionPoint[] = [];

  for (let m = 0; m <= totalMonths; m++) {
    const date = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const age = settings.currentAge + m / 12;

    const eventsThisMonth = oneOffs.filter((e) => sameMonth(new Date(e.date), date));

    // Each salary's gross/sacrifice/employer figures resolved for this month's date — they
    // can change over time via scheduledChanges (a pay rise, a new job, etc), or drop to
    // nothing entirely once past the salary's endDate (the role has ended).
    const salaryBreakdownsThisMonth = salaries.map((s) =>
      isSalaryActive(s, date) ? calcSalaryBreakdown(effectiveSalary(s, date), settings.tax) : ZERO_SALARY_BREAKDOWN
    );

    let loanPaymentsThisMonth = 0;

    if (m > 0) {
      // 1. Apply growth (converted from annual to a compounding monthly rate)
      accounts.forEach((a) => {
        const monthlyRate = Math.pow(1 + effectiveRate(a.annualGrowthRate, a.rateChanges, date) / 100, 1 / 12) - 1;
        balances[a.id] = balances[a.id] * (1 + monthlyRate);
      });

      // 2. Apply regular contributions (own + routed salary sacrifice/employer, resolved above for this month)
      accounts.forEach((a) => {
        let contribution = ownContributionByAccount[a.id] ?? 0;
        salaries.forEach((s, i) => {
          if (s.pensionAccountId === a.id) {
            contribution += salaryBreakdownsThisMonth[i].pensionContributionMonthly;
          }
        });
        balances[a.id] += contribution;
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

      // 5. Apply one-off events targeted at a loan — same signed convention as accounts/assets:
      // negative (an expense, money leaving you) is an extra repayment, positive (income, money
      // coming to you) is borrowing more, e.g. a further advance.
      eventsThisMonth.forEach((e) => {
        if (e.loanId && loanBalances[e.loanId] !== undefined) {
          loanBalances[e.loanId] = Math.max(0, loanBalances[e.loanId] + e.amount);
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
    // higher band if it's large enough), not treated as flat untaxed cash —
    // against that salary's gross/sacrifice figures as they stand this month.
    // A bonus dated after the salary's endDate doesn't apply — the role's ended.
    const netBonusThisMonth = salaries.reduce((s, salary) => {
      if (!isSalaryActive(salary, date)) return s;
      const bonusesThisMonth = salary.bonuses.filter((b) => sameMonth(new Date(b.date), date));
      const effective = effectiveSalary(salary, date);
      return (
        s + bonusesThisMonth.reduce((sum, b) => sum + calcBonusNet(effective, b.amount, settings.tax).netBonus, 0)
      );
    }, 0);
    const salaryTakeHomeThisMonth = salaryBreakdownsThisMonth.reduce((s, b) => s + b.takeHomeMonthly, 0);
    const monthlyIncome = recurringIncome + salaryTakeHomeThisMonth + netBonusThisMonth;

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
      inflationFactor,
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
