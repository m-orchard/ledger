import { useEffect, useRef, useState } from 'react';
import { todayISO, formatRelativeDate } from '../lib/date';
import Popover from './Popover';

interface Props {
  value: string;
  onChange: (date: string) => void;
  label: string;
  /** Bump this to a new value (e.g. a counter) to auto-open the popover — used when the balance itself just changed. */
  autoOpenSignal?: number;
  align?: 'left' | 'right';
}

/**
 * Compact replacement for a standing "As of" column: a small calendar icon next to the
 * balance, showing the date on hover, that opens a popover with the editable date + a
 * "Today" shortcut only when clicked (or auto-opened after a balance edit).
 */
export default function AsOfField({ value, onChange, label, autoOpenSignal, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const prevSignal = useRef(autoOpenSignal);

  useEffect(() => {
    if (autoOpenSignal !== undefined && autoOpenSignal !== prevSignal.current) {
      setOpen(true);
    }
    prevSignal.current = autoOpenSignal;
  }, [autoOpenSignal]);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      anchor={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`As of date for ${label}`}
          title={`As of ${formatRelativeDate(value)}`}
          className="text-inkfaint hover:text-teal"
        >
          <CalendarIcon />
        </button>
      }
    >
      <p className="text-[11px] text-inkfaint mb-2">As of</p>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-rule py-1 text-sm font-mono focus:outline-none focus-visible:border-brass"
      />
      <button
        type="button"
        onClick={() => {
          onChange(todayISO());
          setOpen(false);
        }}
        className="mt-2 text-[11px] font-mono text-teal hover:text-ink border border-teal/40 hover:border-teal rounded-sm px-2 py-1"
      >
        Today
      </button>
    </Popover>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="3" width="12" height="11" rx="1" />
      <path d="M2 6.5h12M5 1.5v3M11 1.5v3" strokeLinecap="round" />
    </svg>
  );
}
