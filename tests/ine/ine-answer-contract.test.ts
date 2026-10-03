import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAnswer } from '../../src/lib/forms/validate-answer';
import type { Question } from '../../src/lib/types';

/**
 * These assertions lock the INE answer contract that blocked submission.
 * Every case here was a real hard block: validateAnswer returns a non-null
 * string, which makes finalizeSurvey abort the whole response.
 */

function ineQuestion(
  validationRules: Record<string, unknown> | null,
  isRequired = true,
): Question {
  return {
    id: 1,
    question_type: 'ine_ocr',
    is_required: isRequired,
    validation_rules: validationRules,
  } as unknown as Question;
}

const FULL_FLAT_ANSWER = {
  front: 'file-front-id',
  back: 'file-back-id',
  front_ocr: '{}',
  back_ocr: '{}',
  nombre: 'JUAN',
  curp: 'PEPJ000101HDFRPN09',
  ocrData: {
    text: 'raw',
    confidence: 0.93,
    side: 'front',
    data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' },
  },
};

test('acepta respuesta plana snake_case completa', () => {
  assert.equal(validateAnswer(ineQuestion(null), FULL_FLAT_ANSWER), null);
});

test('un valor numérico truthy no marca la respuesta como vacía', () => {
  // Regresión: isEmptyIneValue devolvía Boolean(0.93) === true para confidence,
  // y .some() hacía que la respuesta INE completa se reportara como vacía.
  const answer = {
    front: 'file-front-id',
    back: 'file-back-id',
    ocrData: { confidence: 0.93, data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  assert.equal(validateAnswer(ineQuestion(null), answer), null);
});

test('lee los campos desde ocrData.data (IneOcrResult anidado)', () => {
  const answer = {
    front: 'f',
    back: 'b',
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  assert.equal(validateAnswer(ineQuestion(null), answer), null);
});

test('lee los campos desde ocrData plano (forma INEOcrResult de la App)', () => {
  const answer = {
    front: 'f',
    back: 'b',
    ocrData: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' },
  };
  assert.equal(validateAnswer(ineQuestion(null), answer), null);
});

test('resuelve required_fields del backend en camelCase', () => {
  // El seed real (backEnd/scripts/seed_v2_full.py) configura 13 campos camelCase.
  const rules = {
    required_fields: [
      'front',
      'back',
      'nombre',
      'apellidoPaterno',
      'apellidoMaterno',
      'curp',
    ],
  };
  const answer = {
    front: 'f',
    back: 'b',
    ocrData: {
      data: {
        nombre: 'JUAN',
        apellidoPaterno: 'PEREZ',
        apellidoMaterno: 'LOPEZ',
        curp: 'PEPJ000101HDFRPN09',
      },
    },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('bloquea y nombra el reverso faltante', () => {
  const answer = { front: 'f', back: null, nombre: 'JUAN', curp: 'X' };
  const message = validateAnswer(ineQuestion(null), answer);
  assert.ok(message, 'debe bloquear el envío');
  assert.match(message, /Reverso/);
});

test('bloquea y nombra el CURP faltante con etiqueta legible', () => {
  const answer = { front: 'f', back: 'b', nombre: 'JUAN' };
  const message = validateAnswer(ineQuestion(null), answer);
  assert.ok(message);
  assert.match(message, /CURP/);
  // No debe filtrar la clave cruda al usuario.
  assert.doesNotMatch(message, /curp:/);
});

test('respeta required_fields configurado por la oficina', () => {
  // La config explícita del CMS manda: reducir los defaults no debe relajarla.
  const rules = { required_fields: ['front', 'back', 'domicilio'] };
  const answer = { front: 'f', back: 'b', nombre: 'JUAN', curp: 'X' };
  const message = validateAnswer(ineQuestion(rules), answer);
  assert.ok(message);
  assert.match(message, /Domicilio/);
});

test('pregunta no requerida y vacía no bloquea', () => {
  assert.equal(validateAnswer(ineQuestion(null, false), undefined), null);
});

test('pregunta requerida y vacía bloquea con mensaje genérico', () => {
  assert.equal(validateAnswer(ineQuestion(null, true), undefined), 'Este campo es obligatorio');
});
