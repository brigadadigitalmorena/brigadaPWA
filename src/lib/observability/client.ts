const REDACT_KEYS = ['password', 'token', 'authorization', 'secret', 'cookie'];

let started = false;
let distinctId = 'anonymous';

function redact(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = REDACT_KEYS.some((needle) => key.toLowerCase().includes(needle))
      ? '[redacted]'
      : redact(entry);
  }
  return output;
}

function parseSentryDsn(dsn: string): { key: string; store: string } | null {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!key || !projectId) return null;
    return {
      key,
      store: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function eventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendSentry(error: unknown, context?: Record<string, unknown>) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const target = parseSentryDsn(dsn);
  if (!target) return;
  const id = eventId();
  const message = error instanceof Error ? error.message : String(error);
  const header = JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn });
  const item = JSON.stringify({ type: 'event' });
  const payload = JSON.stringify({
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    message,
    user: { id: distinctId },
    extra: redact(context),
    exception:
      error instanceof Error
        ? {
            values: [{ type: error.name, value: error.message }],
          }
        : undefined,
  });
  await fetch(target.store, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=brigada-pwa/1.0`,
    },
    body: `${header}\n${item}\n${payload}`,
    keepalive: true,
  });
}

async function sendPostHog(
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  await fetch(`${host.replace(/\/$/, '')}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties: { ...properties, $lib: 'brigada-pwa' },
    }),
    keepalive: true,
  });
}

export async function initObservability(userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (userId) distinctId = userId;
  if (started) return;
  started = true;
  if (!userId) {
    const stored = localStorage.getItem('brigada_observability_id');
    distinctId = stored || eventId();
    localStorage.setItem('brigada_observability_id', distinctId);
  }
  void sendPostHog('$pageview', { path: window.location.pathname });
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  void sendSentry(error, context).catch(() => undefined);
}

export function captureEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  void sendPostHog(name, properties).catch(() => undefined);
}
