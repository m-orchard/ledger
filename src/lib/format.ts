import type { Settings } from '../types';

const LOCALE_BY_CURRENCY: Record<Settings['currency'], string> = {
  GBP: 'en-GB',
  USD: 'en-US',
  EUR: 'de-DE',
};

export function formatCurrency(value: number, currency: Settings['currency'], opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 0 : 2,
    notation: opts?.compact ? 'compact' : 'standard',
  }).format(value);
}

export function formatAge(age: number): string {
  return age % 1 === 0 ? `${age}` : age.toFixed(1);
}
