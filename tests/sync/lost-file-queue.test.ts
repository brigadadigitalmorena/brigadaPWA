import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isLostFileOnlyRun,
  planLostFileCollapse,
  type LostFileQueueRow,
} from '../../src/lib/sync/lost-file-queue';

function row(partial: LostFileQueueRow): LostFileQueueRow {
  return partial;
}

test('collapse keeps one lost-file row and drops the pending copies', () => {
  const plan = planLostFileCollapse([
    row({
      id: 1,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'failed_permanent',
      last_error_code: 'BLOB_MISSING',
    }),
    row({
      id: 2,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'failed_permanent',
      last_error: 'No se pudo recuperar el archivo local',
    }),
    row({
      id: 3,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'pending',
    }),
    row({
      id: 4,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-b',
      status: 'pending',
    }),
    row({
      id: 5,
      operation_type: 'CREATE_RESPONSE',
      entity_id: 'response-1',
      status: 'pending',
    }),
  ]);

  assert.deepEqual(plan.discardIds, [2, 3]);
  assert.deepEqual(plan.fileIds, ['file-a']);
});

test('a single lost file is marked unrecoverable without discarding itself', () => {
  const plan = planLostFileCollapse([
    row({
      id: 9,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'failed_permanent',
      last_error_code: 'LOCAL_FILE_MISSING',
    }),
  ]);

  assert.deepEqual(plan.discardIds, []);
  assert.deepEqual(plan.fileIds, ['file-a']);
});

test('an in-flight upload of a lost file is left for the current pass', () => {
  const plan = planLostFileCollapse([
    row({
      id: 1,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'failed_permanent',
      last_error_code: 'BLOB_MISSING',
    }),
    row({
      id: 2,
      operation_type: 'UPLOAD_FILE',
      entity_id: 'file-a',
      status: 'leased',
    }),
  ]);

  assert.deepEqual(plan.discardIds, []);
  assert.deepEqual(plan.fileIds, ['file-a']);
});

test('only a run that failed entirely on lost files holds the next auto sync', () => {
  assert.equal(
    isLostFileOnlyRun({
      succeeded: 0,
      failed: 2,
      errors: ['No se pudo recuperar el archivo local'],
    }),
    true
  );
  assert.equal(
    isLostFileOnlyRun({
      succeeded: 1,
      failed: 1,
      errors: ['No se pudo recuperar el archivo local'],
    }),
    false
  );
  assert.equal(
    isLostFileOnlyRun({
      succeeded: 0,
      failed: 1,
      errors: ['Sin conexión'],
    }),
    false
  );
});
