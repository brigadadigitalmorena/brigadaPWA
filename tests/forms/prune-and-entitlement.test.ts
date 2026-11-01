import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceFieldTracking,
  coerceGeoEnforcement,
  normalizeAssignedSurvey,
} from '../../src/lib/campaigns/normalize';
import {
  pruneHiddenAnswers,
  visibleAnswerKeySet,
} from '../../src/lib/forms/prune-hidden-answers';

test('drops answers that are not in the visible field set', () => {
  const visible = visibleAnswerKeySet([
    { key: 'nombre', field: { question_id: 1, question_key: 'nombre' } },
    { key: 'q:2', field: { question_id: 2, question_key: null } },
  ]);
  const pruned = pruneHiddenAnswers(
    { nombre: 'Ana', curp: 'OCULTO', '2': 'sigue', extra: 'no' },
    visible
  );
  assert.deepEqual(pruned, { nombre: 'Ana', '2': 'sigue' });
});

test('maps assignment geo and tracking flags onto the fill contract', () => {
  const row = normalizeAssignedSurvey({
    assignment_id: 4,
    survey_id: 9,
    survey_title: 'Campo',
    assignment_status: 'active',
    geo_enforcement: 'none',
    field_tracking: true,
    latest_version: { id: 1 },
    assigned_at: '2026-11-01T00:00:00Z',
  });
  assert.ok(row);
  assert.equal(row.geo_enforcement, 'off');
  assert.equal(row.field_tracking?.enabled, true);
  assert.equal(coerceGeoEnforcement('block'), 'block');
  assert.equal(coerceFieldTracking(false), null);
});
