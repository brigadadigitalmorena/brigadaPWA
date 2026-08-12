import { readCachedSurveyVersion } from '@/lib/services/assignment-cache.service';
import { readDurableAssignments } from '@/lib/services/assignment-cache.service';
import { readCachedAssignment } from '@/lib/utils/survey-version';

/**
 * Warm the service-worker page cache for survey fill routes while online,
 * so offline navigation does not hit Chrome ERR_FAILED.
 */
export function warmSurveyFillUrls(
  surveys: { survey_id: number; survey_title: string }[]
): void {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (!('serviceWorker' in navigator)) return;

  const urls = surveys
    .filter((s) => s.survey_id != null)
    .map(
      (s) =>
        `/surveys/${s.survey_id}/fill?title=${encodeURIComponent(s.survey_title)}`
    );

  if (urls.length === 0) return;

  // Only warm via SW cache.put — do NOT inject <link rel="prefetch" as="document">.
  // Document prefetch of App Router pages can thrash navigations / look like infinite reload
  // when there are many assigned surveys (prod with data).
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
  if (readCachedAssignment(surveyId)?.latest_version) return true;

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable?.version) return true;

  const assignments = await readDurableAssignments();
  return assignments.some(
    (a) => a.survey_id === surveyId && Boolean(a.latest_version)
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
