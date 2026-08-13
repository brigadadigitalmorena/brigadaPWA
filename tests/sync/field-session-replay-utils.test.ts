import assert from 'node:assert/strict';
import test from 'node:test';

import type { FieldSessionSample } from '../../src/lib/db/database';
import {
  classifySampleReadiness,
  FIELD_SAMPLE_BATCH_SIZE,
  MAX_SAMPLE_BATCHES_PER_RUN,
  operationRank,
  parseSessionConfig,
  toSampleUpload,
} from '../../src/lib/sync/field-session-replay-utils';

function sampleRow(overrides: Partial<FieldSessionSample> = {}): FieldSessionSample {
  return {
    id: 1,
    session_client_id: 'session-a',
    sample_seq: 0,
    sample_type: 'gps',
    latitude: 19.4326,
    longitude: -99.1332,
    accuracy_m: 18,
    recorded_at: '2026-08-12T15:00:00.000Z',
    provider: 'gps',
    app_state: 'foreground',
    is_mocked: false,
    upload_status: 'pending',
    created_at: '2026-08-12T15:00:00.000Z',
    ...overrides,
  };
}

test('the session upsert is always attempted before its samples', () => {
  assert.ok(
    operationRank('UPSERT_FIELD_SESSION') < operationRank('UPLOAD_FIELD_SESSION_SAMPLES')
  );
});

test('route traffic never outranks survey responses or their files', () => {
  assert.ok(operationRank('CREATE_RESPONSE') < operationRank('UPSERT_FIELD_SESSION'));
  assert.ok(operationRank('UPLOAD_FILE') < operationRank('UPSERT_FIELD_SESSION'));
  assert.ok(operationRank('CONFIRM_DOCUMENT') < operationRank('UPSERT_FIELD_SESSION'));
});

test('an unknown operation sinks to the bottom of the queue', () => {
  assert.equal(operationRank('SOMETHING_NEW'), 9);
});

test('samples wait for the session upsert before they are uploaded', () => {
  assert.equal(classifySampleReadiness(undefined), 'session_missing');
  assert.equal(classifySampleReadiness(null), 'session_missing');
  assert.equal(classifySampleReadiness({ server_id: undefined }), 'not_synced');
  assert.equal(classifySampleReadiness({ server_id: 42 }), 'ready');
});

test('a corrupt session config does not block the upsert', () => {
  assert.deepEqual(parseSessionConfig('{not json'), {});
  assert.deepEqual(parseSessionConfig(undefined), {});
  assert.deepEqual(parseSessionConfig('[1,2]'), {});
});

test('a valid session config is passed through untouched', () => {
  assert.deepEqual(parseSessionConfig('{"gps":{"interval_s":45}}'), {
    gps: { interval_s: 45 },
  });
});

test('a stored sample maps onto the upload payload', () => {
  const upload = toSampleUpload(sampleRow());

  assert.equal(upload.sample_seq, 0);
  assert.equal(upload.sample_type, 'gps');
  assert.equal(upload.latitude, 19.4326);
  assert.equal(upload.app_state, 'foreground');
  assert.equal(upload.is_mocked, false);
});

test('absent optional fields become explicit nulls', () => {
  // Dexie stores them as undefined, which JSON.stringify would drop entirely.
  const upload = toSampleUpload(
    sampleRow({
      latitude: undefined,
      longitude: undefined,
      accuracy_m: undefined,
      battery_pct: undefined,
      app_state: undefined,
    })
  );

  assert.equal(upload.latitude, null);
  assert.equal(upload.longitude, null);
  assert.equal(upload.accuracy_m, null);
  assert.equal(upload.battery_pct, null);
  assert.equal(upload.app_state, null);
});

test('a hidden-tab gap marker survives the round trip', () => {
  // It must NOT go up as `gps`: the API rejects a GPS fix with no coordinates,
  // and one such row used to 422 the whole batch on every retry.
  const upload = toSampleUpload(
    sampleRow({
      sample_seq: 7,
      sample_type: 'gap',
      latitude: undefined,
      longitude: undefined,
      app_state: 'hidden',
      payload_json: '{"marker":"coverage_gap"}',
    })
  );

  assert.equal(upload.sample_type, 'gap');
  assert.equal(upload.latitude, null);
  assert.equal(upload.longitude, null);
  assert.equal(upload.app_state, 'hidden');
  assert.deepEqual(upload.payload, { marker: 'coverage_gap' });
});

test('a corrupt payload does not cost us the position', () => {
  const upload = toSampleUpload(sampleRow({ payload_json: '{broken' }));

  assert.equal(upload.payload, null);
  assert.equal(upload.latitude, 19.4326);
});

test('a run drains at most the batch window', () => {
  assert.equal(FIELD_SAMPLE_BATCH_SIZE * MAX_SAMPLE_BATCHES_PER_RUN, 1000);
  assert.ok(FIELD_SAMPLE_BATCH_SIZE <= 500, 'server rejects batches over 500');
});
