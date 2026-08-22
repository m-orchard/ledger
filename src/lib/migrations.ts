import { DEFAULT_TAX_SETTINGS } from './tax';
import { SHARED_OWNER, PERSON_COLOR_PALETTE, DEFAULT_SHARED_COLOR } from '../types';

/**
 * Ordered migrations for the persisted data blob. migrations[i] upgrades a
 * blob from schema version (i + 1) to (i + 2). Each function should be
 * liberal in what it accepts (data may be missing fields from any older
 * version) and return the upgraded shape.
 */
export const migrations: ((data: any) => any)[] = [
  // v1 -> v2: salaries, loans, and UK tax bands were introduced.
  (data) => ({
    ...data,
    salaries: data.salaries ?? [],
    loans: data.loans ?? [],
    settings: { ...data.settings, tax: data.settings?.tax ?? DEFAULT_TAX_SETTINGS },
  }),
  // v2 -> v3: per-row frequency, household ownership tagging, ISA split.
  (data) => ({
    ...data,
    people: data.people ?? [],
    income: (data.income ?? []).map((item: any) => ({
      frequency: 'monthly',
      ownerId: SHARED_OWNER,
      ...item,
    })),
    expenses: (data.expenses ?? []).map((item: any) => ({
      frequency: 'monthly',
      ownerId: SHARED_OWNER,
      ...item,
    })),
    accounts: (data.accounts ?? []).map((a: any) => {
      const { monthlyContribution, ...rest } = a;
      return {
        contributionAmount: monthlyContribution ?? a.contributionAmount ?? 0,
        contributionFrequency: a.contributionFrequency ?? 'monthly',
        ownerId: SHARED_OWNER,
        ...rest,
        type: rest.type === 'isa' ? 'stocks-isa' : rest.type,
      };
    }),
    salaries: (data.salaries ?? []).map((s: any) => ({ ownerId: SHARED_OWNER, ...s })),
    loans: (data.loans ?? []).map((l: any) => ({ ownerId: SHARED_OWNER, ...l })),
  }),
  // v3 -> v4: Assets (house/car), linkable to loans; loans track their original amount.
  (data) => ({
    ...data,
    assets: data.assets ?? [],
    loans: (data.loans ?? []).map((l: any) => ({ originalAmount: l.balance, ...l })),
  }),
  // v4 -> v5: expenses split into Regular Payments vs Variable Spending.
  (data) => ({
    ...data,
    expenses: (data.expenses ?? []).map((item: any) => ({ category: 'regular', ...item })),
  }),
  // v5 -> v6: salaries can have other flat-amount sacrifice deductions (e.g. health insurance).
  (data) => ({
    ...data,
    salaries: (data.salaries ?? []).map((s: any) => ({ otherDeductions: s.otherDeductions ?? [], ...s })),
  }),
  // v6 -> v7: bonuses moved from salary-targeted one-off events onto the salary itself
  // (a bonus is taxed against that salary specifically, and isn't really an "outgoing").
  (data) => {
    const salaryBonusesById: Record<string, any[]> = {};
    const remainingOneOffs: any[] = [];
    for (const e of data.oneOffs ?? []) {
      if (e.salaryId) {
        (salaryBonusesById[e.salaryId] ??= []).push({ id: e.id, name: e.name, amount: e.amount, date: e.date });
      } else {
        remainingOneOffs.push(e);
      }
    }
    return {
      ...data,
      oneOffs: remainingOneOffs,
      salaries: (data.salaries ?? []).map((s: any) => ({
        bonuses: [...(s.bonuses ?? []), ...(salaryBonusesById[s.id] ?? [])],
        ...s,
      })),
    };
  },
  // v7 -> v8: one-off events split into "income" and "expense" cards (Income vs
  // Outgoings tab) via a stable `kind`, rather than everything living in one
  // list under Outgoings regardless of direction.
  (data) => ({
    ...data,
    oneOffs: (data.oneOffs ?? []).map((e: any) => ({
      kind: e.loanId || e.assetId || e.amount < 0 ? 'expense' : 'income',
      ...e,
    })),
  }),
  // v8 -> v9: each person (and the "Shared" bucket) gets a configurable colour dot.
  (data) => ({
    ...data,
    people: (data.people ?? []).map((p: any, i: number) => ({
      color: PERSON_COLOR_PALETTE[i % PERSON_COLOR_PALETTE.length],
      ...p,
    })),
    settings: { sharedColor: DEFAULT_SHARED_COLOR, ...data.settings },
  }),
];

export const CURRENT_SCHEMA_VERSION = migrations.length + 1;
