import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countCompletedToday,
  mergeDailyCounts,
  mexicoDayKey,
} from '../src/lib/metrics/daily-metrics';
import {
  mapStatusColor,
  toResponseMapPoints,
} from '../src/lib/maps/response-points';
import {
  appendTrackSample,
  barcodePattern,
  emptyTrack,
  matchesBarcodePattern,
  maxDurationSeconds,
  strokeCountAllowed,
} from '../src/lib/forms/field-rules';
import { buildResponseTimeline } from '../src/lib/events/response-timeline';
import {
  countPendingConfirms,
  hasSchemaMismatch,
  isLowStorage,
} from '../src/lib/storage/field-alerts';

test('mexico day key and completed-today ignore unsynced rows', () => {
  const now = new Date('2026-10-07T18:00:00.000Z');
  assert.match(mexicoDayKey(now), /^\d{4}-\d{2}-\d{2}$/);
  const today = mexicoDayKey(now);
  const count = countCompletedToday(
    [
      { sync_status: 'synced', completed_at: now.toISOString() },
      { sync_status: 'pending', completed_at: now.toISOString() },
      { sync_status: 'synced', completed_at: '2020-01-01T00:00:00.000Z' },
    ],
    now
  );
  assert.equal(today.length, 10);
  assert.equal(count, 1);
});

test('daily metrics take the larger local or remote count', () => {
  assert.deepEqual(
    mergeDailyCounts({
      localCompleted: 2,
      localPending: 1,
      remote: { completed_today: 4, pending_sync: 0, unread_comments: 3 },
    }),
    { completed: 4, pending: 1, comments: 3 }
  );
});

test('map points drop drafts and invalid coordinates', () => {
  const points = toResponseMapPoints([
    {
      response_id: 'ok',
      survey_id: '9',
      latitude: 19.4,
      longitude: -99.1,
      sync_status: 'synced',
      status: 'completed',
    },
    {
      response_id: 'draft',
      survey_id: '9',
      latitude: 19.4,
      longitude: -99.1,
      sync_status: 'pending',
      status: 'draft',
    },
    {
      response_id: 'bad',
      survey_id: '9',
      latitude: 120,
      longitude: -99.1,
      sync_status: 'error',
      status: 'completed',
    },
  ]);
  assert.equal(points.length, 1);
  assert.equal(mapStatusColor(points[0].syncStatus), '#16a34a');
  assert.equal(mapStatusColor('error'), '#dc2626');
});

test('barcode pattern rejects mismatches and ignores invalid regex', () => {
  assert.equal(barcodePattern({ pattern: '^INE[0-9]+$' }), '^INE[0-9]+$');
  assert.equal(matchesBarcodePattern('INE12', '^INE[0-9]+$'), true);
  assert.equal(matchesBarcodePattern('ABC', '^INE[0-9]+$'), false);
  assert.equal(matchesBarcodePattern('ABC', '('), true);
});

test('media and signature limits come from validation rules', () => {
  assert.equal(maxDurationSeconds({ max_duration_s: 15 }), 15);
  assert.equal(maxDurationSeconds({ max_duration_s: 0 }), undefined);
  assert.equal(strokeCountAllowed(1, { min: 2, max: 0 }), 'La firma necesita al menos 2 trazos.');
  assert.match(strokeCountAllowed(4, { min: 1, max: 3 }) ?? '', /máximo 3/);
  assert.equal(strokeCountAllowed(2, { min: 1, max: 3 }), null);
});

test('gps track ignores samples closer than the minimum distance', () => {
  const first = appendTrackSample(emptyTrack(), [-99.1332, 19.4326], 't1', 5);
  const near = appendTrackSample(first, [-99.13321, 19.43261], 't2', 50);
  const far = appendTrackSample(first, [-99.14, 19.44], 't3', 5);
  assert.equal(near.coordinates.length, 1);
  assert.equal(far.coordinates.length, 2);
  assert.equal(far.timestamps[1], 't3');
});

test('response timeline orders capture and sync events', () => {
  const events = buildResponseTimeline(
    {
      created_at: '2026-10-07T10:00:00.000Z',
      completed_at: '2026-10-07T10:05:00.000Z',
      updated_at: '2026-10-07T10:06:00.000Z',
      sync_status: 'error',
      sync_error: 'timeout',
    },
    [
      {
        operation_type: 'CREATE_RESPONSE',
        status: 'dead_letter',
        created_at: '2026-10-07T10:05:30.000Z',
        last_error: 'schema',
        last_error_code: 'schema_mismatch',
      },
    ]
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ['draft_created', 'response_submitted', 'sync_enqueued', 'sync_failed', 'sync_failed']
  );
});

test('storage alerts flag schema mismatch, pending confirm, and low quota', () => {
  assert.equal(
    hasSchemaMismatch([{ last_error_code: 'schema_mismatch', status: 'dead_letter' }]),
    true
  );
  assert.equal(
    hasSchemaMismatch([{ last_error_code: 'schema_mismatch', status: 'discarded' }]),
    false
  );
  assert.equal(
    countPendingConfirms([
      { operation_type: 'CONFIRM_DOCUMENT', status: 'pending' },
      { operation_type: 'CREATE_RESPONSE', status: 'pending' },
    ]),
    1
  );
  const mb = 1024 * 1024;
  assert.equal(isLowStorage(95 * mb, 100 * mb), true);
  assert.equal(isLowStorage(10 * mb, 100 * mb), false);
});
