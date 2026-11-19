import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FieldSession } from '../src/lib/db/database';
import {
  formatDistance,
  matchesRecorridoQuery,
} from '../src/lib/recorrido/session-search';

function session(overrides: Partial<FieldSession> = {}): FieldSession {
  return {
    client_id: 'sess-abc-123',
    server_id: 42,
    activity_type: 'encuesta',
    status: 'completed',
    started_at: '2026-11-19T18:05:00.000Z',
    ended_at: '2026-11-19T19:10:00.000Z',
    config_json: '{}',
    next_seq: 12,
    sample_count: 12,
    distance_m: 1540,
    created_at: '2026-11-19T18:05:00.000Z',
    updated_at: '2026-11-19T19:10:00.000Z',
    ...overrides,
  };
}

describe('matchesRecorridoQuery', () => {
  it('matches every session when the query is empty', () => {
    assert.equal(matchesRecorridoQuery(session(), ''), true);
    assert.equal(matchesRecorridoQuery(session(), '   '), true);
  });

  it('matches date, status and sync labels ignoring accents', () => {
    const row = session();
    assert.equal(matchesRecorridoQuery(row, 'finalizado'), true);
    assert.equal(matchesRecorridoQuery(row, 'SINCRONIZADO'), true);
    assert.equal(matchesRecorridoQuery(row, '19 nov'), true);
  });

  it('matches local sessions and rejects unrelated text', () => {
    const local = session({ server_id: undefined, status: 'active' });
    assert.equal(matchesRecorridoQuery(local, 'local'), true);
    assert.equal(matchesRecorridoQuery(local, 'activo'), true);
    assert.equal(matchesRecorridoQuery(local, 'inexistente'), false);
  });

  it('formats distances for the search haystack', () => {
    assert.equal(formatDistance(540), '540 m');
    assert.equal(formatDistance(1540), '1.54 km');
    assert.equal(matchesRecorridoQuery(session(), '1.54 km'), true);
  });
});
