import { LISA_ANNUAL_CONTRIBUTION_CAP } from '../lib/lisa';
import Card from './Card';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-sm text-ink mb-1">{title}</h4>
      <div className="text-sm text-inkfaint leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

export default function Guide() {
  return (
    <Card>
      <h3 className="font-display text-lg text-ink mb-1">How this app works</h3>
      <p className="text-xs text-inkfaint mb-6">
        Background on how the forecast is put together — worth a skim once, not something you
        need to re-read every time you edit a number.
      </p>

      <div className="space-y-6">
        <Section title="Tax">
          <p>
            Defaults to 2024/25 rest-of-UK rates. Add more bands to model Scottish income tax
            instead, which has more/different thresholds than the rest of the UK.
          </p>
        </Section>

        <Section title="This is a fixed-rate model">
          <p>
            The forecast assumes your growth and inflation figures hold every year. Real markets
            don't move in a straight line — treat the projection as a planning baseline, not a
            guarantee.
          </p>
        </Section>

        <Section title="Household & shared items">
          <p>
            Anything not assigned to a person (in Settings) is treated as shared — its own
            "Shared" bucket everywhere people are broken out, including the "By person" dashboard
            cards. A joint mortgage or a shared account isn't split between people; it just lives
            in that bucket instead. Each person (and Shared) gets a colour, shown as a dot
            wherever their items appear across the app.
          </p>
        </Section>

        <Section title="Balances that are out of date">
          <p>
            Every balance/value field (accounts, assets, loans, pensions, Lifetime ISAs) has a
            small calendar icon next to it showing when you last checked it. You don't need to
            keep that current by hand — the forecast fast-forwards each figure from its "as of"
            date to today, using the same growth/interest/contribution assumptions as the rest
            of the projection, before projecting forward from there. So a balance you haven't
            touched in months isn't silently treated as if it were current.
          </p>
        </Section>

        <Section title="Loan equity">
          <p>
            Link a loan to an asset (on the Investments &amp; Assets tab, per loan) to see your
            actual equity — the asset's value minus what's still owed — shown next to that loan
            on the Outgoings tab. Handy for a mortgage against a house.
          </p>
        </Section>

        <Section title="Pensions & Lifetime ISAs">
          <p>
            Both get money added on top of what you put in — a pension from salary sacrifice and
            employer contributions (linked on a salary, on the Income tab), a Lifetime ISA from a
            25% government bonus up to £{LISA_ANNUAL_CONTRIBUTION_CAP.toLocaleString()}/year.
            Only regular contributions earn either top-up, not one-off deposits.
          </p>
          <p>
            A pension with nothing coming in either way is flagged as dormant — handy for an old
            workplace pension you've left invested but stopped paying into.
          </p>
          <p>
            This model doesn't account for a Lifetime ISA's 25% early-withdrawal penalty if you
            take money out before age 60 for anything other than a first home.
          </p>
        </Section>

        <Section title="Salaries, deductions & bonuses">
          <p>
            Gross pay, with Income Tax, National Insurance, and pension salary sacrifice worked
            out automatically from the bands in Settings — edit those if rates change.
          </p>
          <p>
            "Other sacrifice deductions" covers flat-amount salary sacrifice with no savings
            destination — health insurance, a cycle to work scheme, etc — treated as reducing
            taxable and NI-able pay the same way pension sacrifice does. Some benefits lost this
            tax advantage under 2017 rules, so double-check against your payslip.
          </p>
          <p>
            "Bonuses" are one-off gross payments, taxed at your marginal rate for the month they
            land — so a large one can cost more per pound if it crosses into a higher band. Set
            them up on the Salaries table itself, not as a one-off event on the Income tab, since
            they need to be taxed against that specific salary.
          </p>
        </Section>

        <Section title="Reading the net worth chart">
          <p>
            Accounts and assets stack upward from zero; loans stack downward as negative values
            — the bold "Net worth" line is the sum of everything currently shown, not a
            precomputed figure, so hiding items is a real what-if, not just a display filter.
            Once there are more than a handful of items on one side, the smallest fold into a
            single grey "Other" band — hover it to see what's included.
          </p>
          <p>
            Click a legend item to hide it, shift+click to show only that one (shift+click again
            to restore the rest). Coloured dots on the "Net worth" line mark one-off events —
            teal for income, brick for expense — hover one for details.
          </p>
        </Section>
      </div>
    </Card>
  );
}
