import type { Person } from '../types';
import { SHARED_OWNER } from '../types';

export interface OwnerBucket {
  id: string;
  name: string;
  color: string;
}

/** Every household member plus a trailing "Shared" bucket, in display order. */
export function ownerBuckets(people: Person[], sharedColor: string): OwnerBucket[] {
  return [...people, { id: SHARED_OWNER, name: 'Shared', color: sharedColor }];
}
