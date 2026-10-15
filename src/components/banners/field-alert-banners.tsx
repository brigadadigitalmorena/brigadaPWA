'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { InlineBanner } from '@/components/ui/inline-banner';
import { getSyncErrorCopy } from '@/lib/sync/error-copy';
import {
  countPendingConfirms,
  hasSchemaMismatch,
  isLowStorage,
} from '@/lib/storage/field-alerts';

const DISMISS_KEY = 'brigada_schema_mismatch_dismissed';

export function FieldAlertBanners() {
  const queue = useLiveQuery(() => db.sync_queue.toArray(), []) ?? [];
  const [lowStorage, setLowStorage] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    const storage = navigator.storage;
    if (!storage?.estimate) return;
    void storage.persist?.();
    void storage.estimate().then((estimate) => {
      setLowStorage(isLowStorage(estimate.usage ?? 0, estimate.quota ?? 0));
    });
  }, []);

  const schemaCopy = getSyncErrorCopy('schema_mismatch');
  const showSchema = hasSchemaMismatch(queue) && !dismissed;
  const pendingConfirms = countPendingConfirms(queue);

  return (
    <>
      {showSchema && (
        <InlineBanner
          variant="info"
          message={`${schemaCopy.title}. ${schemaCopy.body ?? schemaCopy.action}`}
          onClose={() => {
            sessionStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
        />
      )}
      {pendingConfirms > 0 && (
        <InlineBanner
          variant="warning"
          message={`${pendingConfirms} archivo${pendingConfirms === 1 ? '' : 's'} subido${pendingConfirms === 1 ? '' : 's'} con confirmación pendiente.`}
        />
      )}
      {lowStorage && (
        <InlineBanner
          variant="warning"
          message="Queda poco espacio en el navegador. Sincroniza y evita guardar fotos de más."
        />
      )}
    </>
  );
}
