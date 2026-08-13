'use client';

/**
 * FIELD-TRACK-1 — React binding for the route session service.
 *
 * Dexie's live query drives the totals (they change on every fix), while the
 * service subscription carries the parts Dexie cannot see: whether the
 * geolocation watch is running and whether the Wake Lock is held.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import type { FieldTrackingConfig } from '@/lib/api/field-session.service';
import { db, type FieldSession } from '@/lib/db/database';
import {
  fieldSessionService,
  type FieldSessionEndReason,
  type StartSessionResult,
} from '@/lib/services/field-session.service';

export interface UseFieldSessionResult {
  session: FieldSession | null;
  pendingSamples: number;
  isCollecting: boolean;
  wakeLockHeld: boolean;
  busy: boolean;
  config: FieldTrackingConfig | null;
  start: (params?: {
    activityType?: string;
    surveyId?: number | null;
    config?: FieldTrackingConfig;
  }) => Promise<StartSessionResult>;
  end: (reason?: FieldSessionEndReason) => Promise<void>;
}

export function useFieldSession(): UseFieldSessionResult {
  const [runtime, setRuntime] = useState({
    isCollecting: false,
    wakeLockHeld: false,
  });
  const [busy, setBusy] = useState(false);

  const session =
    useLiveQuery(async () => {
      const rows = await db.field_sessions.where('status').equals('active').toArray();
      if (rows.length === 0) return null;
      rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
      return rows[0];
    }, []) ?? null;

  const pendingSamples =
    useLiveQuery(async () => {
      if (!session) return 0;
      return db.field_session_samples
        .where('[session_client_id+upload_status]')
        .equals([session.client_id, 'pending'])
        .count();
    }, [session?.client_id]) ?? 0;

  useEffect(() => {
    return fieldSessionService.subscribe((snapshot) => {
      setRuntime({
        isCollecting: snapshot.isCollecting,
        wakeLockHeld: snapshot.wakeLockHeld,
      });
    });
  }, []);

  const start = useCallback<UseFieldSessionResult['start']>(async (params) => {
    setBusy(true);
    try {
      return await fieldSessionService.startSession(params);
    } finally {
      setBusy(false);
    }
  }, []);

  const end = useCallback(async (reason: FieldSessionEndReason = 'manual') => {
    setBusy(true);
    try {
      await fieldSessionService.endSession(reason);
    } finally {
      setBusy(false);
    }
  }, []);

  let config: FieldTrackingConfig | null = null;
  if (session) {
    try {
      config = JSON.parse(session.config_json) as FieldTrackingConfig;
    } catch {
      config = null;
    }
  }

  return {
    session,
    pendingSamples,
    isCollecting: runtime.isCollecting,
    wakeLockHeld: runtime.wakeLockHeld,
    busy,
    config,
    start,
    end,
  };
}
