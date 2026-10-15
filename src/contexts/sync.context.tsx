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
import { describeSyncRun, type SyncRunNotice } from '@/lib/sync/sync-run';
import { fieldSessionService } from '@/lib/services/field-session.service';
import { toast } from 'sonner';

const LAST_SYNC_KEY = 'brigada_last_confirmed_sync_at';

interface SyncContextType extends SyncStatus {
  deadLetterCount: number;
  retryWaitCount: number;
  syncNotice: SyncRunNotice | null;
  syncNow: (source?: 'user') => Promise<void>;
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
  const [syncNotice, setSyncNotice] = useState<SyncRunNotice | null>(null);
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
      const leased = await db.sync_queue.where('status').equals('leased').count();
      const syncing = await db.sync_queue.where('status').equals('syncing').count();
      return pending + retry + leased + syncing;
    }, []) ?? 0;

  const deadLetterLive =
    useLiveQuery(async () => {
      const dl = await db.sync_queue.where('status').equals('dead_letter').count();
      const fp = await db.sync_queue.where('status').equals('failed_permanent').count();
      const failed = await db.sync_queue.where('status').equals('failed').count();
      return dl + fp + failed;
    }, []) ?? 0;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) setLastSyncedAt(stored);
    } catch {
      /* private mode */
    }
  }, []);

  const syncNow = useCallback(async (source?: 'user') => {
    const manual = source === 'user';

    if (!navigator.onLine) {
      const notice: SyncRunNotice = {
        tone: 'warning',
        confirmed: false,
        message: 'Sin conexión. Los envíos saldrán cuando recuperes red.',
      };
      setSyncNotice(notice);
      setError(notice.message);
      if (manual) toast.warning(notice.message);
      return;
    }

    if (isSyncingRef.current) {
      if (manual) {
        toast.message('Ya se está enviando. Espera a que termine.');
      }
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    if (manual) {
      setSyncNotice(null);
      setError(undefined);
    }

    try {
      await makeRetryWaitDueNow();
      const result = await processSyncQueue({
        onProgress: (message) => console.log('Sync progress:', message),
      });
      const notice = describeSyncRun(result);
      const quietIdle = result.attempted === 0 && !result.skippedReason && !manual;

      if (notice.confirmed) {
        const stamped = new Date().toISOString();
        setLastSyncedAt(stamped);
        try {
          localStorage.setItem(LAST_SYNC_KEY, stamped);
        } catch {
          /* private mode */
        }
        setSyncNotice(notice);
        setError(undefined);
      } else if (!quietIdle) {
        setSyncNotice(notice);
        setError(notice.message);
      }

      if (manual && !quietIdle) {
        if (notice.tone === 'success') toast.success(notice.message);
        else if (notice.tone === 'warning') toast.warning(notice.message);
        else toast.error(notice.message);
      } else if (manual && quietIdle) {
        toast.message('No hay envíos pendientes.');
      }

      const stats = await getQueueStats();
      setExtraStats({ deadLetter: stats.deadLetter, retryWait: stats.retryWait });
    } catch (err) {
      console.error('Sync failed:', err);
      const message = err instanceof Error ? err.message : 'No se pudo sincronizar';
      const notice: SyncRunNotice = { tone: 'error', confirmed: false, message };
      setSyncNotice(notice);
      setError(message);
      toast.error(message);
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
      await syncNow('user');
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
        void import('@/lib/services/static-maps-sync.service').then((m) =>
          m.syncStaticMaps()
        );
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

  // FIELD-TRACK-1 — a reload kills the geolocation watch, so an open route has
  // to be re-attached (and the dead interval recorded as a gap) on every mount.
  useEffect(() => {
    void fieldSessionService.resumeOnLoad().catch(() => {
      // Route capture is best-effort in the browser; never block boot on it.
    });
  }, []);

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
        syncNotice,
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
