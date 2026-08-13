import { db, Survey, kvGet, kvSet } from '@/lib/db/database';
import type { Assignment, SurveyVersion } from '@/lib/types';
import {
  ASSIGNMENTS_DURABLE_CACHE_KEY,
  ASSIGNMENTS_ALL_CACHE_KEY,
} from '@/lib/sync';
import {
  cacheAssignment as cacheAssignmentSession,
  normalizeSurveyVersion,
} from '@/lib/utils/survey-version';

const LIST_TTL_MS = 15 * 60 * 1000; // 15 minutes soft freshness

export interface CachedAssignmentSnapshot {
  assignments: Assignment[];
  cached_at: string;
}

/**
 * Persist assignments to Dexie surveys table + durable KV snapshot.
 */
export async function persistAssignments(assignments: Assignment[]): Promise<void> {
  const now = new Date().toISOString();

  for (const assignment of assignments) {
    const surveyId = String(assignment.survey_id);
    const version = assignment.latest_version
      ? normalizeSurveyVersion(assignment.latest_version)
      : null;

    const existing = await db.surveys.where('survey_id').equals(surveyId).first();
    const row: Survey = {
      id: existing?.id,
      survey_id: surveyId,
      version: version ? String(version.version_number) : existing?.version ?? '0',
      title: assignment.survey_title,
      description: existing?.description,
      category: existing?.category ?? 'field',
      schema_json: version ? JSON.stringify(version) : existing?.schema_json ?? '{}',
      engine_version: version?.engine_version ?? existing?.engine_version ?? 1,
      author: existing?.author ?? 'system',
      estimated_duration: existing?.estimated_duration ?? 0,
      tags: existing?.tags,
      is_active: assignment.assignment_status !== 'completed',
      is_published: true,
      sync_status: 'synced',
      last_synced_at: now,
      remote_updated_at: assignment.assigned_at,
      assignment_json: JSON.stringify(assignment),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await db.surveys.put(row);
    cacheAssignmentSession(assignment.survey_id, {
      survey_id: assignment.survey_id,
      survey_title: assignment.survey_title,
      latest_version: version ?? assignment.latest_version,
      field_tracking: assignment.field_tracking ?? null,
    });
  }

  const snapshot: CachedAssignmentSnapshot = {
    assignments,
    cached_at: now,
  };
  await kvSet(ASSIGNMENTS_DURABLE_CACHE_KEY, JSON.stringify(snapshot));
  await kvSet(ASSIGNMENTS_ALL_CACHE_KEY, JSON.stringify(snapshot));
}

export async function readDurableAssignments(): Promise<Assignment[]> {
  const raw = await kvGet(ASSIGNMENTS_DURABLE_CACHE_KEY);
  if (raw) {
    try {
      const snapshot = JSON.parse(raw) as CachedAssignmentSnapshot;
      if (Array.isArray(snapshot.assignments)) {
        return snapshot.assignments;
      }
    } catch {
      /* fall through */
    }
  }

  const rows = await db.surveys.toArray();
  const fromRows: Assignment[] = [];
  for (const row of rows) {
    if (!row.assignment_json) continue;
    try {
      fromRows.push(JSON.parse(row.assignment_json) as Assignment);
    } catch {
      /* skip */
    }
  }
  return fromRows;
}

export async function readCachedSurveyVersion(
  surveyId: number
): Promise<{ title: string; version: SurveyVersion } | null> {
  const row = await db.surveys.where('survey_id').equals(String(surveyId)).first();
  if (!row?.schema_json || row.schema_json === '{}') return null;

  try {
    const version = normalizeSurveyVersion(
      JSON.parse(row.schema_json) as SurveyVersion
    );
    return { title: row.title, version };
  } catch {
    return null;
  }
}

export async function isAssignmentCacheFresh(): Promise<boolean> {
  const raw = await kvGet(ASSIGNMENTS_DURABLE_CACHE_KEY);
  if (!raw) return false;
  try {
    const snapshot = JSON.parse(raw) as CachedAssignmentSnapshot;
    const age = Date.now() - new Date(snapshot.cached_at).getTime();
    return Number.isFinite(age) && age < LIST_TTL_MS;
  } catch {
    return false;
  }
}
