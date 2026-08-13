'use client';

/**
 * FIELD-TRACK-1 — enforces `field_tracking.requires_active_session` when a
 * survey belonging to a route activity is opened.
 *
 * `block` pushes the brigadista back rather than letting them capture data
 * that would never land on any track; `warn` only tells them. The config comes
 * from the cached assignment, so the gate works offline.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import type { FieldTrackingConfig } from '@/lib/api/field-session.service';
import { readDurableAssignments } from '@/lib/services/assignment-cache.service';
import { fieldSessionService } from '@/lib/services/field-session.service';
import { readCachedAssignment } from '@/lib/utils/survey-version';

/**
 * sessionStorage is empty on a cold offline load, so fall back to the durable
 * assignment snapshot before deciding the survey has no tracking config.
 */
async function resolveConfig(
  surveyId: number
): Promise<FieldTrackingConfig | null> {
  const fromSession = readCachedAssignment(surveyId)?.field_tracking;
  if (fromSession) return fromSession;

  const assignments = await readDurableAssignments();
  return (
    assignments.find((item) => item.survey_id === surveyId)?.field_tracking ??
    null
  );
}

export function useFieldSessionGate(surveyId: string, ready: boolean): void {
  const router = useRouter();
  // Fire once per screen entry; the effect deps churn as the survey loads.
  const shown = useRef(false);

  useEffect(() => {
    if (!ready || shown.current) return;

    const numericId = Number(surveyId);
    if (!Number.isFinite(numericId)) return;

    let cancelled = false;

    void (async () => {
      const config = await resolveConfig(numericId);
      if (cancelled || !config?.enabled) return;
      if (config.requires_active_session === 'off') return;

      const active = await fieldSessionService.getActiveSession();
      if (cancelled || active) return;

      shown.current = true;

      if (config.requires_active_session === 'warn') {
        toast.warning('Sin recorrido activo', {
          description:
            'Esta encuesta forma parte de una actividad de recorrido. Puedes continuar, pero tu ruta no quedará registrada.',
          duration: 8000,
        });
        return;
      }

      toast.error('Inicia tu recorrido para continuar', {
        description:
          'Esta encuesta solo puede responderse durante un recorrido activo.',
      });
      router.replace('/surveys');
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, surveyId, router]);
}
