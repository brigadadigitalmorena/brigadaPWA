import assert from 'node:assert/strict';
import test from 'node:test';

import { gisSampleIntervalMs, matchesBarcodePattern, maxDurationSeconds } from '../../src/lib/forms/field-rules';
import { normalizeAnswerByRules } from '../../src/lib/forms/normalize-answer';
import { surveyVersionToFormSchema } from '../../src/lib/forms/survey-to-form-schema';
import { validateAnswer } from '../../src/lib/forms/validate-answer';
import type { Question, SurveyVersion } from '../../src/lib/types';

function question(partial: Partial<Question> & Pick<Question, 'question_type'>): Question {
  return {
    id: 1,
    version_id: 1,
    question_text: 'Campo',
    order: 0,
    is_required: true,
    ...partial,
  };
}

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

test('normalizes CURP the way CMS defaults describe', () => {
  const normalized = normalizeAnswerByRules(' ab c ', {
    normalize_trim: true,
    normalize_remove_spaces: true,
    normalize_uppercase: true,
  });
  assert.equal(normalized, 'ABC');
});

test('accepts min_date today and rejects a local yesterday', () => {
  const dateQuestion = question({
    question_type: 'date',
    validation_rules: { min_date: 'today' },
  });
  assert.equal(validateAnswer(dateQuestion, localDate(0)), null);
  assert.match(
    validateAnswer(dateQuestion, localDate(-1)) ?? '',
    /anterior al mínimo/
  );
});

test('enforces numeric step and GIS min points on the PWA point list', () => {
  const numberQuestion = question({
    question_type: 'number',
    validation_rules: { min: 0, step: 2 },
  });
  assert.equal(validateAnswer(numberQuestion, 4), null);
  assert.match(validateAnswer(numberQuestion, 3) ?? '', /incrementos de 2/);

  const line = question({
    question_type: 'gis_line',
    validation_rules: { min_points: 2 },
  });
  assert.equal(
    validateAnswer(line, [
      { lat: 19.4, lng: -99.1 },
      { lat: 19.41, lng: -99.11 },
    ]),
    null
  );
  assert.match(
    validateAnswer(line, [{ lat: 19.4, lng: -99.1 }]) ?? '',
    /al menos 2 puntos/
  );
});

test('rejects a GPS fix coarser than max_accuracy_m', () => {
  const location = question({
    question_type: 'location',
    validation_rules: { max_accuracy_m: 25 },
  });
  assert.equal(
    validateAnswer(location, {
      latitude: 19.4,
      longitude: -99.1,
      accuracy: 10,
      altitude: 2200,
    }),
    null
  );
  assert.match(
    validateAnswer(location, {
      latitude: 19.4,
      longitude: -99.1,
      accuracy: 80,
    }) ?? '',
    /25 m/
  );
});

test('reads GIS interval aliases and the CMS video duration key', () => {
  assert.equal(gisSampleIntervalMs({ sample_interval_s: 45 }), 45_000);
  assert.equal(gisSampleIntervalMs({ interval_s: 10 }), 30_000);
  assert.equal(maxDurationSeconds({ max_duration_seconds: 120 }), 120);
});

test('barcode pattern must match the whole value', () => {
  assert.equal(matchesBarcodePattern('ABC123', 'ABC'), false);
  assert.equal(matchesBarcodePattern('ABC', 'ABC'), true);
});

test('maps API default_expression onto the form engine field', () => {
  const version = {
    id: 1,
    version_number: 1,
    is_published: true,
    engine_version: 2,
    sections: [
      {
        id: 1,
        version_id: 1,
        section_key: 's',
        title: 'Sección',
        order: 0,
        questions: [
          question({
            question_type: 'text',
            default_expression: { today: [] },
            label_expression: { var: 'answers.nombre' },
            is_required_expr: { '==': [{ var: 'answers.flag' }, 1] },
            constraint_message: 'Fuera de rango',
          }),
        ],
      },
    ],
  } as SurveyVersion;

  const field = surveyVersionToFormSchema(version).sections[0].fields[0];
  assert.deepEqual(field.default_expression, { today: [] });
  assert.deepEqual(field.label_expression, { var: 'answers.nombre' });
  assert.equal(field.constraint_message, 'Fuera de rango');
  assert.ok(field.is_required_expr);
});
