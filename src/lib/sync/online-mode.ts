/**
 * Online fast-path circuit breaker.
 * After FAILURE_THRESHOLD consecutive network failures, force two-phase
 * (local commit + queue) for OPEN_DURATION_MS.
 */

export const CIRCUIT_STATES = {
  CLOSED: 'closed',
  OPEN: 'open',
} as const;

export type CircuitState = (typeof CIRCUIT_STATES)[keyof typeof CIRCUIT_STATES];
export type SubmitOutcome = 'success' | 'network_failure' | 'non_network_error';

const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 5 * 60 * 1000;

export type KvAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

const KV_KEY = 'sync.online_mode.open_until_at';

let consecutiveFailures = 0;
let openUntilMs: number | null = null;
let kvHydrated = false;
let kvAdapter: KvAdapter | null = null;

export function configureOnlineModeKv(adapter: KvAdapter | null): void {
  kvAdapter = adapter;
  kvHydrated = false;
}

async function hydrateFromKv(): Promise<void> {
  if (kvHydrated) return;
  kvHydrated = true;
  if (!kvAdapter) return;
  try {
    const raw = await kvAdapter.get(KV_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Number.isFinite(ts) && ts > Date.now()) {
        openUntilMs = ts;
      }
    }
  } catch {
    /* soft hint */
  }
}

async function persistOpenUntil(value: number | null): Promise<void> {
  if (!kvAdapter) return;
  try {
    if (value === null) {
      await kvAdapter.remove(KV_KEY);
    } else {
      await kvAdapter.set(KV_KEY, String(value));
    }
  } catch {
    /* soft hint */
  }
}

export async function shouldUseTwoPhase(): Promise<boolean> {
  await hydrateFromKv();
  if (openUntilMs === null) return false;
  if (Date.now() >= openUntilMs) {
    openUntilMs = null;
    consecutiveFailures = 0;
    persistOpenUntil(null).catch(() => {});
    return false;
  }
  return true;
}

export function recordSubmitOutcome(outcome: SubmitOutcome): void {
  if (outcome === 'success') {
    consecutiveFailures = 0;
    openUntilMs = null;
    persistOpenUntil(null).catch(() => {});
    return;
  }

  if (outcome === 'non_network_error') return;

  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD && openUntilMs === null) {
    openUntilMs = Date.now() + OPEN_DURATION_MS;
    persistOpenUntil(openUntilMs).catch(() => {});
  }
}

export function classifySubmitError(error: unknown): SubmitOutcome {
  if (!error) return 'non_network_error';
  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number };
  };
  const status = err.response?.status;
  if (typeof status === 'number') {
    if (status >= 500) return 'network_failure';
    return 'non_network_error';
  }
  const msg = (err.message ?? '').toLowerCase();
  if (
    err.code === 'ECONNABORTED' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  ) {
    return 'network_failure';
  }
  return 'non_network_error';
}

export function _getCircuitSnapshot(): {
  state: CircuitState;
  consecutiveFailures: number;
  openUntilMs: number | null;
} {
  return {
    state:
      openUntilMs && Date.now() < openUntilMs
        ? CIRCUIT_STATES.OPEN
        : CIRCUIT_STATES.CLOSED,
    consecutiveFailures,
    openUntilMs,
  };
}

/** Test helper */
export function _resetCircuitForTests(): void {
  consecutiveFailures = 0;
  openUntilMs = null;
  kvHydrated = false;
}
