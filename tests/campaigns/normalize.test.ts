import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAssignedSurvey,
  normalizeAssignedSurveys,
  unwrapAssignedSurveyList,
} from '../../src/lib/campaigns/normalize';

test('unwrapAssignedSurveyList accepts a raw array or wrapped payloads', () => {
  assert.deepEqual(unwrapAssignedSurveyList([{ survey_id: 1 }]), [{ survey_id: 1 }]);
  assert.deepEqual(unwrapAssignedSurveyList({ items: [{ survey_id: 2 }] }), [
    { survey_id: 2 },
  ]);
  assert.deepEqual(unwrapAssignedSurveyList({ data: [{ survey_id: 3 }] }), [
    { survey_id: 3 },
  ]);
  assert.deepEqual(unwrapAssignedSurveyList({ ok: true }), []);
});

test('normalizeAssignedSurvey maps assignment/group fields from current backend', () => {
  const row = normalizeAssignedSurvey({
    assignment_id: 42,
    assignment_status: 'active',
    group_id: 7,
    group_name: 'Equipo Alpha',
    survey_id: 1,
    survey_title: 'SEED — Encuesta Demo Local',
    assigned_at: '2026-08-31T00:00:00Z',
    latest_version: { id: 1, version_number: 1, is_published: true, engine_version: 2 },
  });

  assert.ok(row);
  assert.equal(row.entitlement_id, 42);
  assert.equal(row.entitlement_status, 'active');
  assert.equal(row.campaign_id, 7);
  assert.equal(row.campaign_name, 'Equipo Alpha');
  assert.equal(row.survey_id, 1);
});

test('normalizeAssignedSurveys drops rows without a survey or assignment id', () => {
  const rows = normalizeAssignedSurveys([
    { survey_id: 1, assignment_id: 9, survey_title: 'Ok' },
    { survey_title: 'Missing ids' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entitlement_id, 9);
});
