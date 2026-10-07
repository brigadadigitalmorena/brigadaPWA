import assert from 'node:assert/strict';
import test from 'node:test';

import {
  matchEntitlement,
  parseOptionalScopeId,
  surveyResumeHref,
} from '../../src/lib/campaigns/scope';

test('parseOptionalScopeId treats missing and Number(null) traps as null', () => {
  assert.equal(parseOptionalScopeId(null), null);
  assert.equal(parseOptionalScopeId(undefined), null);
  assert.equal(parseOptionalScopeId(''), null);
  assert.equal(parseOptionalScopeId('   '), null);
  assert.equal(parseOptionalScopeId(0), null);
  assert.equal(parseOptionalScopeId('0'), null);
  assert.equal(parseOptionalScopeId(Number(null)), null);
  assert.equal(parseOptionalScopeId('12'), 12);
  assert.equal(parseOptionalScopeId(12), 12);
});

test('matchEntitlement ignores campaign/entitlement id 0 from missing query params', () => {
  const rows = [
    {
      survey_id: 5,
      entitlement_id: 41,
      campaign_id: 7,
    },
  ];

  assert.equal(
    matchEntitlement(rows, 5, { entitlementId: 0, campaignId: 0 })?.entitlement_id,
    41
  );
  assert.equal(
    matchEntitlement(rows, 5, { entitlementId: 99 })?.entitlement_id,
    undefined
  );
  assert.equal(
    matchEntitlement(rows, 5, { campaignId: 7 })?.entitlement_id,
    41
  );
});

test('surveyResumeHref includes resumeDraftId and omits invalid scope ids', () => {
  const href = surveyResumeHref({
    survey_id: 5,
    response_id: 'draft-1',
    survey_title: 'Visita',
    campaign_id: 0,
    entitlement_id: null,
  });

  assert.equal(href.includes('resumeDraftId=draft-1'), true);
  assert.equal(href.includes('title=Visita'), true);
  assert.equal(href.includes('campaignId='), false);
  assert.equal(href.includes('entitlementId='), false);

  const scoped = surveyResumeHref({
    survey_id: 5,
    response_id: 'draft-1',
    survey_title: 'Visita',
    campaign_id: 7,
    entitlement_id: 41,
    campaign_name: 'Campamento',
  });
  assert.equal(scoped.includes('campaignId=7'), true);
  assert.equal(scoped.includes('entitlementId=41'), true);
  assert.equal(scoped.includes('campaign=Campamento'), true);
});
