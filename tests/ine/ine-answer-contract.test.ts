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

test('resuelve required_fields en snake_case contra ocrData camelCase', () => {
  // Regresion: los alias eran unidireccionales (solo camel -> snake). Si el CMS
  // envia required_fields en snake_case y el OCR trae camelCase, el campo no se
  // encontraba y la pregunta quedaba bloqueada sin salida para el brigadista.
  const rules = { required_fields: ['front', 'back', 'apellido_paterno'] };
  const answer = {
    front: 'f',
    back: 'b',
    ocrData: {
      data: { apellidoPaterno: 'PEREZ' },
    },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('resuelve required_fields camelCase contra un payload plano snake_case', () => {
  const rules = { required_fields: ['front', 'back', 'apellidoPaterno'] };
  const answer = {
    front: 'f',
    back: 'b',
    ocrData: { apellido_paterno: 'PEREZ' },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
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

/**
 * `require_front` / `require_back` are the rules the CMS actually emits for
 * `ine_ocr` (webCMS/src/lib/survey/question-type-registry.ts). The backend
 * never validated them, so they were honoured by nobody.
 */

test('exige la foto declared en require_back aunque el OCR no extraiga nada', () => {
  const rules = { require_front: true, require_back: true };
  const answer = {
    front: 'file-front',
    back: 'file-back',
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  // Foto presente + OCR del frente completo: la foto del reverso basta.
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('require_back:true bloquea cuando falta la foto del reverso', () => {
  const rules = { require_front: true, require_back: true };
  const answer = {
    front: 'file-front',
    back: null,
    nombre: 'JUAN',
    curp: 'PEPJ000101HDFRPN09',
  };
  const message = validateAnswer(ineQuestion(rules), answer);
  assert.ok(message);
  assert.match(message, /Reverso/);
});

test('require_back:false no exige la foto del reverso', () => {
  const rules = { require_front: true, require_back: false };
  const answer = {
    front: 'file-front',
    back: null,
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('require_back:false gana sobre los defaults que exigen el reverso', () => {
  // Defaults de la App incluyen `back`; un false explicito debe descartarlo.
  const rules = { require_back: false };
  const answer = {
    front: 'file-front',
    back: null,
    nombre: 'JUAN',
    curp: 'PEPJ000101HDFRPN09',
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('require_front:false exime la foto del frente aunque los defaults la pidan', () => {
  // Los defaults incluyen `front`; un false explicito debe descartarlo.
  const rules = { require_front: false, require_back: true };
  const answer = {
    front: null,
    back: 'file-back',
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('sin require_*, ambos lados siguen siendo exigidos (comportamiento previo)', () => {
  const answer = {
    front: 'file-front',
    back: null,
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  const message = validateAnswer(ineQuestion({}), answer);
  assert.ok(message);
  assert.match(message, /Reverso/);
});

test('un reverso con OCR vacío sigue cumpliendo require_back', () => {
  // El requisito es la captura, no la extracción de campos.
  const rules = { require_front: true, require_back: true };
  const answer = {
    front: 'file-front',
    back: 'file-back',
    back_ocr: '{}',
    ocrData: { data: { nombre: 'JUAN', curp: 'PEPJ000101HDFRPN09' } },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});

test('require_* combinadas con required_fields del backend', () => {
  const rules = {
    require_front: true,
    require_back: true,
    required_fields: ['front', 'back', 'curp', 'domicilio'],
  };
  const answer = {
    front: 'file-front',
    back: 'file-back',
    ocrData: { data: { curp: 'PEPJ000101HDFRPN09', domicilio: 'PUEBLA' } },
  };
  assert.equal(validateAnswer(ineQuestion(rules), answer), null);
});
