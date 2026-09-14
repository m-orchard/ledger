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

      **Follow-up fix — one-off events dated in the past were silently
      dropped**: found while chasing a real "net worth at 65 looks ~10x
      lower than before" report. Traced it to a `git bisect` that turned
      out to be unreliable (replaying real localStorage data, already
      migrated to the newest schema, through old commits' own — older,
      incompatible — migration chains produces misleading results; not a
      valid way to bisect a stateful app). The actual cause was unrelated
      to any specific commit: `runProjection`'s month loop only ever ran
      forward from today, so a one-off event dated before today's month
      could never match any month the loop visited — it vanished from the
      projection entirely, with none of the "fast-forward what would have
      happened" treatment balances already got. Fixed by unifying the
      separate `catchUpBalance`/`catchUpLoanBalance` pre-pass with the
      main loop: it now starts from the *earliest* date anything is
      anchored to (any account/asset/loan's "as of" date, or any one-off
      event's date) rather than from today, with each account/asset/loan
      individually gated to only start accruing once the simulation
      reaches *its own* "as of" month (they can each be stale by a
      different amount) — and critically, one-off events apply at every
      iteration regardless of that gating, including the very first one,
      so an event dated at the earliest simulated month still fires. Only
      points from today onward are actually returned. A genuine side
      benefit: catch-up now applies whatever salary/rate changes were
      actually scheduled during that historical gap, rather than assuming
      today's figures held steady throughout (the prior simplification).
      Verified against all 69 pre-existing tests unchanged (proving the
      no-catch-up-needed case is untouched), plus 3 new tests for the fix
      itself (a past-dated account event, a past-dated loan repayment,
      and two accounts with independently different staleness catching up
      correctly side by side).
- [ ] **Forecast "profiles"**: support layering hypothetical scenarios (salary
      change, a one-off purchase, adjusted contributions) on top of the base
      "real" data, without losing/overwriting the real numbers — so different
      what-ifs can be compared without re-entering everything.
- [x] **Time-based salaries**: new `SalaryChange { id, date, grossAnnual,
      sacrificePercent, employerContributionPercent }`, on an optional
      `Salary.scheduledChanges[]` (no migration needed — same pattern as
      `rateChanges`). A change fully replaces all three fields together
      ("latest one on/before the date wins", same rule as `RateChange`)
      rather than allowing a partial override, avoiding any ambiguity
      about what a partial change would even mean. Edited via a
      `SalarySchedule` trigger next to Gross/yr — same `+`/count-then-Modal
      pattern as `RateSchedule`, one compact row per change (date +
      gross/sacrifice %/employer %) with column labels shown once above
      the list, not per row. First pass used a bordered card per entry
      with its own repeated field labels; caught on review as the same
      shape of redundancy trimmed everywhere else this session, and also
      a worse fit for someone with several changes over a long projection
      (a promotion or two, a job change) — switched to the row layout,
      confirmed it fits the modal's width with no overflow.

      The real work was in `projection.ts`: salary breakdowns
      (tax/NI/take-home/pension-contribution) used to be computed *once*,
      before the month loop even started, and reused unchanged for every
      month of the projection — `baseIncome` and the salary-routed portion
      of `contributionsByAccount` were both fixed constants. Made this
      genuinely month-by-month: a new `effectiveSalary(salary, date)`
      resolver (mirrors `effectiveRate` but resolves three linked fields
      together) is used to recompute each salary's breakdown fresh inside
      the loop, for both the take-home income figure and the pension
      contribution routed to a linked account each month, and also for a
      bonus's marginal-rate tax calculation (now computed against that
      salary's figures *as they stood on the bonus's own date*, not
      whatever they are today). The one-time pre-loop computation is kept
      only for the "as of" catch-up phase, using today's effective figures
      as its steady assumption for the historical gap — same simplifying
      approach already used there for every other flat rate/contribution.
      Added tests covering a pay rise changing take-home income from its
      date onward, and a scheduled sacrifice/employer % change altering
      what's routed to a linked pension account from its date onward, on
      top of the 59 existing tests (all still pass unchanged, confirming
      the refactor didn't alter behaviour for salaries with no schedule).

      **Follow-up, same pass**: reviewing the row-vs-card layout question
      above led to a real gap this feature had introduced — there was no
      way to mark a role as "ended" at all, only to delete the Salary row
      outright (immediate, retroactive to the whole projection, and
      destroys its bonus/deduction history). Fixed with `Salary.endDate?:
      string` — from that date, `isSalaryActive()` makes the salary
      contribute nothing (income/tax/NI/pension routing/bonuses) via a
      `ZERO_SALARY_BREAKDOWN` short-circuit (avoids running flat
      `otherDeductions` through the normal formula against a zeroed gross,
      which would otherwise go negative), while the row, its bonuses,
      deductions, and scheduled-change history are all left exactly as
      entered. Editable from the same `SalarySchedule` popup (a "Role
      ends" field at the top, with a "clear" link) rather than a new
      trigger — it's the natural home for "things that change this
      salary's status over time." The trigger itself turns brick-coloured
      and reads "ended" once set, and the main table shows "Ended
      {date}" under the salary's name, so this is visible without opening
      anything. The card's own "current" summary totals (`totalTakeHome`
      and the per-owner `OwnerGroupedList` total) also exclude a salary
      whose end date has already passed, via a `hasEnded()` check — those
      are a today-only snapshot, not projection-aware, so they needed the
      same fix independently of the engine change. Added two tests: income
      and pension routing stop from the end date (with a flat deduction
      present, to specifically exercise the negative-taxable-income
      pitfall), and a bonus dated after the end date is excluded.

      **Second follow-up, same pass**: asked whether changes can overlap —
      they can't, by construction: `effectiveRate`/`effectiveSalary` only
      ever pick one "latest date on or before" winner, so a change is
      implicitly in effect until the next-dated one takes over. The one
      real gap was two changes sharing the *exact same* date, which
      silently fell back to array order (first-in-array wins) rather than
      anything meaningful. Added `src/lib/scheduleValidation.ts`
      (`hasDateCollision`, `firstFreeDate`), shared by `RateSchedule` and
      `SalarySchedule`: a date edit that would collide with another entry
      in the same list is rejected (the field's border turns brick, with
      an inline "Already have a change on that date" message) rather than
      silently applied, and a newly-added change's default date is bumped
      forward to the first free day instead of risking an instant
      collision. Caught a real bug writing `firstFreeDate` itself — its
      day-increment used `.toISOString()`, which converts to UTC and can
      shift the date backward a day depending on timezone offset, turning
      "add a day" into "add nothing" and looping forever; reproduced as an
      actual browser tab crash via Playwright before being fixed to use
      local calendar components throughout, the same discipline
      `parseLocalDate`/`todayISO()` already enforce elsewhere in this
      codebase. Added `scheduleValidation.test.ts` (6 tests, including a
      regression case spanning a year boundary) to lock in the fix.
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
- [ ] **Implicit "unallocated cash" balance — money shouldn't disappear from
      net worth**: right now `monthlyCashSurplus` (`projection.ts`) —
      income minus expenses minus loan payments minus each account's own
      `contributionAmount` — is computed fresh every month and then
      discarded. Anything you earn but haven't explicitly routed into a
      specific account's contribution currently just vanishes from net
      worth, which is misleading (net worth should never lose track of real
      money). Decided direction: accumulate that same surplus figure into
      an implicit "Unallocated cash" balance instead of discarding it,
      include it in `totalNetWorth`, and surface it as its own band in the
      stacked `NetWorthChart` — no new calculation needed, the number
      already exists, this is about keeping it instead of throwing it away.
      Since routed contributions are already subtracted out of the surplus
      formula, adding a real contribution elsewhere naturally shrinks this
      pot with no double-counting to worry about.

      **Open question — deficits**: a negative monthly surplus has to come
      from *somewhere* real (an existing account being drawn down, or debt
      building up) — letting the implicit balance just go negative would
      read like a free, consequence-free overdraft, which is the opposite
      of the honesty this is meant to add. Candidate approaches, roughly in
      order of how much they'd take to build: (a) let it go negative but
      label it plainly as a shortfall, not "cash"; (b) cap it at zero and
      surface a loud warning instead ("you're on track to run out of money
      by age X"); (c) let the user point deficits at a specific real
      account/loan to draw down. Leaning toward (b) as the first cut,
      punting (c) as a later refinement.

      **Open question — per person**: `income`/`expenses` already carry an
      `ownerId`, so this could be either one shared pot or a per-person
      pot — the latter would also close the exact same "money disappears"
      gap that currently exists in the "By person" dashboard cards (their
      net worth and cash-flow figures aren't reconciled with each other
      either). Not decided.

      **Related, smaller idea also raised in the same conversation**:
      independent of whether the above gets built, a simpler standalone
      warning — "you have a £X/mo surplus that isn't going into any
      account" — would at least surface the gap without fully solving it.
      Worth keeping as a fallback/interim option if the fuller version
      above turns out to be too much to take on at once.

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
- [x] **Reorder Settings cards**: reordered to Household, Forecast
      Assumptions, Income Tax & National Insurance, Data (`SettingsPanel.tsx`)
      — people first since everything else references them, then the core
      forecast dials, then the more detailed tax refinement of the same
      forecast, with the administrative Export/Import card last since it
      isn't really a forecast setting.
- [x] **Rethink pensions/deductions/bonuses in the Salaries table**: the
      always-rendered sub-rows are gone. Pension account/sacrifice/employer %
      collapsed into a single "Pension" trigger column (`PensionControl`,
      same `+`/label-then-Modal pattern as `RateSchedule`), showing the
      linked account name and, inside the modal, the computed £/mo effect
      of each % (previously invisible without switching tabs) — built
      `PensionRateFields` as a small shared component so the same editable
      fields work from both directions. "Other deductions" and "Bonuses"
      merged into one "Extras" trigger column (`ExtrasControl`) opening a
      single modal with both lists stacked, rather than two separate
      columns each holding just a small button. Also, from the other
      direction: a pension account's "Contribution/mo" figure on the
      Pensions & LISA table is now itself a trigger (when at least one
      salary is linked to it) opening a popup listing every linked salary
      (handles the real, if rare, case of one pension fed by more than one
      salary) with the same editable fields — closes the loop without
      moving data ownership (the sacrifice % still lives on the Salary,
      since it affects that salary's own tax/NI). Required threading a new
      `onSalariesChange` prop into `PensionsAndLisas`, which previously
      only had read access to `salaries`. Along the way, fixed a `min-w-0`
      flexbox overflow bug on modal name fields, and caught (twice) new
      explanatory paragraphs sneaking back into the Extras modal that
      duplicated content already moved to the Guide page during the
      earlier text-review pass — worth double-checking newly-built popups
      against that same standard going forward, not just the original pass.

## Polish / UX

- [x] **One-off event amount sign is inconsistent across targets**: first
      attempt made loan-targeted rows unsigned/repayment-only, but that
      foreclosed a real scenario — borrowing more against an existing loan
      (a further advance, releasing equity, drawing down a flexible/offset
      mortgage) genuinely increases what's owed. Corrected fix: made sign
      *meaningful* rather than removing it, using the exact same formula
      already used for accounts/assets. `projection.ts`'s loan-application
      line changed from `loanBalances[id] - Math.abs(e.amount)` to
      `loanBalances[id] + e.amount` (still clamped at 0) — negative
      (expense, money leaving you) is an extra repayment, positive
      (income, money coming to you) is borrowing more, exactly matching
      `balances[id] += e.amount` for accounts/assets rather than being a
      special case. `OneOffEvents.tsx` reverted to the original signed
      `NumberInput` (no more forced-positive normalisation on target
      change), with a short caption restored explaining what each sign
      means specifically for a loan target (unlike accounts, "positive
      increases the balance" isn't obvious when the balance represents
      debt). Added a test locking in the new "borrowing more" case
      alongside the existing repayment one.

- [x] **Consistent number formatting**: `formatCurrency` now always shows
      2dp (was 0dp). `NumberInput` defaults to a fixed 2 decimal places too
      (money and percentage fields alike), with the three age fields in
      Settings overridden back to 0dp since fractional ages don't make sense.
- [x] **Select-all-on-focus**: every `NumberInput` and every plain text
      `<input>` across the app now selects its full value on focus (shared
      `selectOnFocus` helper / baked into `NumberInput` directly).
- [x] **Leaner "as of" columns**: the standing "As of" column is gone from
      Accounts/Assets/Loans/Pensions/LISA tables — replaced with a small
      calendar icon next to the Balance/Value field itself (`AsOfField`),
      whose hover title shows a compact relative label ("today", "3d
      ago", "5mo ago" — `formatRelativeDate` in `date.ts`) and which opens
      a small anchored `Popover` (new primitive, lighter than `Modal`: no
      backdrop, closes on outside click/Escape) with the date field and a
      "Today" shortcut, only when clicked. Deliberately does *not*
      auto-stamp the date whenever the balance changes (decided against —
      "could create confusion," since a balance edit isn't necessarily a
      fresh confirmation, e.g. correcting a typo). Instead, editing an
      existing row's balance to a genuinely different value (checked on
      blur, via `useAsOfAutoOpen`) auto-opens the popover as a nudge,
      leaving the actual date untouched unless the user confirms via the
      field or the "Today" button — dismissing it does nothing. Suppressed
      once for a row just created this session (`useNewRowTracking`),
      since a new row's "as of" already defaults to today and there's
      nothing to confirm yet.
- [x] **Colour picker visual artifacts**: root cause was the native
      `<input type="color">` swatch carrying its own inset padding/border
      (`::-webkit-color-swatch-wrapper`/`::-webkit-color-swatch`), which
      clipped unevenly against our `rounded-full` circle — square corners
      and a native border poking through. Fixed globally in `index.css`
      by stripping the native appearance and zeroing the swatch's own
      padding/border/radius, leaving only our own circular border visible.
- [ ] **Owner-dropdowns should group by person**: `<select>` dropdowns that
      list accounts/loans/etc. as plain flat options — Loans' "Secured
      against" (`Loans.tsx`), One-off Events' account/loan/asset target
      (`OneOffEvents.tsx`), Salaries' "Pension account" (`Salaries.tsx`) —
      should group their `<option>`s by owner via `<optgroup>`, same rule as
      everywhere else (no grouping with no household set up). Loans'
      dropdown already filters to one owner so grouping may not apply there;
      One-off Events' target dropdown spans all owners and is the clearest
      case.
- [x] **Rename "Today's money" → "Inflation-adjusted"**: renamed the
      Dashboard toggle button (`App.tsx`), the net worth chart's mode
      caption (`NetWorthChart.tsx`), and the "at retirement" sub-label
      (`SummaryCards.tsx`, "in today's money" → "inflation-adjusted").
- [x] **Move long descriptions into info popups / remove stale helper text**:
      reviewed every card's paragraph-length hint one at a time rather than
      an ⓘ-popup-per-field approach — ended up sorting each into one of
      three buckets instead: delete outright (anything a control already
      self-documents, e.g. hover tooltips on the as-of icon and rate
      schedule button — the near-identical Accounts/Assets/Loans/Pensions
      intro paragraphs, the "Forecast Assumptions"/tax-bands filler lines,
      the colour-dot explanation, the shared-item caveat now that "Shared"
      is its own visible bucket, the generic tax-bands mechanics since
      that's general knowledge not app behaviour); keep inline (anything
      tightly coupled to the exact control next to it, read at the moment
      it's relevant, not standing clutter — RateSchedule's modal text, the
      loan one-off "regardless of sign" caveat, the personal-allowance
      taper note since that's a genuine lesser-known gotcha, the three
      short LineItemTable hints, the Data-card backup warning); or move to
      a new **"How it works" tab** (`Guide.tsx`) — for content a new user
      genuinely benefits from once but that was being re-explained on every
      visit: the fixed-rate-model caveat, household/shared-item ownership,
      balance staleness catch-up, loan equity linking, pensions/LISA
      caveats (dormant flag, no early-withdrawal-penalty modelling),
      salary deductions/bonus tax treatment, reading the net worth chart
      (stacking, "Other" fold, legend interactions, event markers), and
      Scottish income tax bands.

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
