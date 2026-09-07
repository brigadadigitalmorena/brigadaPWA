'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';

export function useDraftCount(): number {
  const count = useLiveQuery(
    () => db.responses.where('status').equals('draft').count(),
    []
  );
  return count ?? 0;
}
