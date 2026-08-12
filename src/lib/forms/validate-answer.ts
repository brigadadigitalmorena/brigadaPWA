/**
 * Client-side answer validation aligned with backend
 * `_validate_answer_by_rules` (response_service.py).
 * Blocks advance/finalize so invalid answers never reach the sync queue.
 */

import type { Question, ValidationRules } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d+\-() ]{7,20}$/;

const NUMERIC_TYPES = new Set([
  'number',
  'decimal',
  'slider',
  'scale',
  'rating',
  'edad',
]);

const DATE_TYPES = new Set(['date', 'fecha_nacimiento', 'datetime']);

function getRules(raw: unknown): ValidationRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as ValidationRules;
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isPlainEmptyObject(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return true;
  return entries.every((entry) => {
    if (isEmptyAnswerValue(entry)) return true;
    return isPlainEmptyObject(entry);
  });
}

export function isEmptyAnswerValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return isPlainEmptyObject(value);
}

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function ageInYears(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function parseAllowedValues(rules: ValidationRules): string[] {
  const raw = rules.allowed_values ?? rules.value_set;
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

/**
 * Validate an answer against question type + validation_rules.
 * Returns null when valid, or a Spanish error string when invalid.
 */
export function validateAnswer(
  question: Question,
  value: unknown
): string | null {
  const questionType = String(question.question_type ?? '');
  if (questionType === 'read_only' || questionType === 'data_list') {
    return null;
  }

  const rules = getRules(question.validation_rules);
  const required = Boolean(question.is_required);
  const empty = isEmptyAnswerValue(value);

  if (required && empty) {
    return 'Este campo es obligatorio';
  }
  if (!required && empty) {
    return null;
  }

  if (typeof value === 'string') {
    const minLength = toFiniteNumber(rules.min_length);
    if (minLength !== null && value.length < Math.floor(minLength)) {
      return `La respuesta debe tener al menos ${Math.floor(minLength)} caracteres`;
    }

    const maxLength = toFiniteNumber(rules.max_length);
    if (maxLength !== null && value.length > Math.floor(maxLength)) {
      return `La respuesta no puede superar ${Math.floor(maxLength)} caracteres`;
    }

    const allowedValues = parseAllowedValues(rules);
    if (
      allowedValues.length > 0 &&
      !allowedValues.includes(value.trim().toLowerCase())
    ) {
      return 'El valor no forma parte de la lista permitida';
    }

    const regexRule =
      (typeof rules.regex === 'string' && rules.regex.trim()
        ? rules.regex
        : null) ??
      (typeof rules.pattern === 'string' && rules.pattern.trim()
        ? rules.pattern
        : null);

    if (regexRule) {
      try {
        const dynamicRegex = new RegExp(`^(?:${regexRule})$`);
        if (!dynamicRegex.test(value)) {
          if (
            typeof rules.regex_message === 'string' &&
            rules.regex_message.trim()
          ) {
            return rules.regex_message.trim();
          }
          return 'El formato ingresado no cumple con la regla configurada';
        }
      } catch {
        return 'La configuración de validación regex es inválida';
      }
    } else {
      if (questionType === 'email' && !EMAIL_RE.test(value)) {
        return 'Ingresa un correo electrónico válido';
      }
      if (questionType === 'phone' && !PHONE_RE.test(value)) {
        return 'Ingresa un número de teléfono válido (7-20 dígitos)';
      }
    }
  }

  if (NUMERIC_TYPES.has(questionType)) {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) {
      return 'Ingresa un número válido';
    }

    const minValue = toFiniteNumber(rules.min);
    if (minValue !== null && numericValue < minValue) {
      return `El valor mínimo permitido es ${minValue}`;
    }

    const maxValue = toFiniteNumber(rules.max);
    if (maxValue !== null && numericValue > maxValue) {
      return `El valor máximo permitido es ${maxValue}`;
    }

    if (
      rules.integer_only &&
      questionType !== 'decimal' &&
      !Number.isInteger(numericValue)
    ) {
      return 'Ingresa un número entero válido';
    }

    const decimalPlaces = toFiniteNumber(rules.decimal_places);
    if (
      questionType === 'decimal' &&
      decimalPlaces !== null &&
      decimalPlaces >= 0
    ) {
      const textValue = String(value).trim();
      if (textValue.includes('.')) {
        const fractional = textValue.split('.', 2)[1] ?? '';
        if (fractional.length > Math.floor(decimalPlaces)) {
          return `Máximo ${Math.floor(decimalPlaces)} decimales permitidos`;
        }
      }
    }
  }

  if (Array.isArray(value)) {
    const minSelected =
      toFiniteNumber(rules.min_selected) ?? toFiniteNumber(rules.min_selections);
    if (minSelected !== null && value.length < Math.floor(minSelected)) {
      return `Selecciona al menos ${Math.floor(minSelected)} opciones`;
    }

    const maxSelected =
      toFiniteNumber(rules.max_selected) ?? toFiniteNumber(rules.max_selections);
    if (maxSelected !== null && value.length > Math.floor(maxSelected)) {
      return `Selecciona como máximo ${Math.floor(maxSelected)} opciones`;
    }
  }

  const minAge = toFiniteNumber(rules.min_age);
  const maxAge = toFiniteNumber(rules.max_age);
  const hasDateRestrictions =
    DATE_TYPES.has(questionType) ||
    questionType === 'fecha_nacimiento' ||
    Boolean(rules.not_future) ||
    typeof rules.min_date === 'string' ||
    typeof rules.max_date === 'string' ||
    minAge !== null ||
    maxAge !== null;

  if (hasDateRestrictions && !NUMERIC_TYPES.has(questionType)) {
    const dateValue = parseDateValue(value);
    if (!dateValue) {
      return 'Ingresa una fecha válida';
    }

    const now = new Date();
    if (rules.not_future && dateValue > now) {
      return 'La fecha no puede ser futura';
    }

    const minDate = parseDateValue(rules.min_date);
    if (minDate && dateValue < minDate) {
      return 'La fecha es anterior al mínimo permitido';
    }

    const maxDate = parseDateValue(rules.max_date);
    if (maxDate && dateValue > maxDate) {
      return 'La fecha supera el máximo permitido';
    }

    const age = ageInYears(dateValue, now);
    if (minAge !== null && age < Math.floor(minAge)) {
      return `La edad mínima permitida es ${Math.floor(minAge)} años`;
    }
    if (maxAge !== null && age > Math.floor(maxAge)) {
      return `La edad máxima permitida es ${Math.floor(maxAge)} años`;
    }
  }

  return null;
}

export function questionKeyOf(question: Question): string {
  return question.question_key || question.id.toString();
}
