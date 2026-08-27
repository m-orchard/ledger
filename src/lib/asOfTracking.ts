import { useRef, useState } from 'react';

/**
 * Tracks ids of rows created in this session so their first balance edit doesn't nudge the
 * "as of" popover open — a just-created row's "as of" already defaults to today, so there's
 * nothing to confirm.
 */
export function useNewRowTracking() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  function markNew(id: string) {
    setIds((prev) => new Set(prev).add(id));
  }

  function clearNew(id: string) {
    setIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return { isNew: (id: string) => ids.has(id), markNew, clearNew };
}

/**
 * Detects a genuine change to a balance/value field between focus and blur, exposing an
 * incrementing signal for AsOfField's `autoOpenSignal`. Suppressed once for a just-created
 * row (isNew), consuming that flag via onSettled regardless of whether the value changed.
 */
export function useAsOfAutoOpen(currentValue: number, isNew: boolean, onSettled: () => void) {
  const [signal, setSignal] = useState(0);
  const valueAtFocus = useRef(currentValue);

  function handleFocus() {
    valueAtFocus.current = currentValue;
  }

  function handleBlur() {
    if (isNew) {
      onSettled();
      return;
    }
    if (currentValue !== valueAtFocus.current) {
      setSignal((s) => s + 1);
    }
  }

  return { signal, handleFocus, handleBlur };
}
