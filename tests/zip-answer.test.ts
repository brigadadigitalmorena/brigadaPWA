import assert from 'node:assert/strict';
import test from 'node:test';

import { parseZipValue, isCompleteZip } from '../src/lib/forms/zip-answer';
import { validateAnswer } from '../src/lib/forms/validate-answer';
import type { Question } from '../src/lib/types';

const zipQuestion = {
  id: 9,
  version_id: 1,
  question_text: 'Código postal',
  question_type: 'codigo_postal_autofill',
  question_key: 'cp',
  order: 1,
  is_required: true,
} as Question;

test('parseZipValue accepts mobile compound and legacy zip/settlement', () => {
  assert.equal(
    parseZipValue({ codigo_postal: '06600', colonia: 'CENTRO' }).colonia,
    'CENTRO'
  );
  assert.equal(parseZipValue({ zip: '06600', settlement: 'JUAREZ' }).colonia, 'JUAREZ');
  assert.equal(parseZipValue('12ab345').codigo_postal, '12345');
});

test('required zip autofill needs a 5-digit code and colonia', () => {
  assert.equal(isCompleteZip('06600'), true);
  assert.equal(
    validateAnswer(zipQuestion, { codigo_postal: '0660', colonia: '' }),
    'Ingresa un código postal de 5 dígitos'
  );
  assert.equal(
    validateAnswer(zipQuestion, { codigo_postal: '06600', colonia: '' }),
    'Selecciona una colonia'
  );
  assert.equal(
    validateAnswer(zipQuestion, {
      codigo_postal: '06600',
      colonia: 'CENTRO',
      tipo: '',
      municipio: '',
      estado: '',
      ciudad: '',
      zona: '',
    }),
    null
  );
});
