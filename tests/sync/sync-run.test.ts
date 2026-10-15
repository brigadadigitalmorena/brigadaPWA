import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSyncRun } from '../../src/lib/sync/sync-run';

test('a skipped run does not count as a confirmed sync', () => {
  const notice = describeSyncRun({
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skippedReason: 'no_session',
    errors: [],
  });
  assert.equal(notice.confirmed, false);
  assert.equal(notice.tone, 'error');
  assert.match(notice.message, /sesión/i);
});

test('server acceptance is the only confirmed sync', () => {
  const notice = describeSyncRun({
    attempted: 3,
    succeeded: 3,
    failed: 0,
    errors: [],
  });
  assert.equal(notice.confirmed, true);
  assert.equal(notice.tone, 'success');
  assert.match(notice.message, /confirmó/);
});

test('a failed attempt keeps the previous confirmation and explains why', () => {
  const notice = describeSyncRun({
    attempted: 3,
    succeeded: 0,
    failed: 3,
    errors: ['Sesión expirada. Inicia sesión e intenta de nuevo.'],
  });
  assert.equal(notice.confirmed, false);
  assert.equal(notice.tone, 'error');
  assert.match(notice.message, /No se envió nada/);
  assert.match(notice.message, /Sesión expirada/);
});

test('a partial send is confirmed and names the failure', () => {
  const notice = describeSyncRun({
    attempted: 3,
    succeeded: 1,
    failed: 2,
    errors: ['Datos inválidos'],
  });
  assert.equal(notice.confirmed, true);
  assert.equal(notice.tone, 'warning');
  assert.match(notice.message, /Se enviaron 1/);
  assert.match(notice.message, /Datos inválidos/);
});
