'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { draftRowHasContent } from '@/lib/services/draft.service';

/**
 * Count drafts that actually have answers. Empty shells from hydrate
 * autosave must not light the nav badge / banners.
 */
export function useDraftCount(): number {
  const count = useLiveQuery(async () => {
    const drafts = await db.responses.where('status').equals('draft').toArray();
    if (drafts.length === 0) return 0;

    let meaningful = 0;
    for (const draft of drafts) {
      if (draftRowHasContent(draft)) {
        meaningful += 1;
        continue;
      }
      const fileCount = await db.local_files
        .where('response_id')
        .equals(draft.response_id)
        .count();
      if (fileCount > 0) meaningful += 1;
    }
    return meaningful;
  }, []);

  return count ?? 0;
}
