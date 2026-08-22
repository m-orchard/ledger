import type { FocusEvent } from 'react';

/** Selects an input's full current value on focus, so typing immediately replaces it. */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}
