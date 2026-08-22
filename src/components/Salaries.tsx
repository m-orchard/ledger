import { Fragment } from 'react';
import type { Account, Frequency, Salary, SalaryBonus, SalaryDeduction, Settings } from '../types';
import { newId } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import { calcSalaryBreakdown } from '../lib/tax';
import { selectOnFocus } from '../lib/selectOnFocus';
import { useAppSettings } from '../lib/AppSettingsContext';
import NumberInput from './NumberInput';
import AddWithOwner from './AddWithOwner';
import Card from './Card';
import RemoveButton from './RemoveButton';
import OwnerGroupedList from './OwnerGroupedList';

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

  const totalTakeHome = salaries.reduce(
    (s, sal) => s + calcSalaryBreakdown(sal, tax).takeHomeMonthly,
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
              <th className="pb-2 pr-3 font-normal">Pension account</th>
              <th className="pb-2 pr-3 font-normal text-right">Sacrifice</th>
              <th className="pb-2 pr-3 font-normal text-right">Employer</th>
              <th className="pb-2 pr-3 font-normal text-right">Tax/mo</th>
              <th className="pb-2 pr-3 font-normal text-right">NI/mo</th>
              <th className="pb-2 pr-3 font-normal text-right">Take-home/mo</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const breakdown = calcSalaryBreakdown(s, tax);
              return (
                <Fragment key={s.id}>
                  <tr className="border-b border-rule/60">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => update(s.id, { name: e.target.value })}
                        onFocus={selectOnFocus}
                        placeholder="Salary name"
                        className="w-full bg-transparent focus:outline-none focus-visible:border-b focus-visible:border-brass"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <NumberInput
                        value={s.grossAnnual}
                        onChange={(grossAnnual) => update(s.id, { grossAnnual })}
                        className="w-24 bg-transparent text-right font-mono tabular focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={s.pensionAccountId ?? ''}
                        onChange={(e) => update(s.id, { pensionAccountId: e.target.value || undefined })}
                        className="bg-transparent text-sm focus:outline-none"
                      >
                        <option value="">None</option>
                        {eligibleAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name || 'Unnamed account'}
                          </option>
                        ))}
                        {/* Keep a currently-selected account visible even if it no longer matches
                            (e.g. its type or owner changed after being linked here). */}
                        {(() => {
                          const selected = accounts.find(
                            (a) => a.id === s.pensionAccountId && !eligibleAccounts.includes(a)
                          );
                          return selected ? (
                            <option key={selected.id} value={selected.id}>
                              {(selected.name || 'Unnamed account') + ' (mismatched owner/type)'}
                            </option>
                          ) : null;
                        })()}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <NumberInput
                        value={s.sacrificePercent}
                        onChange={(sacrificePercent) => update(s.id, { sacrificePercent })}
                        className="w-14 bg-transparent text-right font-mono tabular focus:outline-none"
                      />
                      <span className="text-inkfaint text-xs">%</span>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <NumberInput
                        value={s.employerContributionPercent}
                        onChange={(employerContributionPercent) => update(s.id, { employerContributionPercent })}
                        className="w-14 bg-transparent text-right font-mono tabular focus:outline-none"
                      />
                      <span className="text-inkfaint text-xs">%</span>
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
                  <tr className="border-b border-rule/60">
                    <td colSpan={9} className="pb-3 pt-0 pl-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-inkfaint">Other deductions:</span>
                        {s.otherDeductions.map((d) => (
                          <div key={d.id} className="flex items-center gap-1 bg-black/[0.03] rounded-sm px-2 py-1">
                            <input
                              type="text"
                              value={d.name}
                              onChange={(e) => updateDeduction(s.id, d.id, { name: e.target.value })}
                              onFocus={selectOnFocus}
                              placeholder="e.g. Health insurance"
                              className="w-28 bg-transparent text-xs focus:outline-none border-b border-rule"
                            />
                            <NumberInput
                              value={d.amount}
                              onChange={(amount) => updateDeduction(s.id, d.id, { amount })}
                              className="w-14 bg-transparent text-right text-xs font-mono tabular focus:outline-none border-b border-rule"
                            />
                            <select
                              value={d.frequency}
                              onChange={(e) => updateDeduction(s.id, d.id, { frequency: e.target.value as Frequency })}
                              className="bg-transparent text-[11px] focus:outline-none"
                            >
                              {FREQUENCIES.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                            <RemoveButton
                              onClick={() => removeDeduction(s.id, d.id)}
                              label={`Remove ${d.name || 'deduction'}`}
                              size="xs"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => addDeduction(s.id)}
                          aria-label="Add deduction"
                          className="text-[11px] font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-0.5"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-rule/60">
                    <td colSpan={9} className="pb-3 pt-0 pl-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-inkfaint">Bonuses:</span>
                        {s.bonuses.map((b) => (
                          <div key={b.id} className="flex items-center gap-1 bg-black/[0.03] rounded-sm px-2 py-1">
                            <input
                              type="date"
                              value={b.date}
                              onChange={(e) => updateBonus(s.id, b.id, { date: e.target.value })}
                              className="bg-transparent text-xs font-mono focus:outline-none border-b border-rule"
                            />
                            <input
                              type="text"
                              value={b.name}
                              onChange={(e) => updateBonus(s.id, b.id, { name: e.target.value })}
                              onFocus={selectOnFocus}
                              placeholder="e.g. Annual bonus"
                              className="w-24 bg-transparent text-xs focus:outline-none border-b border-rule"
                            />
                            <NumberInput
                              value={b.amount}
                              onChange={(amount) => updateBonus(s.id, b.id, { amount })}
                              className="w-16 bg-transparent text-right text-xs font-mono tabular focus:outline-none border-b border-rule"
                            />
                            <RemoveButton
                              onClick={() => removeBonus(s.id, b.id)}
                              label={`Remove ${b.name || 'bonus'}`}
                              size="xs"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => addBonus(s.id)}
                          aria-label="Add bonus"
                          className="text-[11px] font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-0.5"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
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
      <p className="text-xs text-inkfaint mb-4">
        Gross pay, with Income Tax, National Insurance, and pension salary sacrifice worked out
        automatically. Edit the bands in Settings if these change. "Other sacrifice deductions"
        covers flat-amount salary sacrifice with no savings destination — health insurance, a cycle
        to work scheme, etc — treated as reducing taxable and NI-able pay the same way pension
        sacrifice does. Some benefits lost this tax advantage under 2017 rules, so double-check
        against your payslip. "Bonuses" are one-off gross payments, taxed at your marginal rate for
        the month they land (so a large one can cost more per pound if it crosses into a higher
        band).
      </p>

      <OwnerGroupedList
        items={salaries}
        getOwnerId={(s) => s.ownerId}
        total={(list) =>
          `${formatCurrency(list.reduce((s, sal) => s + calcSalaryBreakdown(sal, tax).takeHomeMonthly, 0), currency)}/mo`
        }
        totalClassName="text-teal"
      >
        {(list, ownerId) => renderTable(list, ownerId)}
      </OwnerGroupedList>
    </Card>
  );
}
