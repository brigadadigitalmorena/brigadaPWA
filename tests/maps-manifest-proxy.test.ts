import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedManifestUrl } from '../src/lib/api/maps-manifest-hosts';
import { DEV_OSM_TILE_MANIFEST } from '../src/lib/api/osm-tile-manifest-fallback';

test('local OSM fallback manifest matches the pack version contract', () => {
  assert.equal(DEV_OSM_TILE_MANIFEST.dataset, 'osm');
  assert.ok(DEV_OSM_TILE_MANIFEST.packs.length > 0);
  for (const pack of DEV_OSM_TILE_MANIFEST.packs) {
    assert.equal(pack.version, DEV_OSM_TILE_MANIFEST.current_version);
    assert.equal(pack.bbox.length, 4);
    assert.match(pack.tiles_url_template, /\{z\}.*\{x\}.*\{y\}/);
    assert.ok(pack.minzoom <= pack.maxzoom);
  }
});

test('allows R2 and local manifest hosts and rejects arbitrary URLs', () => {
  assert.equal(
    isAllowedManifestUrl(
      'https://abc.r2.cloudflarestorage.com/brigada/maps/1/v1/manifest.json'
    ),
    true
  );
  assert.equal(
    isAllowedManifestUrl('https://tiles.brigadadigital.com/maps/1.json'),
    true
  );
  assert.equal(isAllowedManifestUrl('http://127.0.0.1:9000/maps/1.json'), true);
  assert.equal(isAllowedManifestUrl('https://evil.example/steal'), false);
  assert.equal(isAllowedManifestUrl('not a url'), false);
});
