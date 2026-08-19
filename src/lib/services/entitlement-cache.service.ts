import { db, Survey, kvGet, kvSet, kvRemove } from '@/lib/db/database';
import type { Assignment, SurveyVersion } from '@/lib/types';
import {
  ENTITLEMENTS_DURABLE_CACHE_KEY,
  ENTITLEMENTS_ALL_CACHE_KEY,
  migrateEntitlementCacheKeys,
} from '@/lib/sync/entitlement-cache-policy';
import {
  cacheEntitlement as cacheEntitlementSession,
  normalizeSurveyVersion,
} from '@/lib/utils/survey-version';

const LIST_TTL_MS = 15 * 60 * 1000; // 15 minutes soft freshness

let migrationDone = false;

export interface CachedEntitlementSnapshot {
  entitlements: Assignment[];
  cached_at: string;
}

async function ensureEntitlementCacheMigrated(): Promise<void> {
  if (migrationDone) return;
  await migrateEntitlementCacheKeys({
    getItem: kvGet,
    setItem: (key, value) => kvSet(key, value),
    removeItem: kvRemove,
  });
  migrationDone = true;
}

/**
 * Persist entitlements to Dexie surveys table + durable KV snapshot.
 */
export async function persistEntitlements(
  entitlements: Assignment[],
): Promise<void> {
  await ensureEntitlementCacheMigrated();
  const now = new Date().toISOString();

  for (const entitlement of entitlements) {
    const surveyId = String(entitlement.survey_id);
    const version = entitlement.latest_version
      ? normalizeSurveyVersion(entitlement.latest_version)
      : null;

    const existing = await db.surveys.where('survey_id').equals(surveyId).first();
    const row: Survey = {
      id: existing?.id,
      survey_id: surveyId,
      version: version ? String(version.version_number) : existing?.version ?? '0',
      title: entitlement.survey_title,
      description: existing?.description,
      category: existing?.category ?? 'field',
      schema_json: version ? JSON.stringify(version) : existing?.schema_json ?? '{}',
      engine_version: version?.engine_version ?? existing?.engine_version ?? 1,
      author: existing?.author ?? 'system',
      estimated_duration: existing?.estimated_duration ?? 0,
      tags: existing?.tags,
      is_active: entitlement.entitlement_status !== 'completed',
      is_published: true,
      sync_status: 'synced',
      last_synced_at: now,
      remote_updated_at: entitlement.assigned_at,
      entitlement_json: JSON.stringify(entitlement),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await db.surveys.put(row);
    cacheEntitlementSession(entitlement.survey_id, {
      survey_id: entitlement.survey_id,
      survey_title: entitlement.survey_title,
      survey_type: entitlement.survey_type,
      latest_version: version ?? entitlement.latest_version,
      campaign_id: entitlement.campaign_id,
      entitlement_id: entitlement.entitlement_id,
      geo_enforcement: entitlement.geo_enforcement,
      area_names: entitlement.area_names,
      field_tracking: entitlement.field_tracking ?? null,
    });
  }

  const snapshot: CachedEntitlementSnapshot = {
    entitlements,
    cached_at: now,
  };
  const serialized = JSON.stringify(snapshot);
  await kvSet(ENTITLEMENTS_DURABLE_CACHE_KEY, serialized);
  await kvSet(ENTITLEMENTS_ALL_CACHE_KEY, serialized);
}

async function parseEntitlementSnapshot(
  raw: string | null,
): Promise<Assignment[] | null> {
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as CachedEntitlementSnapshot & {
      assignments?: Assignment[];
    };
    if (Array.isArray(snapshot.entitlements)) {
      return snapshot.entitlements;
    }
    if (Array.isArray(snapshot.assignments)) {
      return snapshot.assignments;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function readDurableEntitlements(): Promise<Assignment[]> {
  await ensureEntitlementCacheMigrated();

  const fromKv = await parseEntitlementSnapshot(
    await kvGet(ENTITLEMENTS_DURABLE_CACHE_KEY),
  );
  if (fromKv) return fromKv;

  const rows = await db.surveys.toArray();
  const fromRows: Assignment[] = [];
  for (const row of rows) {
    const raw = row.entitlement_json ?? row.assignment_json;
    if (!raw) continue;
    try {
      fromRows.push(JSON.parse(raw) as Assignment);
    } catch {
      /* skip */
    }
  }
  return fromRows;
}

export async function readCachedSurveyVersion(
  surveyId: number,
): Promise<{ title: string; version: SurveyVersion } | null> {
  const row = await db.surveys.where('survey_id').equals(String(surveyId)).first();
  if (!row?.schema_json || row.schema_json === '{}') return null;

  try {
    const version = normalizeSurveyVersion(
      JSON.parse(row.schema_json) as SurveyVersion,
    );
    return { title: row.title, version };
  } catch {
    return null;
  }
}

export async function isEntitlementCacheFresh(): Promise<boolean> {
  await ensureEntitlementCacheMigrated();
  const raw = await kvGet(ENTITLEMENTS_DURABLE_CACHE_KEY);
  if (!raw) return false;
  try {
    const snapshot = JSON.parse(raw) as CachedEntitlementSnapshot;
    const age = Date.now() - new Date(snapshot.cached_at).getTime();
    return Number.isFinite(age) && age < LIST_TTL_MS;
  } catch {
    return false;
  }
}

export async function runEntitlementCacheMigration(): Promise<void> {
  await ensureEntitlementCacheMigrated();
}
