import type { Account, AccountType, Frequency, Salary, Settings } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { toMonthlyAmount } from '../lib/frequency';
import { selectOnFocus } from '../lib/selectOnFocus';
import { todayISO } from '../lib/date';
import { calcSalaryBreakdown } from '../lib/tax';
import { calcLisaBonus, LISA_ANNUAL_CONTRIBUTION_CAP } from '../lib/lisa';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';
import RateSchedule from './RateSchedule';

interface Props {
  accounts: Account[];
  salaries: Salary[];
  tax: Settings['tax'];
  onChange: (accounts: Account[]) => void;
}

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'annual'];

export default function PensionsAndLisas({ accounts, salaries, tax, onChange }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<Account>) {
    onChange(accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function remove(id: string) {
    onChange(accounts.filter((a) => a.id !== id));
  }

  function add(type: AccountType, defaultGrowthRate: number) {
    return (ownerId: string) => {
      onChange([
        ...accounts,
        {
          id: newId(),
          name: '',
          type,
          balance: 0,
          balanceAsOf: todayISO(),
          annualGrowthRate: defaultGrowthRate,
          contributionAmount: 0,
          contributionFrequency: 'monthly',
          ownerId,
        },
      ]);
    };
  }

  const pensions = accounts.filter((a) => a.type === 'pension');
  const lisas = accounts.filter((a) => a.type === 'lifetime-isa');

  /** Monthly pension contribution routed from salary sacrifice + employer match. */
  function fromSalary(accountId: string): number {
    return salaries
      .filter((s) => s.pensionAccountId === accountId)
      .reduce((sum, s) => sum + calcSalaryBreakdown(s, tax).pensionContributionMonthly, 0);
  }

  function pensionTotalFor(a: Account): number {
    return toMonthlyAmount(a.contributionAmount, a.contributionFrequency) + fromSalary(a.id);
  }

  function lisaBonusFor(a: Account): number {
    return calcLisaBonus(toMonthlyAmount(a.contributionAmount, a.contributionFrequency));
  }

  function lisaTotalFor(a: Account): number {
    return toMonthlyAmount(a.contributionAmount, a.contributionFrequency) + lisaBonusFor(a);
  }

  const totalBalance = pensions.reduce((s, a) => s + a.balance, 0) + lisas.reduce((s, a) => s + a.balance, 0);
  const totalContribution =
    pensions.reduce((s, a) => s + pensionTotalFor(a), 0) + lisas.reduce((s, a) => s + lisaTotalFor(a), 0);

  function renderPensionRow(a: Account) {
    const total = pensionTotalFor(a);
    return (
      <tr key={a.id} className="border-b border-rule/60">
        <td className="py-2 pr-2">
          <input
            type="text"
            value={a.name}
            onChange={(e) => update(a.id, { name: e.target.value })}
            onFocus={selectOnFocus}
            placeholder="Pension name"
            className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
          />
          {total === 0 && (
            <span className="block text-[11px] text-inkfaint italic mt-0.5">Dormant — no contributions</span>
          )}
        </td>
        <td className="py-2 pr-2 text-right">
          <NumberInput
            value={a.balance}
            onChange={(balance) => update(a.id, { balance })}
            className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
          />
        </td>
        <td className="py-2 pr-2">
          <input
            type="date"
            value={a.balanceAsOf}
            onChange={(e) => update(a.id, { balanceAsOf: e.target.value })}
            className="bg-transparent text-sm font-mono focus:outline-none"
          />
        </td>
        <td className="py-2 pr-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <NumberInput
              value={a.annualGrowthRate}
              onChange={(annualGrowthRate) => update(a.id, { annualGrowthRate })}
              className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
            />
            <span className="text-inkfaint text-xs">%</span>
            <RateSchedule
              label={`${a.name || 'Pension'} — growth rate changes`}
              changes={a.rateChanges ?? []}
              onChange={(rateChanges) => update(a.id, { rateChanges })}
            />
          </div>
        </td>
        <td className="py-2 pr-2 text-right font-mono tabular text-xs text-teal">
          {formatCurrency(total, currency)}
        </td>
        <td className="py-2 text-right">
          <RemoveButton onClick={() => remove(a.id)} label={`Remove ${a.name || 'pension'}`} />
        </td>
      </tr>
    );
  }

  function renderPensionTable(list: Account[]) {
    const contribution = list.reduce((s, a) => s + pensionTotalFor(a), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal">As of</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Contribution/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>{list.map(renderPensionRow)}</tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-xs text-inkfaint">Total monthly contributions</td>
                <td className="pt-2 text-right font-mono text-xs tabular text-teal">
                  {formatCurrency(contribution, currency)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        {list.length === 0 && <p className="text-xs text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  function renderLisaRow(a: Account) {
    const bonus = lisaBonusFor(a);
    const total = lisaTotalFor(a);
    return (
      <tr key={a.id} className="border-b border-rule/60">
        <td className="py-2 pr-2">
          <input
            type="text"
            value={a.name}
            onChange={(e) => update(a.id, { name: e.target.value })}
            onFocus={selectOnFocus}
            placeholder="Lifetime ISA name"
            className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
          />
        </td>
        <td className="py-2 pr-2 text-right">
          <NumberInput
            value={a.balance}
            onChange={(balance) => update(a.id, { balance })}
            className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
          />
        </td>
        <td className="py-2 pr-2">
          <input
            type="date"
            value={a.balanceAsOf}
            onChange={(e) => update(a.id, { balanceAsOf: e.target.value })}
            className="bg-transparent text-sm font-mono focus:outline-none"
          />
        </td>
        <td className="py-2 pr-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <NumberInput
              value={a.annualGrowthRate}
              onChange={(annualGrowthRate) => update(a.id, { annualGrowthRate })}
              className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
            />
            <span className="text-inkfaint text-xs">%</span>
            <RateSchedule
              label={`${a.name || 'Lifetime ISA'} — growth rate changes`}
              changes={a.rateChanges ?? []}
              onChange={(rateChanges) => update(a.id, { rateChanges })}
            />
          </div>
        </td>
        <td className="py-2 pr-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <NumberInput
              value={a.contributionAmount}
              onChange={(contributionAmount) => update(a.id, { contributionAmount })}
              className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
            />
            <select
              value={a.contributionFrequency}
              onChange={(e) => update(a.id, { contributionFrequency: e.target.value as Frequency })}
              className="bg-transparent text-xs focus:outline-none"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </td>
        <td className="py-2 pr-2 text-right font-mono tabular text-xs text-inkfaint">
          {formatCurrency(bonus, currency)}
        </td>
        <td className="py-2 pr-2 text-right font-mono tabular text-xs text-teal">
          {formatCurrency(total, currency)}
        </td>
        <td className="py-2 text-right">
          <RemoveButton onClick={() => remove(a.id)} label={`Remove ${a.name || 'Lifetime ISA'}`} />
        </td>
      </tr>
    );
  }

  function renderLisaTable(list: Account[]) {
    const contribution = list.reduce((s, a) => s + lisaTotalFor(a), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal">As of</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Contribution</th>
              <th className="pb-2 pr-3 font-normal text-right">Gov. bonus</th>
              <th className="pb-2 pr-3 font-normal text-right">Total/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>{list.map(renderLisaRow)}</tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="pt-2 text-xs text-inkfaint">Total monthly contributions</td>
                <td colSpan={2} className="pt-2 text-right font-mono text-xs tabular text-teal">
                  {formatCurrency(contribution, currency)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        {list.length === 0 && <p className="text-xs text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  function renderSection(
    title: string,
    items: Account[],
    renderTable: (list: Account[]) => JSX.Element,
    addLabel: string,
    onAdd: (ownerId: string) => void
  ) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-display text-sm text-ink">{title}</h4>
          <AddWithOwner label="+" ariaLabel={addLabel} onAdd={onAdd} className="" />
        </div>
        <OwnerGroupedList
          items={items}
          getOwnerId={(a) => a.ownerId}
          total={(list) => formatCurrency(list.reduce((s, a) => s + a.balance, 0), currency)}
          totalClassName="text-brass"
        >
          {(list) => renderTable(list)}
        </OwnerGroupedList>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-lg text-ink">Pensions &amp; Lifetime ISAs</h3>
        <span className="font-mono text-sm tabular text-brass">{formatCurrency(totalBalance, currency)}</span>
      </div>
      <p className="text-xs text-inkfaint mb-4">
        Both get money added on top of what you put in — a pension from salary sacrifice and
        employer contributions (linked on the Income &amp; Outgoings tab), a Lifetime ISA from a
        25% government bonus up to £{LISA_ANNUAL_CONTRIBUTION_CAP.toLocaleString()}/year. Only
        regular contributions earn either top-up, not one-off deposits. A pension with nothing
        coming in either way is flagged as dormant — handy for an old workplace pension you've left
        invested but stopped paying into. This model doesn't account for a LISA's 25%
        early-withdrawal penalty. "As of" is when you last checked the balance — the forecast
        catches up growth and contributions since then before projecting forward.
      </p>

      <div className="space-y-8">
        {renderSection('Pensions', pensions, renderPensionTable, '+ add pension', add('pension', 4))}
        {renderSection('Lifetime ISAs', lisas, renderLisaTable, '+ add Lifetime ISA', add('lifetime-isa', 5))}
      </div>

      <p className="text-[11px] text-inkfaint mt-4">
        Total monthly contributions across everyone: {formatCurrency(totalContribution, currency)}
      </p>
    </Card>
  );
}
