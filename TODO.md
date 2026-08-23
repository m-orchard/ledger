# TODO

## Data accuracy

- [x] **WOLF pension**: found the real current pot value (£38,805.52 vs the
      £30,538 that was actually total contributions). Money-weighted return
      from the actual 2022/23-2026/27 contribution history works out to
      ~13.9%/year. Balance and growth rate updated in the app.
- [ ] Sanity-check the other overinflated growth rates the same way (Scott
      Logic pension, Trading 212 GIA, Moneybox GIA, Changing Lives pension) —
      these were originally set using 1-year "performance" figures, which are
      too short a window and were the cause of an earlier £44.7M projection
      bug. Use longer annualised windows (3-5yr+) or the fund's own factsheet
      where possible.

## Features

- [x] **Data staleness — "as of" catch-up for balances**: `Account`/`Loan`
      gained `balanceAsOf`, `Asset` gained `valueAsOf` (required, an ISO
      date, backfilled to today on migration for existing data). Before
      `runProjection` runs the forward projection, it now fast-forwards
      each balance/value from its "as of" date to today using the *same*
      monthly engine already built (`catchUpBalance`/`catchUpLoanBalance`
      in `projection.ts`, reusing `effectiveRate` for growth/interest and
      the existing per-account contribution figuring) — not a new
      algorithm, the existing loop run as a backward catch-up phase first.
      Exposed as an editable "As of" date column next to Balance/Value in
      Accounts, Assets, Loans, and the Pensions/LISA tables. Explicitly
      scoped to forecasting accuracy, not a "track actual vs. assumed
      performance" feature (a different, separate idea). Deliberately no
      passive "last updated" badge/reminder — the user will notice their
      balance looks off and edit it, so a nagging UI wasn't judged worth
      it. Along the way, fixed a real timezone bug this surfaced: ISO
      date-only strings parse as UTC midnight while the rest of the engine
      builds dates from local calendar components — `parseLocalDate` in
      `projection.ts` and `todayISO()` in the new `src/lib/date.ts` fix
      this consistently (also fixed in the `projection.test.ts` fixture
      helper that had the same bug).

      **Open sub-problem, still unsolved**: this only fixes the *amount*
      side of staleness, not the *rate* side. A stale balance is a
      mechanical problem the engine can correct by fast-forwarding with
      known assumptions. A stale growth-rate/interest-rate assumption (or a
      salary that hasn't been bumped after a pay rise) is a judgement
      problem — there's no computation that tells you whether 8% is still
      realistic three years later, only a human re-checking does. The
      as-of mechanism doesn't touch this at all; it remains fully unsolved
      and needs its own design pass (the "confirmed as of" / review-nudge
      ideas discussed earlier are candidates, but nothing was decided).
- [ ] **Forecast "profiles"**: support layering hypothetical scenarios (salary
      change, a one-off purchase, adjusted contributions) on top of the base
      "real" data, without losing/overwriting the real numbers — so different
      what-ifs can be compared without re-entering everything.
- [ ] **Time-based salaries**: `Salary.grossAnnual` (and the sacrifice/
      employer percentages) is a single flat figure for the whole
      projection, same as accounts/loans/assets were before "Variable
      rates over time" — but salaries change too (pay rises, a new job, a
      sacrifice percentage adjustment) and there's currently no way to
      schedule that. Natural to model the same way: a `RateChange`-style
      list of scheduled `{ date, grossAnnual }` (and maybe
      sacrifice/employer percentage) changes, picked up by
      `calcSalaryBreakdown`/`runProjection` the same way `effectiveRate`
      already resolves a scheduled value for a given date. Related to the
      still-open "rate side" of data staleness above (a salary that hasn't
      been bumped after a pay rise is the same judgement problem as a
      stale growth-rate assumption) but distinct: this is about
      *scheduling known future changes*, not about *flagging unreviewed
      ones*.
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
- [x] **Variable rates over time**: generalised beyond loans to accounts,
      pensions/LISAs, assets, and loans alike — a new shared `RateChange {
      id, date, rate }` type, held as an optional `rateChanges[]` on
      `Account`/`Asset`/`Loan`. The projection engine's `effectiveRate`
      helper picks the latest scheduled change on or before the current
      month (falling back to the base rate), applied wherever a flat rate
      was read before (account/asset growth, loan interest). This supersedes
      last turn's account-only `maturityDate`/`postMaturityGrowthRate` pair
      (migrated forward automatically). Edited via a minimal text-link
      trigger next to each rate field ("+", or just the count once changes
      exist — full explanation in a tooltip), opening the app's first
      `Modal` popup with a `RateSchedule` list editor (add/edit/remove
      date+rate rows) — chosen over more table columns since it doesn't
      scale past one change and clutters the common no-schedule case.
- [x] **Limited-term accounts/investments**: a fixed-term bond/deposit
      maturing into a different rate is now just a one-entry case of
      "Variable rates over time" above (a single scheduled `RateChange`) —
      folded into that feature rather than kept as its own mechanism.
- [x] **Per-account growth chart, as a stacked composition chart**: `NetWorthChart`
      (Dashboard tab) now shows what net worth is *made of* — accounts/assets
      stack upward from zero, loans stack *downward* as negative values
      (`stackId="assets"` / `stackId="liabilities"`), with a bold "Net worth"
      line overlaid on top (needed switching from `AreaChart` to
      `ComposedChart` — Recharts doesn't reliably surface a plain `<Line>`'s
      legend/tooltip entry when nested in `AreaChart`). Colours are assigned
      from the validated `dataviz`-skill categorical palette, ranked and
      slotted from ONE shared ranking across accounts+assets+loans together
      — not two independent per-direction palettes, which was tried first and
      caused real collisions (a house and a mortgage both landing on slot 1's
      blue). Past 8 total identities, the smallest per direction fold into
      that direction's single "Other" series, coloured a fixed neutral
      (`#898781`) rather than a 9th hue, per the skill's series-count ladder.
      Legend entries are click-to-toggle (Recharts `hide` prop + local
      component state), satisfying "many accounts" without a series cap.
      Visually verified end-to-end via Playwright screenshots (dev server +
      headless Chromium, no project run-skill existed yet) — caught and fixed
      the colour-collision bug this way; a later apparent "chart stops
      halfway across" turned out to be a screenshot-timing artifact
      (Recharts' entrance animation + `page.screenshot({fullPage:true})`
      re-triggering it), not a real bug, confirmed via SVG path/bounding-box
      inspection before moving on.

      **Also decided/built in the same pass — the nominal/real toggle**: the
      chart's old dashed "today's money" line is gone (it was "never fully
      visible" over a multi-decade horizon). Replaced with a Dashboard-tab
      toggle ("Today's money" / "Nominal") above `SummaryCards`, affecting
      both it and this chart — `Settings.showRealValues` (optional, default
      true via `?? true`), persisted like other display prefs. Defaults to
      **real/inflation-adjusted**, deliberately biasing toward underestimating
      rather than overestimating if someone misreads which mode they're in.
      `ProjectionPoint` gained `inflationFactor` so any nominal figure (not
      just the one pre-computed `totalNetWorthReal` aggregate) can be
      converted to today's-money terms — the stacked chart divides each
      account/asset/loan's value by it live rather than needing a real-terms
      figure precomputed per item.

      **Follow-up refinement pass, same feature**: fixed toggle-animation
      overlap (`isAnimationActive={false}` everywhere); the "Net worth" line
      now recomputes from only the currently-visible series on every toggle
      (a real what-if, not just a display filter) and is itself togglable
      (was wired to nothing before); toggle state lifted from `NetWorthChart`
      to `App.tsx` so it survives switching tabs and back; shift+click a
      legend item to isolate it (toggle again to restore); one-off events
      now render as `ReferenceDot` markers on the line (teal for income,
      brick for expense — coloured, not just positioned, so kind is visible
      without hovering), positioned by converting each event's date to an
      age and snapping to the nearest chart point, with a native-tooltip
      title on hover; legend/tooltip now group by owner using the exact same
      rule as everywhere else in the app (`ownerBuckets` — no grouping at
      all when the household has no people added), sharing one `groups`
      structure so legend and tooltip order can never drift apart; legend
      moved to a custom `content` renderer (`layout="vertical" align="right"
      verticalAlign="middle"`) — needed for grouping and for Recharts'
      built-in legend not supporting nested headers; stacked areas are now
      more translucent (`fillOpacity` 0.75 → 0.45) with a dashed stroke
      (`strokeDasharray="4 2"`), reserving solid fill for the "Net worth"
      line as the one element that should read as the headline.
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
- [ ] **Reorder Settings cards**: current order is Data, Household, Forecast
      Assumptions, Income Tax & National Insurance (`SettingsPanel.tsx`) — no
      particular reasoning behind it, revisit for a more sensible order.
- [ ] **Rethink pensions/deductions/bonuses in the Salaries table**: the
      nested "Other deductions" and "Bonuses" rows in `Salaries.tsx` (a
      `<Fragment>` per salary with a main row + two sub-rows of inline chips)
      hasn't been reconsidered since it was first built — worth a fresh look
      at whether that's still the right shape as the table has grown.

## Polish / UX

- [x] **Consistent number formatting**: `formatCurrency` now always shows
      2dp (was 0dp). `NumberInput` defaults to a fixed 2 decimal places too
      (money and percentage fields alike), with the three age fields in
      Settings overridden back to 0dp since fractional ages don't make sense.
- [x] **Select-all-on-focus**: every `NumberInput` and every plain text
      `<input>` across the app now selects its full value on focus (shared
      `selectOnFocus` helper / baked into `NumberInput` directly).
- [ ] **Leaner "as of" columns**: the "As of" date column added to
      Accounts/Assets/Loans/Pensions/LISA tables (native `<input
      type="date">`, always visible, full column width) is heavier than it
      needs to be for a field most rows will rarely touch after first
      entry — same category of problem as the rate-schedule trigger before
      it was shrunk down to "+"/count. Worth a pass once there's a clearer
      idea of what "leaner" should look like here (a compact
      relative-date display like "confirmed" until clicked/hovered? Fold
      it into a schedule-style popup instead of a standing column? Smaller
      date-input styling?) — no direction decided yet, just flagged as
      worth revisiting.
- [ ] **Colour picker visual artifacts**: the native `<input type="color">`
      swatches in `People.tsx` (per-person + Shared) have some visual
      rough edges worth tidying up — not yet diagnosed exactly what.
- [ ] **Owner-dropdowns should group by person**: `<select>` dropdowns that
      list accounts/loans/etc. as plain flat options — Loans' "Secured
      against" (`Loans.tsx`), One-off Events' account/loan/asset target
      (`OneOffEvents.tsx`), Salaries' "Pension account" (`Salaries.tsx`) —
      should group their `<option>`s by owner via `<optgroup>`, same rule as
      everywhere else (no grouping with no household set up). Loans'
      dropdown already filters to one owner so grouping may not apply there;
      One-off Events' target dropdown spans all owners and is the clearest
      case.
- [ ] **Rename "Today's money" → "Inflation-adjusted"**: the Dashboard
      nominal/real toggle and its labels (`App.tsx`, `SummaryCards.tsx`,
      `NetWorthChart.tsx`) — "Inflation-adjusted" is the more precise term.
- [ ] **Move long descriptions into info popups**: several cards carry a
      paragraph-length hint under the title (Accounts, Loans, Assets,
      PensionsAndLisas, Salaries, RateSchedule, etc.) — move the longer ones
      behind an "ⓘ" popup instead of always-on paragraph text, so the card
      reads cleaner at a glance. Related to the next item — decide together
      which explanatory text stays inline, which moves to a popup, and which
      just gets deleted, rather than doing three separate passes.
- [ ] **Remove some inline how-to helper text**: things like the "Shift+click
      to isolate" hint on the net worth chart, the RateSchedule modal's
      "changes apply from their date onward" line, etc. — some of this reads
      as over-explaining once the interaction is familiar. Do this alongside
      the info-popup pass above rather than separately, since both are
      about the same underlying question (what explanatory text earns its
      place, and where it lives).

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
