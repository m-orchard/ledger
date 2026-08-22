import type { ReactNode } from 'react';
import { SHARED_OWNER } from '../types';
import { ownerBuckets } from '../lib/ownership';
import { useAppSettings } from '../lib/AppSettingsContext';
import ColorDot from './ColorDot';

interface Props<T> {
  items: T[];
  getOwnerId: (item: T) => string;
  /** Pre-formatted total shown next to each owner's name (e.g. via formatCurrency, with any "/mo" suffix already applied). */
  total: (items: T[]) => string;
  totalClassName: string;
  /** Renders one owner's items — receives that owner's id too, for tables that filter sibling data by it. */
  children: (items: T[], ownerId: string) => ReactNode;
}

/**
 * Splits a list into per-household-member sections (plus a trailing "Shared"
 * bucket), each with a colour dot, name, and running total — falling back to
 * rendering everything flat when there's no household set up.
 */
export default function OwnerGroupedList<T>({ items, getOwnerId, total, totalClassName, children }: Props<T>) {
  const { people, sharedColor } = useAppSettings();

  if (people.length === 0) {
    return <>{children(items, SHARED_OWNER)}</>;
  }

  return (
    <div className="space-y-6">
      {ownerBuckets(people, sharedColor)
        .map((owner) => ({ owner, ownerItems: items.filter((item) => getOwnerId(item) === owner.id) }))
        .filter(({ ownerItems }) => ownerItems.length > 0)
        .map(({ owner, ownerItems }) => (
          <div key={owner.id}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <ColorDot color={owner.color} />
                {owner.name || 'Unnamed'}
              </p>
              <span className={`font-mono text-xs tabular ${totalClassName}`}>{total(ownerItems)}</span>
            </div>
            {children(ownerItems, owner.id)}
          </div>
        ))}
    </div>
  );
}
