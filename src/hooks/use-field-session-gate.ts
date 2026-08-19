'use client';

/**
 * FIELD-TRACK-1 — enforces `field_tracking.requires_active_session` when a
 * survey belonging to a route activity is opened.
 *
 * `block` pushes the brigadista back rather than letting them capture data
 * that would never land on any track; `warn` only tells them. The config comes
 * from the cached entitlement, so the gate works offline.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { FieldTrackingConfig } from '@/lib/api/field-session.service';
import { readDurableEntitlements } from '@/lib/services/entitlement-cache.service';
import { matchEntitlement } from '@/lib/campaigns/scope';
import { fieldSessionService } from '@/lib/services/field-session.service';
import { readCachedEntitlement } from '@/lib/utils/survey-version';

/**
 * sessionStorage is empty on a cold offline load, so fall back to the durable
 * entitlement snapshot before deciding the survey has no tracking config.
 */
async function resolveConfig(
  surveyId: number,
  campaignId?: number | null,
): Promise<FieldTrackingConfig | null> {
  const fromSession = readCachedEntitlement(surveyId, campaignId)?.field_tracking;
  if (fromSession) return fromSession;

  const entitlements = await readDurableEntitlements();
  return (
    matchEntitlement(entitlements, surveyId, { campaignId })?.field_tracking ??
    null
  );
}

export interface FieldSessionGateState {
  blocked: boolean;
  starting: boolean;
  startRequiredSession: () => Promise<void>;
}

export function useFieldSessionGate(
  surveyId: string,
  ready: boolean,
  options?: { campaignId?: number | null; entitlementId?: number | null },
): FieldSessionGateState {
  const shown = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [requiredConfig, setRequiredConfig] =
    useState<FieldTrackingConfig | null>(null);

  useEffect(() => {
    if (!ready || shown.current) return;

    const numericId = Number(surveyId);
    if (!Number.isFinite(numericId)) return;

    let cancelled = false;

    void (async () => {
      const config = await resolveConfig(numericId, options?.campaignId);
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

      setRequiredConfig(config);
      setBlocked(true);
      toast.error('Inicia tu recorrido para continuar', {
        description:
          'Esta encuesta solo puede responderse durante un recorrido activo.',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, surveyId, options?.campaignId]);

  const startRequiredSession = async () => {
    if (!requiredConfig || starting) return;
    setStarting(true);
    try {
      const numericId = Number(surveyId);
      const fromSession = Number.isFinite(numericId)
        ? readCachedEntitlement(numericId, options?.campaignId)
        : null;
      const fromDurable = Number.isFinite(numericId)
        ? matchEntitlement(await readDurableEntitlements(), numericId, {
            campaignId: options?.campaignId,
            entitlementId: options?.entitlementId,
          })
        : undefined;
      const entitlement = fromSession ?? fromDurable;
      const result = await fieldSessionService.startSession({
        surveyId: Number(surveyId),
        campaignId: entitlement?.campaign_id ?? null,
        entitlementId: entitlement?.entitlement_id ?? null,
        config: requiredConfig,
      });
      if (result.ok || result.reason === 'already_active') {
        setBlocked(false);
        toast.success('Recorrido iniciado');
        return;
      }
      toast.error(result.message);
    } finally {
      setStarting(false);
    }
  };

  return { blocked, starting, startRequiredSession };
}
