# Ledger — Long-Term Finance Forecaster

A local-first web app for forecasting income, outgoings, savings growth, and
retirement — including notable one-off spending. Runs entirely in your
browser; your data never leaves your machine (it's stored in `localStorage`).

## Why this exists

Off-the-shelf retirement calculators (ProjectionLab, Boldin/NewRetirement,
etc.) are built around US concepts — 401(k)s, Social Security — and don't
model UK pensions, ISAs, or tax bands natively. This is a small, hackable
model you own outright: add whatever real-world detail (UK tax bands,
withdrawal strategies, a Monte Carlo layer) matters to you.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

To build a static production bundle:

```bash
npm run build
npm run preview   # serve the built bundle locally to sanity-check it
```

The output lands in `dist/` — deployable anywhere that serves static files
(GitHub Pages, Netlify, Vercel, a plain S3 bucket, etc.).

## How it works

- **`src/types.ts`** — the data model: `Account`, `RecurringItem`
  (other income/expenses), `Salary`, `Loan`, `OneOffEvent`, `Settings`
  (including `TaxSettings`).
- **`src/lib/tax.ts`** — UK Income Tax and Class 1 National Insurance, as pure
  functions (`calcIncomeTax`, `calcNI`, `calcSalaryBreakdown`). Ships with
  2024/25 rest-of-UK rates (`DEFAULT_TAX_SETTINGS`), editable in Settings.
- **`src/lib/projection.ts`** — the forecasting engine. A deterministic,
  fixed-rate, month-by-month simulation: each account compounds at its own
  assumed annual growth rate, receives its monthly contribution (including
  any salary sacrifice/employer pension contributions routed to it), and
  applies any one-off events dated that month. Loans amortize alongside —
  interest accrues, the payment reduces the balance, and payments stop
  automatically once a loan is paid off. Produces a `ProjectionPoint[]` you
  can chart or tabulate.
- **`src/lib/storage.ts`** — persists the whole `AppData` blob to
  `localStorage` on every change, a `usePersistedData` hook that loads it
  back on start, and backfills fields added after a blob was first saved so
  older saved data keeps loading.
- **`src/components/`** — one component per editable section (salaries,
  income & outgoings, accounts, loans, one-off events, settings + tax bands)
  plus the dashboard (`NetWorthChart`, `SummaryCards`).
- **`src/data/defaultData.ts`** — seed data shown on first run so the app
  isn't empty; replace with your own numbers from the UI.

Data import/export (Settings tab) round-trips the whole model as JSON, so you
can back it up, version it in a private repo, or move it between browsers.

## Model assumptions, and where to extend

This is deliberately a **fixed-rate model**: you tell it the annual growth
rate you expect for each account and it compounds monthly at that rate every
year, with no variance. Salaries and loan terms are likewise modelled as
fixed nominal figures — no assumed pay rises, and no remortgaging. That's the
right starting point for "does my rough plan work at all" — but real life
doesn't move in a straight line. Natural next steps if you want to take it
further:

- **Monte Carlo / sequence-of-returns risk** — replace the fixed
  `annualGrowthRate` with a sampled return distribution per account and run
  `runProjection` thousands of times to get a probability-of-success band
  instead of a single line.
- **Salary growth & remortgaging** — grow `Salary.grossAnnual` and swap
  `Loan.annualInterestRate`/`monthlyPayment` over time instead of holding
  them fixed for the whole projection.
- **ISA allowance & pension annual allowance** — flag contributions that
  exceed the tax-free limits, rather than assuming they're all sheltered.
- **State Pension** — add it as an `Account`-like income stream that starts
  at a configurable age rather than from day one.
- **Withdrawal phase** — the current model only accumulates; add drawdown
  logic (e.g. a safe withdrawal rate) for the retirement-to-end-of-plan
  period.

## Stack

React + TypeScript + Vite, Tailwind CSS for styling, Recharts for the net
worth chart. No backend, no external services — everything runs client-side.
