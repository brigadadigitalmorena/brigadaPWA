import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyOcrAutofill,
  emptyIneOcrData,
  getIneOcrFieldValue,
  parseIneValue,
  patchAddressField,
} from '../src/lib/forms/ine-answer';
import { validateAnswer } from '../src/lib/forms/validate-answer';
import type { Question } from '../src/lib/types';

function ineQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    version_id: 1,
    question_text: 'Captura INE',
    question_type: 'ine_ocr',
    question_key: 'ine',
    order: 1,
    is_required: true,
    ...overrides,
  };
}

test('parseIneValue accepts legacy string as front image', () => {
  const parsed = parseIneValue('file-front');
  assert.equal(parsed.front, 'file-front');
  assert.equal(parsed.back, null);
  assert.equal(parsed.ocrData, null);
});

test('parseIneValue keeps compound object fields', () => {
  const parsed = parseIneValue({
    front: 'f1',
    back: 'b1',
    ocrData: { nombre: 'ANA', curp: 'AAAA000000HDFLRN01' },
  });
  assert.equal(parsed.front, 'f1');
  assert.equal(parsed.back, 'b1');
  assert.equal(parsed.ocrData?.nombre, 'ANA');
  assert.equal(parsed.ocrData?.curp, 'AAAA000000HDFLRN01');
});

test('required INE answer needs both sides when required', () => {
  const message = validateAnswer(ineQuestion(), {
    front: 'f1',
    back: null,
    ocrData: null,
  });
  assert.ok(message?.includes('Reverso'));
});

test('ocr_autofill copies dotted address fields and respects override', () => {
  const source = {
    front: 'f1',
    back: 'b1',
    ocrData: {
      ...emptyIneOcrData(),
      nombre: 'MARIA',
      domicilioDesglosado: {
        calle: 'REFORMA 1',
        colonia: 'CENTRO',
        codigoPostal: '06600',
        municipio: 'CUAUHTEMOC',
        estado: 'CIUDAD DE MEXICO',
      },
    },
  };

  assert.equal(getIneOcrFieldValue(source, 'nombre_completo'), 'MARIA');
  assert.equal(getIneOcrFieldValue(source, 'domicilioDesglosado.codigoPostal'), '06600');

  const fields = [
    ineQuestion(),
    {
      ...ineQuestion(),
      id: 2,
      question_key: 'nombre',
      question_type: 'text',
      is_required: false,
      metadata: {
        ocr_autofill: {
          source_question_key: 'ine',
          source_field: 'nombre',
        },
      },
    },
  ] as Question[];

  const first = applyOcrAutofill({
    sourceQuestionKey: 'ine',
    sourceValue: source,
    fields,
    answers: {},
  });
  assert.equal(first.nombre, 'MARIA');

  const skipped = applyOcrAutofill({
    sourceQuestionKey: 'ine',
    sourceValue: source,
    fields,
    answers: { nombre: 'YA ESCRITO' },
  });
  assert.equal(skipped.nombre, undefined);
});

test('address edits rebuild the flat domicilio string', () => {
  const next = patchAddressField(emptyIneOcrData(), 'colonia', 'ROMA NORTE');
  assert.match(next.domicilio, /ROMA NORTE/);
  assert.equal(next.domicilioDesglosado?.colonia, 'ROMA NORTE');
});
