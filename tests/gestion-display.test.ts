import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GestionTrackingRow } from '../src/lib/api/gestion.service';
import {
  getGestionReferenceFields,
  getSourceEntries,
  getSourceSummary,
  humanizeSourceKey,
} from '../src/lib/gestion/display';

function row(
  overrides: Partial<GestionTrackingRow> = {}
): GestionTrackingRow {
  return {
    request_id: 'req-1',
    entitlement_id: 1,
    survey_id: 494,
    survey_title: 'Reporte de daños',
    tracking_id: 'req-1',
    folio_seq: 12,
    entitlement_status: 'active',
    management_status: 'pendiente',
    comments: '',
    created_at: '2026-11-19T12:00:00.000Z',
    updated_at: null,
    closed_at: null,
    id_attributes: ['nombre_solicitante'],
    source_values: {},
    status_history: [],
    ...overrides,
  };
}

describe('gestion display helpers', () => {
  it('labels isolated source numbers instead of dumping raw values', () => {
    const summary = getSourceSummary({
      survey_id: '494',
      response_id: '1',
    });
    assert.match(summary, /ID de encuesta: 494/);
    assert.match(summary, /ID de respuesta: 1/);
  });

  it('humanizes snake_case keys', () => {
    assert.equal(humanizeSourceKey('nombre_solicitante'), 'Solicitante');
    assert.equal(humanizeSourceKey('colonia_destino'), 'Colonia destino');
  });

  it('unifies tracking id and referencia when they match', () => {
    const fields = getGestionReferenceFields(row());
    assert.deepEqual(fields, [{ label: 'Referencia', value: 'req-1' }]);
  });

  it('keeps both fields when tracking and referencia differ', () => {
    const fields = getGestionReferenceFields(
      row({ tracking_id: 'TRK-99', request_id: 'req-1' })
    );
    assert.equal(fields.length, 2);
    assert.equal(fields[0]?.label, 'Tracking ID');
    assert.equal(fields[1]?.label, 'Referencia');
  });

  it('prefers id_attributes order', () => {
    const entries = getSourceEntries(
      { colonia: 'Centro', nombre_solicitante: 'Ana' },
      { idAttributes: ['nombre_solicitante'] }
    );
    assert.equal(entries[0]?.key, 'nombre_solicitante');
  });
});
