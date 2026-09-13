import { describe, expect, it } from 'vitest';
import { hasDateCollision, firstFreeDate } from './scheduleValidation';

interface Item {
  id: string;
  date: string;
}

describe('hasDateCollision', () => {
  it('is false when no other entry shares the date', () => {
    const items: Item[] = [{ id: 'a', date: '2027-01-01' }];
    expect(hasDateCollision(items, 'a', '2027-06-01')).toBe(false);
  });

  it('is true when a different entry already has that date', () => {
    const items: Item[] = [{ id: 'a', date: '2027-01-01' }, { id: 'b', date: '2027-06-01' }];
    expect(hasDateCollision(items, 'a', '2027-06-01')).toBe(true);
  });

  it('ignores the entry\'s own current date (excludeId)', () => {
    const items: Item[] = [{ id: 'a', date: '2027-01-01' }];
    expect(hasDateCollision(items, 'a', '2027-01-01')).toBe(false);
  });
});

describe('firstFreeDate', () => {
  it('returns the requested date unchanged when nothing collides', () => {
    expect(firstFreeDate<Item>([], '2027-01-01')).toBe('2027-01-01');
  });

  it('advances by a day at a time until a free date is found', () => {
    const items: Item[] = [{ id: 'a', date: '2027-01-01' }, { id: 'b', date: '2027-01-02' }];
    expect(firstFreeDate(items, '2027-01-01')).toBe('2027-01-03');
  });

  it('terminates and rolls over correctly across a month/year boundary (regression: a UTC-conversion bug here previously caused an infinite loop)', () => {
    const items: Item[] = [{ id: 'a', date: '2027-12-31' }];
    expect(firstFreeDate(items, '2027-12-31')).toBe('2028-01-01');
  });
});
