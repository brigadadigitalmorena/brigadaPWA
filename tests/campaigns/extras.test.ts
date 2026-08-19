import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterPriorityEntitlements,
  isPrioritySurveyType,
  prioritySurveyBadge,
  priorityUrgencyLabel,
  priorityUrgencyLevel,
  resolvePriorityDisplayItems,
} from '../../src/lib/campaigns/extras';

test('isPrioritySurveyType matches extra and legacy aliases only', () => {
  assert.equal(isPrioritySurveyType('extra'), true);
  assert.equal(isPrioritySurveyType('extras'), true);
  assert.equal(isPrioritySurveyType(undefined, true), true);
  assert.equal(isPrioritySurveyType('gestion'), false);
  assert.equal(isPrioritySurveyType('normal'), false);
});

test('filterPriorityEntitlements includes extra and ends_at but not gestion', () => {
  const rows = [
    { survey_type: 'extra', ends_at: '2026-12-31T00:00:00Z', entitlement_status: 'active' },
    { survey_type: 'gestion', ends_at: '2026-12-31T00:00:00Z', entitlement_status: 'active' },
    { survey_type: 'normal', ends_at: '2026-12-31T00:00:00Z', entitlement_status: 'active' },
    { survey_type: 'normal', ends_at: null, entitlement_status: 'active' },
  ];
  const shown = filterPriorityEntitlements(rows);
  assert.equal(shown.length, 2);
  assert.deepEqual(
    shown.map((row) => row.survey_type).sort(),
    ['extra', 'normal'],
  );
});

test('resolvePriorityDisplayItems returns empty when only gestion or open-ended normal exist', () => {
  const rows = [
    { survey_type: 'normal', entitlement_status: 'active' },
    { survey_type: 'gestion', entitlement_status: 'active' },
  ];
  assert.deepEqual(resolvePriorityDisplayItems(rows), []);
});

test('priorityUrgencyLevel uses 24h and 72h thresholds', () => {
  const now = Date.parse('2026-08-19T12:00:00.000Z');
  assert.equal(priorityUrgencyLevel('2026-08-20T10:00:00.000Z', now), 'high');
  assert.equal(priorityUrgencyLevel('2026-08-21T12:00:00.000Z', now), 'medium');
  assert.equal(priorityUrgencyLevel('2026-08-30T12:00:00.000Z', now), 'low');
  assert.equal(priorityUrgencyLevel(null, now), 'low');
});

test('prioritySurveyBadge reflects deadline urgency', () => {
  const now = Date.parse('2026-08-19T12:00:00.000Z');
  const badge = prioritySurveyBadge(
    { survey_type: 'extra', ends_at: '2026-08-20T10:00:00.000Z' },
    now,
  );
  assert.equal(badge.label, 'Urgente');
  assert.equal(badge.level, 'high');
});

test('priorityUrgencyLabel maps levels to Spanish copy', () => {
  assert.equal(priorityUrgencyLabel('high'), 'Urgente');
  assert.equal(priorityUrgencyLabel('medium'), 'Pronto');
  assert.equal(priorityUrgencyLabel('low'), 'Normal');
});
