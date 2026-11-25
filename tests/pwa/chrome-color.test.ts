import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveChromeColor } from '../../src/lib/pwa-manifest';

test('the saved scheme wins over the color pinned in the install URL', () => {
  assert.equal(resolveChromeColor('38BDF8', '#FF1B8D'), '#38BDF8');
  assert.equal(resolveChromeColor('%2338BDF8', '#FF1B8D'), '#38BDF8');
});

test('a manifest without a saved scheme still honors an explicit query color', () => {
  assert.equal(resolveChromeColor(null, '#0284C7'), '#0284C7');
});

test('missing colors fall back to the default pink', () => {
  assert.equal(resolveChromeColor(undefined, 'nope'), '#FF1B8D');
});
