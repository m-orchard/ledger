# TODO

## Data accuracy

- [x] **WOLF pension**: found the real current pot value (£38,805.52 vs the
      £30,538 that was actually total contributions). Money-weighted return
      from the actual 2022/23-2026/27 contribution history works out to
      ~13.9%/year. Still to do: update the account's balance (£38,805.52) and
      growth rate in the app — leaning toward something tempered below 13.9%
      (e.g. 8-11%) for a 28-year forward assumption.
- [ ] Sanity-check the other overinflated growth rates the same way (Scott
      Logic pension, Trading 212 GIA, Moneybox GIA, Changing Lives pension) —
      these were originally set using 1-year "performance" figures, which are
      too short a window and were the cause of an earlier £44.7M projection
      bug. Use longer annualised windows (3-5yr+) or the fund's own factsheet
      where possible.

## Features

- [ ] **Data staleness**: figure out what functionality would help when
      point-in-time values (balances, salaries, etc.) drift out of date after
      a few months — e.g. a "last updated" timestamp per item, reminders, or
      an easy bulk-review flow.
- [ ] **Forecast "profiles"**: support layering hypothetical scenarios (salary
      change, a one-off purchase, adjusted contributions) on top of the base
      "real" data, without losing/overwriting the real numbers — so different
      what-ifs can be compared without re-entering everything.
- [x] **Salary bonuses**: bonuses live on the Salary itself now (a nested
      list, same pattern as "Other sacrifice deductions"), not as a
      salary-targeted One-off Event — a bonus is income, and One-off Events
      now lives under the Outgoings tab, so this avoided re-introducing that
      exact mismatch. Taxed at that salary's marginal rate (tax/NI on annual
      pay+bonus minus tax/NI on annual pay alone), landing in that month's
      income/cash surplus only.
- [x] **One-off payments on debt** — confirmed already supported (One-off
      Events can target a loan as an extra repayment: fixed monthly payment,
      earlier payoff). No change needed.
- [ ] **Variable loan rates over time**: mortgages (and maybe other loans)
      often have a fixed-rate period that ends and reverts to a different
      rate, or scheduled rate changes at renewal — currently a loan only has
      one flat rate for the whole projection.
- [ ] **Limited-term accounts/investments**: fixed-term bonds/deposits that
      lock money for a set period at a set rate, then mature — currently all
      accounts compound indefinitely with no maturity behaviour.
- [ ] **Per-account growth chart**: visualise net worth over time for one or
      a chosen subset of accounts/savings, not just the total (the dashboard
      chart currently only plots the combined total).
- [ ] **Auto-fetch tax/NI bands**: pull current Income Tax bands and NI
      thresholds from a public API or gov.uk source instead of relying on
      manually editing `TaxSettingsPanel` each tax year — related to "Data
      staleness" above, but specific to the tax data. Needs research: no
      obvious first-party HMRC API for this; may mean scraping a gov.uk page
      or finding a maintained third-party source, so check reliability/terms
      of use before building on top of one.

## Layout

- [x] **Reorganise tabs/layout**: split into Dashboard / Income / Outgoings /
      Investments & Assets / Settings. Outgoings holds regular+variable
      spending, Loans, and One-off Spending; Income holds Salaries, Other
      income, and One-off Income; Investments & Assets holds Pensions &
      Lifetime ISAs, Accounts, and Assets. One-off Events is now split into
      two cards (Income tab / Outgoings tab) via a stable `kind` field set at
      creation — resolves the earlier "positive one-off under Outgoings"
      mismatch, and each card restricts what can be targeted (only Outgoings
      offers Loans/Assets) and whether the amount can go negative.

## Polish / UX

- [x] **Consistent number formatting**: `formatCurrency` now always shows
      2dp (was 0dp). `NumberInput` defaults to a fixed 2 decimal places too
      (money and percentage fields alike), with the three age fields in
      Settings overridden back to 0dp since fractional ages don't make sense.
- [x] **Select-all-on-focus**: every `NumberInput` and every plain text
      `<input>` across the app now selects its full value on focus (shared
      `selectOnFocus` helper / baked into `NumberInput` directly).

## Architecture / Tech debt

- [x] **Reusable components**: extracted three shared components that were
      duplicated across most of the app — `OwnerGroupedList` (the
      `ownerBuckets(...).map(...)` block: per-owner colour dot, name,
      running total, falling back to a flat list with no household set up),
      used by Accounts, Assets, Loans, Salaries, LineItemTable, and both
      PensionsAndLisas sections; `Card` (the `bg-surface border border-rule
      rounded-sm p-5` wrapper), used by nearly every top-level card;
      `RemoveButton` (the `×` remove control, `sm`/`xs` sizes), used
      wherever a row can be deleted. Left alone: a shared table-row
      component for Accounts/Assets/Pensions, since their columns differ
      enough (contribution frequency, LISA bonus, pension source) that a
      generic row would need more optional slots than it'd save; and
      `SummaryCards`'s own small stat-tile `Card` (label/value/sub/tone),
      which is a different shape of component, not more of the same
      duplication.
- [x] **Shared state**: `people`, `sharedColor`, and `currency` now come
      from a `useAppSettings()` React context (`AppSettingsContext.tsx`),
      provided once in `App.tsx` around the tab content, instead of being
      threaded as individual props through Accounts, Assets, Loans,
      Salaries, PensionsAndLisas, LineItemTable, AddWithOwner, OneOffEvents,
      SummaryCards, and NetWorthChart. `SettingsPanel`/`People` still take
      `people`/`sharedColor` as explicit props since they're the writers
      (need the `onChange` callbacks), not just readers.
