'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { InlineBanner } from '@/components/ui/inline-banner';
import { getSyncErrorCopy } from '@/lib/sync/error-copy';
import {
  isLowStorage,
  isOpenSchemaMismatch,
  isPendingConfirm,
} from '@/lib/storage/field-alerts';

const SCHEMA_DISMISS_KEY = 'brigada_schema_mismatch_dismissed';
const LOW_STORAGE_DISMISS_KEY = 'brigada_low_storage_dismissed';
const sessionFlagListeners = new Set<() => void>();

function subscribeSessionFlags(onStoreChange: () => void) {
  sessionFlagListeners.add(onStoreChange);
  return () => sessionFlagListeners.delete(onStoreChange);
}

function readSessionFlag(key: string) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function dismissSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode */
  }
  sessionFlagListeners.forEach((listener) => listener());
}

export function FieldAlertBanners() {
  const schemaMismatchCount =
    useLiveQuery(
      () => db.sync_queue.filter(isOpenSchemaMismatch).count(),
      []
    ) ?? 0;
  const pendingConfirms =
    useLiveQuery(
      () => db.sync_queue.filter(isPendingConfirm).count(),
      []
    ) ?? 0;
  const [lowStorage, setLowStorage] = useState(false);
  const schemaDismissed = useSyncExternalStore(
    subscribeSessionFlags,
    () => readSessionFlag(SCHEMA_DISMISS_KEY),
    () => false
  );
  const lowStorageDismissed = useSyncExternalStore(
    subscribeSessionFlags,
    () => readSessionFlag(LOW_STORAGE_DISMISS_KEY),
    () => false
  );
  const [pendingDismissedFor, setPendingDismissedFor] = useState<number | null>(
    null
  );

  useEffect(() => {
    const storage = navigator.storage;
    if (!storage?.estimate) return;
    void storage.persist?.();
    void storage.estimate().then((estimate) => {
      setLowStorage(isLowStorage(estimate.usage ?? 0, estimate.quota ?? 0));
    });
  }, []);

  if (
    pendingDismissedFor !== null &&
    pendingConfirms !== pendingDismissedFor
  ) {
    setPendingDismissedFor(null);
  }

  const schemaCopy = getSyncErrorCopy('schema_mismatch');
  const showSchema = schemaMismatchCount > 0 && !schemaDismissed;
  const showPending =
    pendingConfirms > 0 && pendingDismissedFor !== pendingConfirms;
  const showLowStorage = lowStorage && !lowStorageDismissed;

  return (
    <>
      {showSchema && (
        <InlineBanner
          variant="info"
          message={`${schemaCopy.title}. ${schemaCopy.body ?? schemaCopy.action}`}
          onClose={() => dismissSessionFlag(SCHEMA_DISMISS_KEY)}
        />
      )}
      {showPending && (
        <InlineBanner
          variant="warning"
          message={`${pendingConfirms} archivo${pendingConfirms === 1 ? '' : 's'} subido${pendingConfirms === 1 ? '' : 's'} con confirmación pendiente.`}
          onClose={() => setPendingDismissedFor(pendingConfirms)}
        />
      )}
      {showLowStorage && (
        <InlineBanner
          variant="warning"
          message="Queda poco espacio en el navegador. Sincroniza y evita guardar fotos de más."
          onClose={() => dismissSessionFlag(LOW_STORAGE_DISMISS_KEY)}
        />
      )}
    </>
  );
}
