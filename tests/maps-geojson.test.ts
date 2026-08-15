import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bboxForFeatureCollection,
  featureCollectionFromRows,
  splitByGeometry,
} from '../src/lib/maps/geojson';
import type { StaticMapFeature } from '../src/lib/db/database';

const rows: StaticMapFeature[] = [
  {
    feature_key: '1:1:10',
    feature_id: 10,
    map_id: 1,
    layer_id: 1,
    layer_name: 'Zonas',
    layer_type: 'polygon',
    geometry_json: JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [-99, 19],
          [-98, 19],
          [-98, 20],
          [-99, 19],
        ],
      ],
    }),
    properties_json: JSON.stringify({ name: 'Norte' }),
  },
  {
    feature_key: '1:2:11',
    feature_id: 11,
    map_id: 1,
    layer_id: 2,
    layer_name: 'Puntos',
    layer_type: 'point',
    geometry_json: JSON.stringify({
      type: 'Point',
      coordinates: [-97.5, 18.5],
    }),
    properties_json: null,
  },
];

test('builds a collection and preserves layer metadata', () => {
  const collection = featureCollectionFromRows(rows);
  assert.equal(collection.features.length, 2);
  assert.equal(collection.features[0].properties.name, 'Norte');
  assert.equal(collection.features[0].properties.layerName, 'Zonas');
});

test('calculates bbox across geometry types', () => {
  const collection = featureCollectionFromRows(rows);
  assert.deepEqual(bboxForFeatureCollection(collection), [-99, 18.5, -97.5, 20]);
});

test('splits polygons, lines and points into independent collections', () => {
  const buckets = splitByGeometry(featureCollectionFromRows(rows));
  assert.equal(buckets.polygons.features.length, 1);
  assert.equal(buckets.points.features.length, 1);
  assert.equal(buckets.lines.features.length, 0);
  assert.equal(buckets.unsupported.features.length, 0);
});
