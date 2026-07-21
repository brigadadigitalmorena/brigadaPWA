'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { SyncStatus } from '@/lib/types';

interface SyncContextType extends SyncStatus {
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearDeadLetter: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  // Check online status
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

  // Get pending count from sync queue
  const pendingCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('pending').count(),
    []
  ) || 0;

  // Sync now
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setError(undefined);

    try {
      // TODO: Implement sync logic
      // 1. Get pending items from sync_queue
      // 2. Process each item
      // 3. Update status
      // 4. Handle errors and retries

      console.log('Sync started...');
      
      // Simulate sync delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setLastSyncedAt(new Date().toISOString());
      console.log('Sync completed');
    } catch (err) {
      console.error('Sync failed:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Retry failed items
  const retryFailed = useCallback(async () => {
    try {
      await db.sync_queue
        .where('status')
        .equals('failed')
        .modify({ status: 'pending', retry_count: 0 });
      
      await syncNow();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, [syncNow]);

  // Clear dead letter queue
  const clearDeadLetter = useCallback(async () => {
    try {
      await db.sync_queue.where('status').equals('dead_letter').delete();
    } catch (err) {
      console.error('Clear dead letter failed:', err);
    }
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
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
