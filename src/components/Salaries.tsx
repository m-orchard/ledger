import { useState } from 'react';
import type { Account, Frequency, Salary, SalaryBonus, SalaryDeduction, Settings } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { calcSalaryBreakdown } from '../lib/tax';
import { parseLocalDate } from '../lib/projection';
import { toMonthlyAmount } from '../lib/frequency';
import { formatRelativeDate } from '../lib/date';
import { selectOnFocus } from '../lib/selectOnFocus';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';
import Modal from './Modal';
import PensionRateFields from './PensionRateFields';
import SalarySchedule from './SalarySchedule';

interface Props {
  salaries: Salary[];
  accounts: Account[];
  tax: Settings['tax'];
  onChange: (salaries: Salary[]) => void;
}

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'annual'];

export default function Salaries({ salaries, accounts, tax, onChange }: Props) {
  const { currency } = useAppSettings();
  function update(id: string, patch: Partial<Salary>) {
    onChange(salaries.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function remove(id: string) {
    onChange(salaries.filter((s) => s.id !== id));
  }

  function add(ownerId: string) {
    const defaultPensionAccount = accounts.find((a) => a.type === 'pension' && a.ownerId === ownerId);
    onChange([
      ...salaries,
      {
        id: newId(),
        name: '',
        grossAnnual: 0,
        sacrificePercent: 0,
        employerContributionPercent: 0,
        pensionAccountId: defaultPensionAccount?.id,
        otherDeductions: [],
        bonuses: [],
        ownerId,
      },
    ]);
  }

  function updateDeduction(salaryId: string, deductionId: string, patch: Partial<SalaryDeduction>) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    update(salaryId, {
      otherDeductions: salary.otherDeductions.map((d) => (d.id === deductionId ? { ...d, ...patch } : d)),
    });
  }

  function removeDeduction(salaryId: string, deductionId: string) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    update(salaryId, { otherDeductions: salary.otherDeductions.filter((d) => d.id !== deductionId) });
  }

  function addDeduction(salaryId: string) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    update(salaryId, {
      otherDeductions: [...salary.otherDeductions, { id: newId(), name: '', amount: 0, frequency: 'monthly' }],
    });
  }

  function updateBonus(salaryId: string, bonusId: string, patch: Partial<SalaryBonus>) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    update(salaryId, {
      bonuses: salary.bonuses.map((b) => (b.id === bonusId ? { ...b, ...patch } : b)),
    });
  }

  function removeBonus(salaryId: string, bonusId: string) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    update(salaryId, { bonuses: salary.bonuses.filter((b) => b.id !== bonusId) });
  }

  function addBonus(salaryId: string) {
    const salary = salaries.find((s) => s.id === salaryId);
    if (!salary) return;
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    update(salaryId, {
      bonuses: [...salary.bonuses, { id: newId(), name: '', amount: 0, date: nextYear.toISOString().slice(0, 10) }],
    });
  }

  /** Whether a salary's endDate has already passed — excluded from "current" summary totals (the projection itself handles the transition month-by-month; these headers are a today-only snapshot). */
  function hasEnded(salary: Salary): boolean {
    return !!salary.endDate && parseLocalDate(salary.endDate) <= new Date();
  }

  const totalTakeHome = salaries.reduce(
    (s, sal) => s + (hasEnded(sal) ? 0 : calcSalaryBreakdown(sal, tax).takeHomeMonthly),
    0
  );

  function renderTable(list: Salary[], ownerId: string) {
    const eligibleAccounts = accounts.filter((a) => a.type === 'pension' && a.ownerId === ownerId);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-inkfaint border-b border-rule">
              <th className="pb-2 pr-3 font-normal">Name</th>
              <th className="pb-2 pr-3 font-normal text-right">Gross/yr</th>
              <th className="pb-2 pr-3 font-normal">Pension</th>
              <th className="pb-2 pr-3 font-normal">Extras</th>
              <th className="pb-2 pr-3 font-normal text-right">Tax/mo</th>
              <th className="pb-2 pr-3 font-normal text-right">NI/mo</th>
              <th className="pb-2 pr-3 font-normal text-right">Take-home/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const breakdown = hasEnded(s)
                ? { takeHomeMonthly: 0, incomeTaxMonthly: 0, niMonthly: 0 }
                : calcSalaryBreakdown(s, tax);
              return (
                  <tr key={s.id} className="border-b border-rule/60">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => update(s.id, { name: e.target.value })}
                        onFocus={selectOnFocus}
                        placeholder="Salary name"
                        className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
                      />
                      {s.endDate && (
                        <span className="block text-[11px] text-inkfaint italic mt-0.5">Ended {s.endDate}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <NumberInput
                          value={s.grossAnnual}
                          onChange={(grossAnnual) => update(s.id, { grossAnnual })}
                          className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                        />
                        <SalarySchedule
                          label={`${s.name || 'Salary'} — scheduled changes`}
                          changes={s.scheduledChanges ?? []}
                          onChange={(scheduledChanges) => update(s.id, { scheduledChanges })}
                          current={{
                            grossAnnual: s.grossAnnual,
                            sacrificePercent: s.sacrificePercent,
                            employerContributionPercent: s.employerContributionPercent,
                          }}
                          endDate={s.endDate}
                          onEndDateChange={(endDate) => update(s.id, { endDate })}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <PensionControl
                        salary={s}
                        accounts={accounts}
                        eligibleAccounts={eligibleAccounts}
                        onUpdate={(patch) => update(s.id, patch)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <ExtrasControl
                        salary={s}
                        onAddDeduction={() => addDeduction(s.id)}
                        onUpdateDeduction={(deductionId, patch) => updateDeduction(s.id, deductionId, patch)}
                        onRemoveDeduction={(deductionId) => removeDeduction(s.id, deductionId)}
                        onAddBonus={() => addBonus(s.id)}
                        onUpdateBonus={(bonusId, patch) => updateBonus(s.id, bonusId, patch)}
                        onRemoveBonus={(bonusId) => removeBonus(s.id, bonusId)}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right font-mono tabular text-xs text-inkfaint">
                      {formatCurrency(breakdown.incomeTaxMonthly, currency)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono tabular text-xs text-inkfaint">
                      {formatCurrency(breakdown.niMonthly, currency)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono tabular text-xs text-teal">
                      {formatCurrency(breakdown.takeHomeMonthly, currency)}
                    </td>
                    <td className="py-2 text-right">
                      <RemoveButton onClick={() => remove(s.id)} label={`Remove ${s.name || 'salary'}`} />
                    </td>
                  </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-sm text-inkfaint italic mt-2">Nothing yet.</p>}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg text-ink">Salaries</h3>
          <AddWithOwner label="+" ariaLabel="Add salary" onAdd={add} className="" />
        </div>
        <span className="font-mono text-sm tabular text-teal">
          {formatCurrency(totalTakeHome, currency)}/mo take-home
        </span>
      </div>

      <OwnerGroupedList
        items={salaries}
        getOwnerId={(s) => s.ownerId}
        total={(list) =>
          `${formatCurrency(list.reduce((s, sal) => s + (hasEnded(sal) ? 0 : calcSalaryBreakdown(sal, tax).takeHomeMonthly), 0), currency)}/mo`
        }
        totalClassName="text-teal"
      >
        {(list, ownerId) => renderTable(list, ownerId)}
      </OwnerGroupedList>
    </Card>
  );
}

/** Small trigger + Modal for a salary's pension account/sacrifice/employer contribution, same pattern as RateSchedule. */
function PensionControl({
  salary,
  accounts,
  eligibleAccounts,
  onUpdate,
}: {
  salary: Salary;
  accounts: Account[];
  eligibleAccounts: Account[];
  onUpdate: (patch: Partial<Salary>) => void;
}) {
  const { currency } = useAppSettings();
  const [open, setOpen] = useState(false);
  const selectedAccount = accounts.find((a) => a.id === salary.pensionAccountId);
  const sacrificeMonthly = (salary.grossAnnual * (salary.sacrificePercent / 100)) / 12;
  const employerMonthly = (salary.grossAnnual * (salary.employerContributionPercent / 100)) / 12;
  const totalMonthly = sacrificeMonthly + employerMonthly;

  const label = selectedAccount ? selectedAccount.name || 'Unnamed account' : '+ pension';
  const title = selectedAccount
    ? `${selectedAccount.name || 'Unnamed account'} — ${formatCurrency(sacrificeMonthly, currency)}/mo you + ${formatCurrency(employerMonthly, currency)}/mo employer = ${formatCurrency(totalMonthly, currency)}/mo`
    : 'Set up a pension contribution';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={title}
        className="max-w-[8rem] truncate text-left text-[11px] font-mono text-inkfaint hover:text-teal underline decoration-dotted underline-offset-2"
      >
        {label}
      </button>

      {open && (
        <Modal title={`${salary.name || 'Salary'} — pension contribution`} onClose={() => setOpen(false)}>
          <label className="block mb-3">
            <span className="text-xs text-inkfaint block mb-1">Pension account</span>
            <select
              value={salary.pensionAccountId ?? ''}
              onChange={(e) => onUpdate({ pensionAccountId: e.target.value || undefined })}
              className="w-full bg-transparent border-b border-rule py-1 text-sm focus:outline-none focus-visible:border-brass"
            >
              <option value="">None</option>
              {eligibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || 'Unnamed account'}
                </option>
              ))}
              {/* Keep a currently-selected account visible even if it no longer matches
                  (e.g. its type or owner changed after being linked here). */}
              {selectedAccount && !eligibleAccounts.includes(selectedAccount) && (
                <option value={selectedAccount.id}>
                  {(selectedAccount.name || 'Unnamed account') + ' (mismatched owner/type)'}
                </option>
              )}
            </select>
          </label>

          <PensionRateFields salary={salary} onUpdate={onUpdate} currency={currency} />

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-rule/60">
            <span className="text-xs text-inkfaint">Total</span>
            <span className="text-xs font-mono tabular text-ink ml-auto">
              {formatCurrency(totalMonthly, currency)}/mo
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Small trigger + Modal combining a salary's "other deductions" and bonuses, same pattern as RateSchedule. */
function ExtrasControl({
  salary,
  onAddDeduction,
  onUpdateDeduction,
  onRemoveDeduction,
  onAddBonus,
  onUpdateBonus,
  onRemoveBonus,
}: {
  salary: Salary;
  onAddDeduction: () => void;
  onUpdateDeduction: (deductionId: string, patch: Partial<SalaryDeduction>) => void;
  onRemoveDeduction: (deductionId: string) => void;
  onAddBonus: () => void;
  onUpdateBonus: (bonusId: string, patch: Partial<SalaryBonus>) => void;
  onRemoveBonus: (bonusId: string) => void;
}) {
  const { currency } = useAppSettings();
  const [open, setOpen] = useState(false);
  const deductionCount = salary.otherDeductions.length;
  const bonusCount = salary.bonuses.length;
  const count = deductionCount + bonusCount;
  const sortedBonuses = [...salary.bonuses].sort((a, b) => a.date.localeCompare(b.date));

  const deductionSummary = salary.otherDeductions
    .map((d) => `${d.name || 'Unnamed'}: ${formatCurrency(toMonthlyAmount(d.amount, d.frequency), currency)}/mo`)
    .join('\n');
  const bonusSummary = sortedBonuses
    .map((b) => `${b.name || 'Unnamed'}: ${formatCurrency(b.amount, currency)} (${formatRelativeDate(b.date)})`)
    .join('\n');
  const title =
    count === 0
      ? 'Add a deduction or bonus'
      : [deductionSummary, bonusSummary].filter(Boolean).join('\n\n');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={count === 0 ? 'Add a deduction or bonus' : `Edit deductions & bonuses (${count})`}
        title={title}
        className="text-[11px] font-mono text-inkfaint hover:text-teal underline decoration-dotted underline-offset-2"
      >
        {count === 0 ? '+' : count}
      </button>

      {open && (
        <Modal title={`${salary.name || 'Salary'} — deductions & bonuses`} onClose={() => setOpen(false)}>
          <h4 className="font-display text-sm text-ink mb-2">Other deductions</h4>
          <div className="space-y-2">
            {salary.otherDeductions.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={d.name}
                  onChange={(e) => onUpdateDeduction(d.id, { name: e.target.value })}
                  onFocus={selectOnFocus}
                  placeholder="e.g. Health insurance"
                  className="flex-1 min-w-0 bg-transparent border-b border-rule py-1 text-sm focus:outline-none focus-visible:border-brass"
                />
                <NumberInput
                  value={d.amount}
                  onChange={(amount) => onUpdateDeduction(d.id, { amount })}
                  className="w-20 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                />
                <select
                  value={d.frequency}
                  onChange={(e) => onUpdateDeduction(d.id, { frequency: e.target.value as Frequency })}
                  className="bg-transparent border-b border-rule py-1 text-xs focus:outline-none"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <RemoveButton onClick={() => onRemoveDeduction(d.id)} label={`Remove ${d.name || 'deduction'}`} />
              </div>
            ))}
            {deductionCount === 0 && <p className="text-xs text-inkfaint italic">No other deductions yet.</p>}
          </div>
          <button
            onClick={onAddDeduction}
            className="mt-3 text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
          >
            + add deduction
          </button>

          <h4 className="font-display text-sm text-ink mb-2 mt-6 pt-4 border-t border-rule/60">Bonuses</h4>
          <div className="space-y-2">
            {sortedBonuses.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <input
                  type="date"
                  value={b.date}
                  onChange={(e) => onUpdateBonus(b.id, { date: e.target.value })}
                  className="bg-transparent border-b border-rule py-1 text-sm font-mono focus:outline-none focus-visible:border-brass"
                />
                <input
                  type="text"
                  value={b.name}
                  onChange={(e) => onUpdateBonus(b.id, { name: e.target.value })}
                  onFocus={selectOnFocus}
                  placeholder="e.g. Annual bonus"
                  className="flex-1 min-w-0 bg-transparent border-b border-rule py-1 text-sm focus:outline-none focus-visible:border-brass"
                />
                <NumberInput
                  value={b.amount}
                  onChange={(amount) => onUpdateBonus(b.id, { amount })}
                  className="w-20 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                />
                <RemoveButton onClick={() => onRemoveBonus(b.id)} label={`Remove ${b.name || 'bonus'}`} />
              </div>
            ))}
            {bonusCount === 0 && <p className="text-xs text-inkfaint italic">No bonuses yet.</p>}
          </div>
          <button
            onClick={onAddBonus}
            className="mt-3 text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
          >
            + add bonus
          </button>
        </Modal>
      )}
    </>
  );
}
