import { useState } from 'react';
import type { RateChange } from '../types';
import { newId } from '../lib/storage';
import { hasDateCollision, firstFreeDate } from '../lib/scheduleValidation';
import NumberInput from './NumberInput';
import Modal from './Modal';
import RemoveButton from './RemoveButton';

interface Props {
  label: string;
  changes: RateChange[];
  onChange: (changes: RateChange[]) => void;
  /** Allow a negative rate — e.g. a depreciating asset. */
  allowNegative?: boolean;
}

/**
 * A small trigger next to a flat rate input that opens a popup for editing
 * scheduled future changes to that rate (a mortgage's fixed-rate period
 * ending, a bond maturing into a lower rate, etc). The base rate itself
 * stays as the plain NumberInput already next to this component.
 */
export default function RateSchedule({ label, changes, onChange, allowNegative }: Props) {
  const [open, setOpen] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const sorted = [...changes].sort((a, b) => a.date.localeCompare(b.date));

  function update(id: string, patch: Partial<RateChange>) {
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
    onChange([...changes, { id: newId(), date, rate: 0 }]);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={changes.length === 0 ? 'Add a rate schedule' : `Edit rate schedule (${changes.length} scheduled change${changes.length === 1 ? '' : 's'})`}
        title={changes.length === 0 ? 'Add a rate schedule' : `${changes.length} scheduled change${changes.length === 1 ? '' : 's'}`}
        className="text-[11px] font-mono text-inkfaint hover:text-teal underline decoration-dotted underline-offset-2"
      >
        {changes.length === 0 ? '+' : changes.length}
      </button>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <p className="text-xs text-inkfaint mb-4">
            Changes apply from their date onward, in order — the rate shown in the table covers
            everything before the first one.
          </p>

          <div className="space-y-2">
            {sorted.map((c) => (
              <div key={c.id}>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={c.date}
                    onChange={(e) => update(c.id, { date: e.target.value })}
                    className={`flex-1 bg-transparent border-b py-1 text-sm font-mono focus:outline-none focus-visible:border-brass ${
                      conflictId === c.id ? 'border-brick' : 'border-rule'
                    }`}
                  />
                  <div className="flex items-center gap-1">
                    <NumberInput
                      value={c.rate}
                      onChange={(rate) => update(c.id, { rate })}
                      allowNegative={allowNegative}
                      className="w-16 bg-transparent border-b border-rule py-1 text-sm font-mono text-right tabular focus:outline-none focus-visible:border-brass"
                    />
                    <span className="text-xs text-inkfaint">%</span>
                  </div>
                  <RemoveButton onClick={() => remove(c.id)} label="Remove change" />
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
