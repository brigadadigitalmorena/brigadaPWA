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

  // Next client prefetch (in-memory + HTTP cache)
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'document';
    document.head.appendChild(link);
  });

  // SW Cache Storage warm (survives offline)
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({ type: 'WARM_URLS', urls });
    })
    .catch(() => {
      /* SW not ready */
    });
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
