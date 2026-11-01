import type { ValidationRules } from '@/lib/types';

/**
 * Apply the same `normalize_*` rules the mobile client and the CMS defaults
 * use before validation. Non-strings are returned unchanged.
 */
export function normalizeAnswerByRules(
  value: unknown,
  validationRulesRaw?: unknown
): unknown {
  if (typeof value !== 'string') return value;

  const rules = getRules(validationRulesRaw);
  let normalized = value;

  if (rules.normalize_trim) normalized = normalized.trim();
  if (rules.normalize_compact_spaces) {
    normalized = normalized.replace(/\s+/g, ' ');
  }
  if (rules.normalize_remove_spaces) {
    normalized = normalized.replace(/\s+/g, '');
  }
  if (rules.normalize_uppercase) normalized = normalized.toUpperCase();
  if (rules.normalize_lowercase) normalized = normalized.toLowerCase();
  if (rules.normalize_strip_accents) {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  if (rules.normalize_digits_only) {
    normalized = normalized.replace(/\D+/g, '');
  }

  const maxLength = toFiniteNumber(rules.max_length);
  if (maxLength !== null && maxLength >= 0) {
    normalized = normalized.slice(0, Math.floor(maxLength));
  }

  return normalized;
}

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
