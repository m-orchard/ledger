import type { Frequency } from '../types';

export function toMonthlyAmount(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'annual':
      return amount / 12;
    default:
      return amount;
  }
}
