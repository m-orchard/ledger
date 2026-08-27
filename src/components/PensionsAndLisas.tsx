import { useState } from 'react';
import type { Account, AccountType, Frequency, Salary, Settings } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { toMonthlyAmount } from '../lib/frequency';
import { selectOnFocus } from '../lib/selectOnFocus';
import { todayISO } from '../lib/date';
import { useNewRowTracking, useAsOfAutoOpen } from '../lib/asOfTracking';
import { calcSalaryBreakdown } from '../lib/tax';
import { calcLisaBonus } from '../lib/lisa';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';
import RateSchedule from './RateSchedule';
import AsOfField from './AsOfField';
import Modal from './Modal';
import PensionRateFields from './PensionRateFields';

interface Props {
  accounts: Account[];
  salaries: Salary[];
  tax: Settings['tax'];
  onChange: (accounts: Account[]) => void;
  onSalariesChange: (salaries: Salary[]) => void;
}

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'annual'];

export default function PensionsAndLisas({ accounts, salaries, tax, onChange, onSalariesChange }: Props) {
  const { currency } = useAppSettings();
  const newRows = useNewRowTracking();

  function update(id: string, patch: Partial<Account>) {
    onChange(accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function updateSalary(salaryId: string, patch: Partial<Salary>) {
    onSalariesChange(salaries.map((s) => (s.id === salaryId ? { ...s, ...patch } : s)));
  }

  function remove(id: string) {
    onChange(accounts.filter((a) => a.id !== id));
  }

  function add(type: AccountType, defaultGrowthRate: number) {
    return (ownerId: string) => {
      const id = newId();
      onChange([
        ...accounts,
        {
          id,
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
      newRows.markNew(id);
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

  function renderPensionTable(list: Account[]) {
    const contribution = list.reduce((s, a) => s + pensionTotalFor(a), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Contribution/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <PensionRow
                key={a.id}
                account={a}
                total={pensionTotalFor(a)}
                salaries={salaries}
                onUpdate={update}
                onUpdateSalary={updateSalary}
                onRemove={remove}
                isNew={newRows.isNew(a.id)}
                onSettled={() => newRows.clearNew(a.id)}
              />
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-2 text-xs text-inkfaint">Total monthly contributions</td>
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

  function renderLisaTable(list: Account[]) {
    const contribution = list.reduce((s, a) => s + lisaTotalFor(a), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Balance</th>
              <th className="pb-2 pr-3 font-normal text-right">Growth/yr</th>
              <th className="pb-2 pr-3 font-normal text-right">Contribution</th>
              <th className="pb-2 pr-3 font-normal text-right">Gov. bonus</th>
              <th className="pb-2 pr-3 font-normal text-right">Total/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <LisaRow
                key={a.id}
                account={a}
                bonus={lisaBonusFor(a)}
                total={lisaTotalFor(a)}
                onUpdate={update}
                onRemove={remove}
                isNew={newRows.isNew(a.id)}
                onSettled={() => newRows.clearNew(a.id)}
              />
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-xs text-inkfaint">Total monthly contributions</td>
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

function PensionRow({
  account: a,
  total,
  salaries,
  onUpdate,
  onUpdateSalary,
  onRemove,
  isNew,
  onSettled,
}: {
  account: Account;
  total: number;
  salaries: Salary[];
  onUpdate: (id: string, patch: Partial<Account>) => void;
  onUpdateSalary: (salaryId: string, patch: Partial<Salary>) => void;
  onRemove: (id: string) => void;
  isNew: boolean;
  onSettled: () => void;
}) {
  const { currency } = useAppSettings();
  const { signal, handleFocus, handleBlur } = useAsOfAutoOpen(a.balance, isNew, onSettled);

  return (
    <tr className="border-b border-rule/60">
      <td className="py-2 pr-2">
        <input
          type="text"
          value={a.name}
          onChange={(e) => onUpdate(a.id, { name: e.target.value })}
          onFocus={selectOnFocus}
          placeholder="Pension name"
          className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
        />
        {total === 0 && (
          <span className="block text-[11px] text-inkfaint italic mt-0.5">Dormant — no contributions</span>
        )}
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <NumberInput
            value={a.balance}
            onChange={(balance) => onUpdate(a.id, { balance })}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
          />
          <AsOfField
            value={a.balanceAsOf}
            onChange={(balanceAsOf) => onUpdate(a.id, { balanceAsOf })}
            label={a.name || 'pension'}
            autoOpenSignal={signal}
            align="right"
          />
        </div>
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <NumberInput
            value={a.annualGrowthRate}
            onChange={(annualGrowthRate) => onUpdate(a.id, { annualGrowthRate })}
            className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
          />
          <span className="text-inkfaint text-xs">%</span>
          <RateSchedule
            label={`${a.name || 'Pension'} — growth rate changes`}
            changes={a.rateChanges ?? []}
            onChange={(rateChanges) => onUpdate(a.id, { rateChanges })}
          />
        </div>
      </td>
      <td className="py-2 pr-2 text-right">
        <PensionContributionsControl account={a} salaries={salaries} total={total} onUpdateSalary={onUpdateSalary} />
      </td>
      <td className="py-2 text-right">
        <RemoveButton onClick={() => onRemove(a.id)} label={`Remove ${a.name || 'pension'}`} />
      </td>
    </tr>
  );
}

function PensionContributionsControl({
  account,
  salaries,
  total,
  onUpdateSalary,
}: {
  account: Account;
  salaries: Salary[];
  total: number;
  onUpdateSalary: (salaryId: string, patch: Partial<Salary>) => void;
}) {
  const { currency } = useAppSettings();
  const [open, setOpen] = useState(false);
  const linked = salaries.filter((s) => s.pensionAccountId === account.id);

  if (linked.length === 0) {
    return <span className="font-mono tabular text-xs text-teal">{formatCurrency(total, currency)}</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={
          linked.length === 1
            ? `From ${linked[0].name || 'one salary'}`
            : `From ${linked.length} salaries`
        }
        className="font-mono tabular text-xs text-teal underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {formatCurrency(total, currency)}
      </button>

      {open && (
        <Modal title={`${account.name || 'Pension'} — contributions`} onClose={() => setOpen(false)}>
          <div className="space-y-5">
            {linked.map((s) => (
              <div key={s.id}>
                <p className="text-xs font-mono text-ink mb-2">{s.name || 'Unnamed salary'}</p>
                <PensionRateFields
                  salary={s}
                  onUpdate={(patch) => onUpdateSalary(s.id, patch)}
                  currency={currency}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-rule/60">
            <span className="text-xs text-inkfaint">Total</span>
            <span className="text-xs font-mono tabular text-ink ml-auto">{formatCurrency(total, currency)}/mo</span>
          </div>
        </Modal>
      )}
    </>
  );
}

function LisaRow({
  account: a,
  bonus,
  total,
  onUpdate,
  onRemove,
  isNew,
  onSettled,
}: {
  account: Account;
  bonus: number;
  total: number;
  onUpdate: (id: string, patch: Partial<Account>) => void;
  onRemove: (id: string) => void;
  isNew: boolean;
  onSettled: () => void;
}) {
  const { currency } = useAppSettings();
  const { signal, handleFocus, handleBlur } = useAsOfAutoOpen(a.balance, isNew, onSettled);

  return (
    <tr className="border-b border-rule/60">
      <td className="py-2 pr-2">
        <input
          type="text"
          value={a.name}
          onChange={(e) => onUpdate(a.id, { name: e.target.value })}
          onFocus={selectOnFocus}
          placeholder="Lifetime ISA name"
          className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
        />
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <NumberInput
            value={a.balance}
            onChange={(balance) => onUpdate(a.id, { balance })}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
          />
          <AsOfField
            value={a.balanceAsOf}
            onChange={(balanceAsOf) => onUpdate(a.id, { balanceAsOf })}
            label={a.name || 'Lifetime ISA'}
            autoOpenSignal={signal}
            align="right"
          />
        </div>
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <NumberInput
            value={a.annualGrowthRate}
            onChange={(annualGrowthRate) => onUpdate(a.id, { annualGrowthRate })}
            className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
          />
          <span className="text-inkfaint text-xs">%</span>
          <RateSchedule
            label={`${a.name || 'Lifetime ISA'} — growth rate changes`}
            changes={a.rateChanges ?? []}
            onChange={(rateChanges) => onUpdate(a.id, { rateChanges })}
          />
        </div>
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <NumberInput
            value={a.contributionAmount}
            onChange={(contributionAmount) => onUpdate(a.id, { contributionAmount })}
            className="w-16 bg-transparent text-right font-mono tabular focus:outline-none"
          />
          <select
            value={a.contributionFrequency}
            onChange={(e) => onUpdate(a.id, { contributionFrequency: e.target.value as Frequency })}
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
        <RemoveButton onClick={() => onRemove(a.id)} label={`Remove ${a.name || 'Lifetime ISA'}`} />
      </td>
    </tr>
  );
}
