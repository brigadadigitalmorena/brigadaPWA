import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessStorageQuota,
  buildTileUrl,
  getTilesForBounds,
} from '../src/lib/services/tile-utils';

test('expands a tile template with versioned pack coordinates', () => {
  assert.equal(
    buildTileUrl(
      'https://tiles.example/{version}/{pack_id}/{z}/{x}/{y}.png',
      { z: 12, x: 100, y: 200 },
      { version: '2026-08', packId: 'puebla centro' }
    ),
    'https://tiles.example/2026-08/puebla%20centro/12/100/200.png'
  );
});

test('enumerates all zoom levels inside a small bbox', () => {
  const tiles = getTilesForBounds(
    { west: -98.21, south: 19.03, east: -98.19, north: 19.05 },
    10,
    11
  );
  assert.ok(tiles.length > 0);
  assert.deepEqual(new Set(tiles.map((tile) => tile.z)), new Set([10, 11]));
});

test('rejects a pack when quota minus reserve is insufficient', () => {
  const assessment = assessStorageQuota(
    { quota: 100 * 1024 * 1024, usage: 70 * 1024 * 1024 },
    15 * 1024 * 1024,
    20 * 1024 * 1024
  );
  assert.equal(assessment.canDownload, false);
  assert.equal(assessment.shortfallBytes, 5 * 1024 * 1024);
});
