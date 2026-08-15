import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessStorageQuota,
  buildTileUrl,
  getTilesForBounds,
  latitudeToTileY,
  longitudeToTileX,
} from '../../src/lib/services/tile-utils';

test('Web Mercator helpers map the origin to the expected tile', () => {
  assert.equal(longitudeToTileX(0, 1), 1);
  assert.equal(latitudeToTileY(0, 1), 1);
});

test('tile calculation includes every zoom level and coordinate once', () => {
  const tiles = getTilesForBounds(
    { west: -0.1, south: -0.1, east: 0.1, north: 0.1 },
    0,
    1
  );

  assert.deepEqual(tiles, [
    { z: 0, x: 0, y: 0 },
    { z: 1, x: 0, y: 0 },
    { z: 1, x: 0, y: 1 },
    { z: 1, x: 1, y: 0 },
    { z: 1, x: 1, y: 1 },
  ]);
});

test('URL templates support tile, version and pack placeholders', () => {
  assert.equal(
    buildTileUrl(
      'https://tiles.example/{version}/{pack_id}/{z}/{x}/{y}.png',
      { z: 12, x: 100, y: 200 },
      { version: '2026-08', packId: 'zona centro' }
    ),
    'https://tiles.example/2026-08/zona%20centro/12/100/200.png'
  );
});

test('quota assessment reserves headroom for the rest of the PWA', () => {
  const result = assessStorageQuota(
    { quota: 100 * 1024 * 1024, usage: 50 * 1024 * 1024 },
    40 * 1024 * 1024,
    20 * 1024 * 1024
  );

  assert.equal(result.canDownload, false);
  assert.equal(result.availableBytes, 30 * 1024 * 1024);
  assert.equal(result.shortfallBytes, 10 * 1024 * 1024);
});

test('unknown browser quota does not reject a download preemptively', () => {
  assert.deepEqual(assessStorageQuota({}, 123), {
    canDownload: true,
    availableBytes: null,
    requiredBytes: 123,
    shortfallBytes: 0,
  });
});
