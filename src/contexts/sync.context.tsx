'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet, kvRemove } from '@/lib/db/database';
import { SyncStatus } from '@/lib/types';
import {
  processSyncQueue,
  makeRetryWaitDueNow,
  discardDeadLetter,
  getQueueStats,
} from '@/lib/services/sync-engine.service';
import { configureOnlineModeKv } from '@/lib/sync';

interface SyncContextType extends SyncStatus {
  deadLetterCount: number;
  retryWaitCount: number;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearDeadLetter: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);
const PERIODIC_MS = 2 * 60 * 1000;

configureOnlineModeKv({
  get: kvGet,
  set: (key, value) => kvSet(key, value),
  remove: kvRemove,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [extraStats, setExtraStats] = useState({ deadLetter: 0, retryWait: 0 });
  const isSyncingRef = useRef(false);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pendingCount =
    useLiveQuery(async () => {
      const pending = await db.sync_queue.where('status').equals('pending').count();
      const retry = await db.sync_queue.where('status').equals('retry_wait').count();
      return pending + retry;
    }, []) ?? 0;

  const deadLetterLive =
    useLiveQuery(async () => {
      const dl = await db.sync_queue.where('status').equals('dead_letter').count();
      const fp = await db.sync_queue.where('status').equals('failed_permanent').count();
      const failed = await db.sync_queue.where('status').equals('failed').count();
      return dl + fp + failed;
    }, []) ?? 0;

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setError(undefined);

    try {
      await makeRetryWaitDueNow();
      await processSyncQueue({
        onProgress: (message) => console.log('Sync progress:', message),
      });
      setLastSyncedAt(new Date().toISOString());
      const stats = await getQueueStats();
      setExtraStats({ deadLetter: stats.deadLetter, retryWait: stats.retryWait });
    } catch (err) {
      console.error('Sync failed:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const retryFailed = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      await db.sync_queue
        .where('status')
        .anyOf(['failed', 'retry_wait', 'dead_letter', 'failed_permanent'])
        .modify({
          status: 'pending',
          retry_count: 0,
          next_retry_at: now,
          last_error: undefined,
          last_error_code: undefined,
          lease_owner: undefined,
          lease_until: undefined,
          updated_at: now,
        });
      await syncNow();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, [syncNow]);

  const clearDeadLetter = useCallback(async () => {
    try {
      await discardDeadLetter();
    } catch (err) {
      console.error('Clear dead letter failed:', err);
    }
  }, []);

  // Wake on reconnect
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      const t = setTimeout(() => {
        syncNow();
      }, 1000);
      wasOnline.current = isOnline;
      return () => clearTimeout(t);
    }
    wasOnline.current = isOnline;
  }, [isOnline, syncNow]);

  // Wake on visibility / focus
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [syncNow]);

  // Periodic poll while online
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => {
      if (pendingCount > 0) syncNow();
    }, PERIODIC_MS);
    return () => clearInterval(id);
  }, [isOnline, pendingCount, syncNow]);

  // Initial auto-sync when there is work
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      const t = setTimeout(() => syncNow(), 0);
      return () => clearTimeout(t);
    }
  }, [isOnline, pendingCount, syncNow]);

  // Ask SW to register background sync tag (wakes Dexie processor via message)
  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window
    ) {
      navigator.serviceWorker.ready
        .then((reg) => {
          const syncReg = reg as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
          return syncReg.sync?.register('brigada-dexie-sync');
        })
        .catch(() => {
          /* Background Sync unsupported */
        });
    }
  }, [pendingCount]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BRIGADA_SYNC_WAKE') {
        syncNow();
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [syncNow]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        deadLetterCount: deadLetterLive || extraStats.deadLetter,
        retryWaitCount: extraStats.retryWait,
        lastSyncedAt,
        error,
        syncNow,
        retryFailed,
        clearDeadLetter,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
