import { useState } from 'react';
import type { SalaryChange } from '../types';
import { newId } from '../lib/storage';
import { hasDateCollision, firstFreeDate } from '../lib/scheduleValidation';
import NumberInput from './NumberInput';
import Modal from './Modal';
import RemoveButton from './RemoveButton';

interface Props {
  label: string;
  changes: SalaryChange[];
  onChange: (changes: SalaryChange[]) => void;
  /** Current gross/sacrifice/employer figures, used to prefill a newly-added change. */
  current: { grossAnnual: number; sacrificePercent: number; employerContributionPercent: number };
  endDate: string | undefined;
  onEndDateChange: (endDate: string | undefined) => void;
}

/**
 * A small trigger next to Gross/yr that opens a popup for editing scheduled future changes to
 * a salary's gross/sacrifice/employer figures (a pay rise, a new job, a sacrifice adjustment),
 * and this role's end date — same pattern as RateSchedule, one row per change with the column
 * labels shown once, except a change fully replaces all three fields together rather than a
 * single rate. Ending a role here doesn't delete anything — it just stops the salary
 * contributing income/tax/pension routing from that date, keeping the record intact.
 */
export default function SalarySchedule({ label, changes, onChange, current, endDate, onEndDateChange }: Props) {
  const [open, setOpen] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const sorted = [...changes].sort((a, b) => a.date.localeCompare(b.date));

  function update(id: string, patch: Partial<SalaryChange>) {
    if (patch.date !== undefined && hasDateCollision(changes, id, patch.date)) {
      setConflictId(id);
      return;
    }
    setConflictId(null);
    onChange(changes.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remove(id: string) {
    if (conflictId === id) setConflictId(null);
    onChange(changes.filter((c) => c.id !== id));
  }

  function add() {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const iso = `${nextYear.getFullYear()}-${String(nextYear.getMonth() + 1).padStart(2, '0')}-${String(nextYear.getDate()).padStart(2, '0')}`;
    const date = firstFreeDate(changes, iso);
    onChange([...changes, { id: newId(), date, ...current }]);
  }

  const triggerLabel = endDate ? 'ended' : changes.length === 0 ? '+' : String(changes.length);
  const triggerTitle = endDate
    ? `Ended ${endDate}`
    : changes.length === 0
      ? 'Add a salary schedule'
      : `${changes.length} scheduled change${changes.length === 1 ? '' : 's'}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Edit salary schedule — ${triggerTitle}`}
        title={triggerTitle}
        className={`text-[11px] font-mono underline decoration-dotted underline-offset-2 ${
          endDate ? 'text-brick hover:text-brick/80' : 'text-inkfaint hover:text-teal'
        }`}
      >
        {triggerLabel}
      </button>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-rule/60">
            <span className="text-xs text-inkfaint shrink-0">Role ends</span>
            <input
              type="date"
              value={endDate ?? ''}
              onChange={(e) => onEndDateChange(e.target.value || undefined)}
              className="bg-transparent border-b border-rule py-1 text-sm font-mono focus:outline-none focus-visible:border-brass"
            />
            {endDate && (
              <button
                onClick={() => onEndDateChange(undefined)}
                className="text-[11px] font-mono text-inkfaint hover:text-teal underline decoration-dotted underline-offset-2"
              >
                clear
              </button>
            )}
          </div>
          {endDate && (
            <p className="text-xs text-inkfaint mb-4">
              From this date, no income, tax, NI, or pension contribution is counted for this
              salary, and its bonuses stop applying — nothing here is deleted, this only affects
              the projection.
            </p>
          )}

          <p className="text-xs text-inkfaint mb-4">
            Changes apply from their date onward, in order — the figures shown in the table cover
            everything before the first one. Each change fully replaces gross/sacrifice/employer
            together, not just one of them.
          </p>

          {sorted.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-inkfaint mb-1">
              <span className="flex-1">Date</span>
              <span className="w-16 text-right">Gross/yr</span>
              <span className="w-11 text-right">Sacr. %</span>
              <span className="w-11 text-right">Empl. %</span>
              <span className="w-3.5" />
            </div>
          )}

          <div className="space-y-1.5">
            {sorted.map((c) => (
              <div key={c.id}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={c.date}
                    onChange={(e) => update(c.id, { date: e.target.value })}
                    className={`flex-1 min-w-0 bg-transparent border-b py-1 text-sm font-mono focus:outline-none focus-visible:border-brass ${
                      conflictId === c.id ? 'border-brick' : 'border-rule'
                    }`}
                  />
                  <NumberInput
                    value={c.grossAnnual}
                    onChange={(grossAnnual) => update(c.id, { grossAnnual })}
                    decimalScale={0}
                    className="w-16 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                  />
                  <NumberInput
                    value={c.sacrificePercent}
                    onChange={(sacrificePercent) => update(c.id, { sacrificePercent })}
                    decimalScale={0}
                    className="w-11 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                  />
                  <NumberInput
                    value={c.employerContributionPercent}
                    onChange={(employerContributionPercent) => update(c.id, { employerContributionPercent })}
                    decimalScale={0}
                    className="w-11 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                  />
                  <RemoveButton onClick={() => remove(c.id)} label="Remove change" size="xs" />
                </div>
                {conflictId === c.id && (
                  <p className="text-[11px] text-brick mt-0.5">Already have a change on that date.</p>
                )}
              </div>
            ))}
            {sorted.length === 0 && <p className="text-xs text-inkfaint italic">No scheduled changes yet.</p>}
          </div>

          <button
            onClick={add}
            className="mt-3 text-xs font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
          >
            + add change
          </button>
        </Modal>
      )}
    </>
  );
}
