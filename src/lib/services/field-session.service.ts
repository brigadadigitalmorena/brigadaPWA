/**
 * FIELD-TRACK-1 — brigadista route sessions in the browser.
 *
 * Best-effort by design. A web page cannot register a background location
 * task, so capture only happens while the tab is alive: we hold a screen Wake
 * Lock to keep it that way, and when the tab is hidden anyway we write an
 * explicit `hidden` marker so the CMS draws a gap instead of a straight line
 * across a stretch nobody recorded.
 */
import {
  db,
  type FieldSession,
  type FieldSessionSample,
} from '@/lib/db/database';
import {
  DEFAULT_FIELD_TRACKING,
  type FieldTrackingConfig,
} from '@/lib/api/field-session.service';
import { SYNC_PRIORITY } from '@/lib/sync';

const EARTH_RADIUS_M = 6_371_000;
/** Ignore jumps this large: one bad fix must not invent kilometres. */
const MAX_STEP_M = 5000;

export type FieldSessionEndReason =
  | 'manual'
  | 'idle_timeout'
  | 'max_duration'
  | 'logout';

export interface FieldSessionSnapshot {
  session: FieldSession | null;
  pendingSamples: number;
  isCollecting: boolean;
  wakeLockHeld: boolean;
}

export type StartSessionResult =
  | { ok: true; session: FieldSession; degradedReason: string | null }
  | {
      ok: false;
      reason: 'already_active' | 'unsupported' | 'permission_denied' | 'error';
      message: string;
    };

type Listener = (snapshot: FieldSessionSnapshot) => void;

interface WakeLockLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function parseConfig(raw: string): FieldTrackingConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<FieldTrackingConfig>;
    return {
      ...DEFAULT_FIELD_TRACKING,
      ...parsed,
      gps: { ...DEFAULT_FIELD_TRACKING.gps, ...(parsed.gps ?? {}) },
      photo: { ...DEFAULT_FIELD_TRACKING.photo, ...(parsed.photo ?? {}) },
      session: { ...DEFAULT_FIELD_TRACKING.session, ...(parsed.session ?? {}) },
    };
  } catch {
    return DEFAULT_FIELD_TRACKING;
  }
}

class FieldSessionService {
  private listeners = new Set<Listener>();
  private watchId: number | null = null;
  private wakeLock: WakeLockLike | null = null;
  private limitsTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityBound = false;
  /**
   * `watchPosition` fires as fast as the device can produce fixes; we only
   * keep one every `interval_s` to stay within the configured sampling rate.
   */
  private lastAcceptedAt = 0;

  // ── Observation ─────────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    void this.getSnapshot().then(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getSnapshot(): Promise<FieldSessionSnapshot> {
    const session = await this.getActiveSession();
    const pendingSamples = session
      ? await db.field_session_samples
          .where('[session_client_id+upload_status]')
          .equals([session.client_id, 'pending'])
          .count()
      : 0;

    return {
      session,
      pendingSamples,
      isCollecting: this.watchId !== null,
      wakeLockHeld: Boolean(this.wakeLock && !this.wakeLock.released),
    };
  }

  private async notify(): Promise<void> {
    if (this.listeners.size === 0) return;
    const snapshot = await this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async getActiveSession(): Promise<FieldSession | null> {
    const rows = await db.field_sessions
      .where('status')
      .equals('active')
      .toArray();
    if (rows.length === 0) return null;
    rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
    return rows[0];
  }

  async getActiveSessionClientId(): Promise<string | null> {
    const session = await this.getActiveSession();
    return session?.client_id ?? null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async startSession(params?: {
    activityType?: string;
    surveyId?: number | null;
    assignmentId?: number | null;
    config?: FieldTrackingConfig;
  }): Promise<StartSessionResult> {
    if (await this.getActiveSession()) {
      return {
        ok: false,
        reason: 'already_active',
        message: 'Ya tienes un recorrido en curso.',
      };
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'Este navegador no permite registrar la ubicación.',
      };
    }

    const config = params?.config ?? DEFAULT_FIELD_TRACKING;
    const now = new Date().toISOString();
    const clientId = crypto.randomUUID();

    const session: FieldSession = {
      client_id: clientId,
      activity_type: params?.activityType ?? config.activity_type,
      survey_id: params?.surveyId ?? null,
      assignment_id: params?.assignmentId ?? null,
      status: 'active',
      started_at: now,
      config_json: JSON.stringify(config),
      next_seq: 0,
      sample_count: 0,
      distance_m: 0,
      created_at: now,
      updated_at: now,
    };

    await db.field_sessions.put(session);

    try {
      await this.startWatch(config);
    } catch (error) {
      await db.field_sessions.delete(clientId);
      return {
        ok: false,
        reason: error instanceof Error && /denied/i.test(error.message)
          ? 'permission_denied'
          : 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar la captura de ubicación.',
      };
    }

    await this.requestWakeLock();
    this.bindVisibility();
    this.startLimitsWatchdog();
    await this.queueSessionUpsert(clientId);
    await this.notify();

    return { ok: true, session, degradedReason: null };
  }

  async endSession(reason: FieldSessionEndReason = 'manual'): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) return;

    this.stopWatch();
    await this.releaseWakeLock();

    const now = new Date().toISOString();
    await db.field_sessions.update(session.client_id, {
      status: 'completed',
      end_reason: reason,
      ended_at: now,
      updated_at: now,
    });

    await this.queueSessionUpsert(session.client_id);
    await this.queueSampleUpload(session.client_id);
    await this.notify();
  }

  /**
   * Re-attach after a reload. The tab was gone, so anything between the last
   * sample and now is a gap — recorded as such before capture resumes.
   */
  async resumeOnLoad(): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) return;

    const config = parseConfig(session.config_json);
    const startedAt = new Date(session.started_at).getTime();

    if (
      Number.isFinite(startedAt) &&
      Date.now() - startedAt > config.session.max_duration_min * 60_000
    ) {
      await db.field_sessions.update(session.client_id, {
        status: 'completed',
        end_reason: 'max_duration',
        ended_at: new Date(
          startedAt + config.session.max_duration_min * 60_000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      });
      await this.queueSessionUpsert(session.client_id);
      await this.queueSampleUpload(session.client_id);
      await this.notify();
      return;
    }

    await this.recordGapMarker(session.client_id, 'hidden');

    try {
      await this.startWatch(config);
      await this.requestWakeLock();
      this.bindVisibility();
      this.startLimitsWatchdog();
    } catch {
      await this.markDegraded(session.client_id, 'permission_denied');
    }

    await this.queueSessionUpsert(session.client_id);
    await this.queueSampleUpload(session.client_id);
    await this.notify();
  }

  // ── Geolocation ─────────────────────────────────────────────────────────

  private startWatch(config: FieldTrackingConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.watchId !== null) {
        resolve();
        return;
      }

      let settled = false;
      this.lastAcceptedAt = 0;

      const id = navigator.geolocation.watchPosition(
        (position) => {
          if (!settled) {
            settled = true;
            resolve();
          }
          void this.handlePosition(position, config);
        },
        (error) => {
          if (!settled) {
            settled = true;
            this.watchId = null;
            navigator.geolocation.clearWatch(id);
            if (this.pollTimer) {
              clearInterval(this.pollTimer);
              this.pollTimer = null;
            }
            reject(
              new Error(
                error.code === error.PERMISSION_DENIED
                  ? 'Permiso de ubicación denegado.'
                  : 'No se pudo obtener la ubicación.'
              )
            );
            return;
          }
          // Transient failures mid-session are expected indoors; the next fix
          // resolves them and the gap shows up in the track.
        },
        {
          enableHighAccuracy: config.gps.desired_accuracy !== 'low',
          maximumAge: 0,
          timeout: 30_000,
        }
      );

      this.watchId = id;
      this.startPoll(config);
    });
  }

  /**
   * `watchPosition` only emits when the position *changes*, so a brigadista
   * standing still produces a single fix and the track flatlines. This ticker
   * asks for a fix every `interval_s` so the sampling rate is the configured
   * one regardless of movement; the interval gate in `handlePosition` still
   * dedupes it against fixes the watch delivers on its own.
   */
  private startPoll(config: FieldTrackingConfig): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => void this.handlePosition(position, config),
        () => {
          // Missing a tick is a coverage gap, not an error worth surfacing.
        },
        {
          enableHighAccuracy: config.gps.desired_accuracy !== 'low',
          maximumAge: 0,
          timeout: 30_000,
        }
      );
    }, config.gps.interval_s * 1000);
  }

  private stopWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.limitsTimer) {
      clearInterval(this.limitsTimer);
      this.limitsTimer = null;
    }
  }

  private async handlePosition(
    position: GeolocationPosition,
    config: FieldTrackingConfig
  ): Promise<void> {
    const accuracy = position.coords.accuracy ?? null;
    const nowTs = Date.now();
    const rejectedByAccuracy =
      accuracy != null && accuracy > config.gps.max_accuracy_m;
    const elapsedSinceAccepted = nowTs - this.lastAcceptedAt;
    const rejectedByInterval =
      !rejectedByAccuracy && elapsedSinceAccepted < config.gps.interval_s * 1000;
    // #region agent log
    fetch('http://127.0.0.1:7488/ingest/6a401daf-517a-44f2-8fde-9ecb47762753',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1a6513'},body:JSON.stringify({sessionId:'1a6513',runId:'post-fix',hypothesisId:'H1',location:'field-session.service.ts:handlePosition',message:'watchPosition fix received',data:{accuracy,max_accuracy_m:config.gps.max_accuracy_m,interval_s:config.gps.interval_s,elapsedSinceAccepted,lastAcceptedAt:this.lastAcceptedAt,rejectedByAccuracy,rejectedByInterval,visibility:typeof document!=='undefined'?document.visibilityState:'n/a'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (rejectedByAccuracy) return;
    if (rejectedByInterval) return;
    const now = nowTs;
    this.lastAcceptedAt = now;

    const session = await this.getActiveSession();
    if (!session) {
      this.stopWatch();
      return;
    }

    const isHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';

    await this.appendSample(session, {
      sample_type: 'gps',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: accuracy ?? undefined,
      altitude_m: position.coords.altitude ?? undefined,
      speed_mps: position.coords.speed ?? undefined,
      heading_deg: position.coords.heading ?? undefined,
      recorded_at: new Date(position.timestamp).toISOString(),
      provider: 'browser',
      app_state: isHidden ? 'hidden' : 'foreground',
    });

    await this.queueSampleUpload(session.client_id);
    await this.notify();
  }

  /**
   * Persist one sample and fold it into the session totals.
   *
   * `next_seq` lives on the session row and is bumped here, which is what
   * makes the sequence a safe idempotency key even across reloads.
   */
  private async appendSample(
    session: FieldSession,
    sample: Omit<
      FieldSessionSample,
      'id' | 'session_client_id' | 'sample_seq' | 'upload_status' | 'created_at'
    >
  ): Promise<void> {
    const seq = session.next_seq;
    const now = new Date().toISOString();

    await db.field_session_samples.add({
      ...sample,
      session_client_id: session.client_id,
      sample_seq: seq,
      upload_status: 'pending',
      created_at: now,
    });

    let addedDistance = 0;
    if (
      sample.latitude != null &&
      sample.longitude != null &&
      session.last_lat != null &&
      session.last_lng != null
    ) {
      const step = haversineM(
        session.last_lat,
        session.last_lng,
        sample.latitude,
        sample.longitude
      );
      if (step <= MAX_STEP_M) addedDistance = step;
    }

    await db.field_sessions.update(session.client_id, {
      next_seq: seq + 1,
      sample_count: session.sample_count + 1,
      distance_m: session.distance_m + addedDistance,
      last_lat: sample.latitude ?? session.last_lat,
      last_lng: sample.longitude ?? session.last_lng,
      last_sample_at: sample.recorded_at,
      updated_at: now,
    });
    // #region agent log
    try{const all=await db.field_session_samples.where('session_client_id').equals(session.client_id).toArray();fetch('http://127.0.0.1:7488/ingest/6a401daf-517a-44f2-8fde-9ecb47762753',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1a6513'},body:JSON.stringify({sessionId:'1a6513',runId:'post-fix',hypothesisId:'H2',location:'field-session.service.ts:appendSample',message:'sample stored',data:{seq,sample_type:sample.sample_type,hasCoords:sample.latitude!=null&&sample.longitude!=null,app_state:sample.app_state,totalStored:all.length,byType:all.reduce((acc:Record<string,number>,s)=>{acc[s.sample_type]=(acc[s.sample_type]||0)+1;return acc;},{}),pending:all.filter((s)=>s.upload_status==='pending').length},timestamp:Date.now()})}).catch(()=>{});}catch{}
    // #endregion
  }

  /**
   * Write a zero-position marker so the CMS can tell "we stopped looking"
   * apart from "the brigadista stood still".
   */
  private async recordGapMarker(
    clientId: string,
    state: 'hidden'
  ): Promise<void> {
    const session = await db.field_sessions.get(clientId);
    if (!session || session.status !== 'active') return;

    await this.appendSample(session, {
      // Not a `gps` sample: it carries no position, and the API rejects a GPS
      // fix without coordinates.
      sample_type: 'gap',
      recorded_at: new Date().toISOString(),
      provider: 'browser',
      app_state: state,
      payload_json: JSON.stringify({ marker: 'coverage_gap' }),
    });
    await this.markDegraded(clientId, 'tab_hidden');
  }

  private async markDegraded(clientId: string, reason: string): Promise<void> {
    const session = await db.field_sessions.get(clientId);
    if (!session || session.degraded_reason) return;
    await db.field_sessions.update(clientId, {
      degraded_reason: reason,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Wake Lock & visibility ──────────────────────────────────────────────

  private async requestWakeLock(): Promise<void> {
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> };
      }
    ).wakeLock;
    if (!wakeLock) return;

    try {
      this.wakeLock = await wakeLock.request('screen');
      // The browser drops the lock whenever the tab loses visibility; the
      // visibilitychange handler re-requests it on the way back.
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch {
      // Wake Lock is a nicety, not a requirement.
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (!this.wakeLock) return;
    try {
      await this.wakeLock.release();
    } catch {
      // Already released.
    }
    this.wakeLock = null;
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      void (async () => {
        const session = await this.getActiveSession();
        if (!session) return;

        if (document.visibilityState === 'hidden') {
          await this.recordGapMarker(session.client_id, 'hidden');
          return;
        }

        await this.requestWakeLock();
        await this.notify();
      })();
    });
  }

  // ── Limits ──────────────────────────────────────────────────────────────

  private startLimitsWatchdog(): void {
    if (this.limitsTimer) return;
    this.limitsTimer = setInterval(() => {
      void this.enforceLimits();
    }, 60_000);
  }

  private async enforceLimits(): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) {
      if (this.limitsTimer) {
        clearInterval(this.limitsTimer);
        this.limitsTimer = null;
      }
      return;
    }

    const config = parseConfig(session.config_json);
    const now = Date.now();
    const startedAt = new Date(session.started_at).getTime();

    if (
      Number.isFinite(startedAt) &&
      now - startedAt > config.session.max_duration_min * 60_000
    ) {
      await this.endSession('max_duration');
      return;
    }

    const lastActivity = session.last_sample_at
      ? new Date(session.last_sample_at).getTime()
      : startedAt;
    if (
      Number.isFinite(lastActivity) &&
      now - lastActivity > config.session.idle_timeout_min * 60_000
    ) {
      await this.endSession('idle_timeout');
    }
  }

  // ── Sync queue ──────────────────────────────────────────────────────────

  async queueSessionUpsert(clientId: string): Promise<void> {
    const session = await db.field_sessions.get(clientId);
    if (!session) return;

    await this.enqueue(
      'UPSERT_FIELD_SESSION',
      clientId,
      {
        client_id: session.client_id,
        activity_type: session.activity_type,
        survey_id: session.survey_id,
        assignment_id: session.assignment_id,
        started_at: session.started_at,
        config_snapshot: parseConfig(session.config_json),
        source: 'pwa',
        degraded_reason: session.degraded_reason ?? null,
        device_info: {
          platform: 'web',
          user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        },
      },
      SYNC_PRIORITY.GESTION_COMMENT
    );
  }

  async queueSampleUpload(clientId: string): Promise<void> {
    const pending = await db.field_session_samples
      .where('[session_client_id+upload_status]')
      .equals([clientId, 'pending'])
      .count();
    if (pending === 0) return;

    await this.enqueue(
      'UPLOAD_FIELD_SESSION_SAMPLES',
      clientId,
      { client_id: clientId },
      SYNC_PRIORITY.DEFAULT
    );
  }

  /**
   * One live queue row per (operation, session). Route operations are
   * "drain whatever is pending now", so re-enqueueing must refresh the
   * existing row instead of piling up duplicates.
   */
  private async enqueue(
    operationType: string,
    entityId: string,
    payload: Record<string, unknown>,
    priority: number
  ): Promise<void> {
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);

    const existing = await db.sync_queue
      .filter(
        (item) =>
          item.operation_type === operationType &&
          item.entity_id === entityId &&
          ['pending', 'leased', 'retry_wait', 'completed'].includes(item.status)
      )
      .first();

    if (existing?.id !== undefined) {
      await db.sync_queue.update(existing.id, {
        payload_json: payloadJson,
        status: 'pending',
        retry_count: 0,
        next_retry_at: now,
        last_error: undefined,
        last_error_code: undefined,
        lease_owner: undefined,
        lease_until: undefined,
        completed_at: undefined,
        updated_at: now,
      });
      return;
    }

    await db.sync_queue.add({
      queue_id: crypto.randomUUID(),
      operation_type: operationType,
      entity_type: 'field_session',
      entity_id: entityId,
      payload_json: payloadJson,
      status: 'pending',
      priority,
      retry_count: 0,
      max_retries: 12,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
    });
  }
}

export const fieldSessionService = new FieldSessionService();
