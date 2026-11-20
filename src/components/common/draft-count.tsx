'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { draftRowHasContent } from '@/lib/services/draft.service';
const DraftCountContext = createContext<number | null>(null);

async function countMeaningfulDrafts(): Promise<number> {
  const drafts = await db.responses.where('status').equals('draft').toArray();
  if (drafts.length === 0) return 0;

  const emptyIds: string[] = [];
  let meaningful = 0;
  for (const draft of drafts) {
    if (draftRowHasContent(draft)) {
      meaningful += 1;
      continue;
    }
    emptyIds.push(draft.response_id);
  }
  if (emptyIds.length === 0) return meaningful;

  const withFiles = new Set<string>();
  await db.local_files
    .where('response_id')
    .anyOf(emptyIds)
    .each((file) => {
      withFiles.add(file.response_id);
    });
  return meaningful + withFiles.size;
}

export function DraftCountProvider({ children }: { children: ReactNode }) {
  const draftCount = useLiveQuery(countMeaningfulDrafts, []) ?? 0;
  const value = useMemo(() => draftCount, [draftCount]);

  return (
    <DraftCountContext.Provider value={value}>{children}</DraftCountContext.Provider>
  );
}

/**
 * Count drafts that actually have answers. Empty shells from hydrate
 * autosave must not light the nav badge / banners.
 * One live query, shared by the dashboard chrome.
 */
export function useDraftCount(): number {
  return useContext(DraftCountContext) ?? 0;
}
