import { readCachedSurveyVersion, readDurableEntitlements } from '@/lib/services/entitlement-cache.service';
import { readCachedEntitlement } from '@/lib/utils/survey-version';
import { surveyFillHref } from '@/lib/campaigns/scope';
import type { Assignment } from '@/lib/types';

/**
 * Warm the service-worker page cache for survey fill routes while online,
 * so offline navigation does not hit Chrome ERR_FAILED.
 */
export function warmSurveyFillUrls(surveys: Assignment[]): void {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (!('serviceWorker' in navigator)) return;

  const urls = surveys
    .filter((survey) => survey.survey_id != null && survey.entitlement_id != null)
    .map((survey) => surveyFillHref(survey));

  if (urls.length === 0) return;

  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({ type: 'WARM_URLS', urls });
    })
    .catch(() => {
      /* SW not ready */
    });
}

/**
 * Offline open is gated by survey *schema* in Dexie/session, not by having
 * visited that exact fill URL. Drafts on one survey must not block others.
 */
export async function canOpenSurveyOffline(surveyId: number): Promise<boolean> {
  if (readCachedEntitlement(surveyId)?.latest_version) return true;

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable?.version) return true;

  const entitlements = await readDurableEntitlements();
  return entitlements.some(
    (row) => row.survey_id === surveyId && Boolean(row.latest_version),
  );
}

export async function isUrlCachedOffline(url: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const match =
      (await caches.match(url)) ||
      (await caches.match(url, { ignoreSearch: true }));
    return Boolean(match);
  } catch {
    return false;
  }
}
