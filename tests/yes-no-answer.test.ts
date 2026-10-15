import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceYesNoValue,
  isEmptyAnswerValue,
  validateAnswer,
} from '../src/lib/forms/validate-answer';
import type { Question } from '../src/lib/types';

test('coerces yes/no UI values to booleans', () => {
  assert.equal(coerceYesNoValue(true), true);
  assert.equal(coerceYesNoValue(false), false);
  assert.equal(coerceYesNoValue('Sí'), true);
  assert.equal(coerceYesNoValue('no'), false);
  assert.equal(coerceYesNoValue('1'), true);
  assert.equal(coerceYesNoValue('2'), false);
  assert.equal(coerceYesNoValue(undefined), undefined);
});

test('treats boolean false as a filled required yes_no answer', () => {
  const question = {
    id: 5,
    question_text: '¿Se requiere seguimiento?',
    question_type: 'yes_no',
    question_key: 'requiere_seguimiento',
    is_required: true,
  } as Question;

  assert.equal(isEmptyAnswerValue(false), false);
  assert.equal(validateAnswer(question, false), null);
  assert.equal(validateAnswer(question, undefined), 'Este campo es obligatorio');
});
