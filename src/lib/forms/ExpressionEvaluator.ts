/**
 * ExpressionEvaluator — lazy + memoized JSONLogic evaluator for Form Engine v2.
 *
 * B6 (2.3): wraps the v2 runtime from lib/forms/jsonlogic.ts.
 * Evaluates: relevance, constraint, calculated, label_expression,
 *            default_expression, is_required_expr.
 *
 * Security: all evaluation is guarded by the runtime's depth/node/forbidden
 * checks. Evaluation errors are fail-open (field stays visible / valid).
 *
 * Cache:
 * - Key = JSON(expression) + "|" + JSON(answers)
 * - Bounded to 1 000 entries; oldest entry evicted on overflow.
 * - `invalidate()` clears the entire cache (call when answers are reset).
 */

import type {
  FormSchemaFieldResponse,
  FormSchemaResponse,
} from './schema-types';
import { ERROR_KEYS } from './error-keys';
import {
  evaluateJsonLogicExpression,
  setCurrentUserForEvaluation,
  type JsonLogicCurrentUser,
} from './jsonlogic';
import type { AnswersMap, ErrorMap, VisibilityMap } from './StateManager';
import { fieldKey } from './StateManager';

// ─── Internal helpers ─────────────────────────────────────────────────────────

const CACHE_MAX = 1_000;

function toKey(expression: unknown, answers: AnswersMap): string {
  return `${JSON.stringify(expression)}|${JSON.stringify(answers)}`;
}

// ─── ExpressionEvaluator ──────────────────────────────────────────────────────

export class ExpressionEvaluator {
  private _cache = new Map<string, unknown>();

  /** DOC20-D09 — authenticated user injected by FormEngine from AuthContext. */
  private _currentUser: JsonLogicCurrentUser | null = null;

  /** Data lists from survey_versions.data_lists — available to JSONLogic as { data_lists } */
  private _dataLists: Record<string, unknown> = {};

  /** Provide data_lists so JSONLogic expressions can reference them. */
  setDataLists(dataLists: Record<string, unknown>): void {
    this._dataLists = dataLists;
    this._cache.clear();
  }

  /** Update the user context used by current_user_* / user_* ops. */
  setUser(user: JsonLogicCurrentUser | null): void {
    this._currentUser = user;
    // Invalidate cache so the next recompute picks up the new user identity.
    this._cache.clear();
  }

  // ── Low-level memoized eval ────────────────────────────────────────────────

  private _eval(
    expression: Record<string, unknown>,
    answers: AnswersMap,
  ): unknown {
    const key = toKey(expression, answers);
    if (this._cache.has(key)) return this._cache.get(key);

    // DOC20-D09 — inject user identity before evaluation so ops can resolve it.
    setCurrentUserForEvaluation(this._currentUser);
    const result = evaluateJsonLogicExpression(expression, { answers, data_lists: this._dataLists });

    if (this._cache.size >= CACHE_MAX) {
      const first = this._cache.keys().next().value;
      if (first != null) this._cache.delete(first);
    }
    this._cache.set(key, result);
    return result;
  }

  private _evalBool(
    expression: Record<string, unknown> | null | undefined,
    answers: AnswersMap,
    fallback: boolean,
  ): boolean {
    if (!expression || typeof expression !== "object") return fallback;
    if (Object.keys(expression).length === 0) return fallback;
    try {
      return Boolean(
        this._eval(expression as Record<string, unknown>, answers),
      );
    } catch {
      return fallback; // fail-open
    }
  }

  // ── Per-field evaluators ───────────────────────────────────────────────────

  /**
   * Returns true when the field should be shown.
   * Missing / invalid expression → fail-open (visible).
   */
  isVisible(field: FormSchemaFieldResponse, answers: AnswersMap): boolean {
    return this._evalBool(
      field.relevance as Record<string, unknown> | undefined,
      answers,
      true,
    );
  }

  /**
   * Evaluates constraint expression; returns error string or null.
   * Fail-open: expression errors never block submission.
   *
   * Skips evaluation when the answer is empty (null / undefined / "" / []).
   * Empty values are the responsibility of the `required` check, not constraint.
   */
  checkConstraint(
    field: FormSchemaFieldResponse,
    answers: AnswersMap,
  ): string | null {
    if (!field.constraint) return null;

    // Skip constraint for empty answers — those are handled by `required`.
    const key = fieldKey(field);
    const value = answers[key];
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return null;
    }

    const passes = this._evalBool(
      field.constraint as Record<string, unknown>,
      answers,
      true,
    );
    if (!passes) {
      // DD-08: author constraint_message always wins; fall back to canonical key
      // so translateError() can humanize it at the display layer.
      return (
        (typeof field.constraint_message === "string" &&
          field.constraint_message) ||
        ERROR_KEYS.CONSTRAINT_COMPARISON_FAILED
      );
    }
    return null;
  }

  /**
   * Evaluates `calculated` expression and returns the computed value.
   * Returns `undefined` when the field has no `calculated` expression
   * or when evaluation fails (fail-open).
   */
  resolveCalculated(
    field: FormSchemaFieldResponse,
    answers: AnswersMap,
  ): unknown {
    if (!field.calculated) return undefined;
    try {
      return this._eval(field.calculated as Record<string, unknown>, answers);
    } catch {
      return undefined;
    }
  }

  /** Dynamic label; falls back to static `field.label` on any error. */
  resolveLabel(field: FormSchemaFieldResponse, answers: AnswersMap): string {
    if (!field.label_expression) return field.label;
    try {
      const result = this._eval(
        field.label_expression as Record<string, unknown>,
        answers,
      );
      return typeof result === "string" ? result : field.label;
    } catch {
      return field.label;
    }
  }

  /** Default value for a field — null when absent or on error. */
  resolveDefault(field: FormSchemaFieldResponse, answers: AnswersMap): unknown {
    if (field.default_expression) {
      try {
        return this._eval(
          field.default_expression as Record<string, unknown>,
          answers,
        );
      } catch {
        // fall through to static default
      }
    }
    return (field as unknown as Record<string, unknown>)["default"] ?? null;
  }

  /** Whether the field is currently required (static bool or dynamic expr). */
  isRequired(field: FormSchemaFieldResponse, answers: AnswersMap): boolean {
    return this._evalBool(
      field.is_required_expr as Record<string, unknown> | undefined,
      answers,
      field.required,
    );
  }

  // ── Batch recompute ────────────────────────────────────────────────────────

  /**
   * Evaluate all fields in one pass.
   * Returns a patch ready for StateManager.applyEvaluation() plus the set of
   * `calculated` field values that should be written back into the answers map.
   *
   * - `visibility[key]` for each field
   * - `errors[key]` is null when the field is hidden or constraint passes
   * - `calculated[key]` only contains entries for fields with a `calculated`
   *   expression that produced a non-undefined value
   */
  recompute(
    schema: Pick<FormSchemaResponse, "sections">,
    answers: AnswersMap,
  ): {
    visibility: VisibilityMap;
    errors: ErrorMap;
    calculated: AnswersMap;
  } {
    const visibility: VisibilityMap = {};
    const errors: ErrorMap = {};
    const calculated: AnswersMap = {};

    for (const section of schema.sections) {
      for (const field of section.fields) {
        const key = fieldKey(field);
        const visible = this.isVisible(field, answers);
        visibility[key] = visible;
        errors[key] = visible ? this.checkConstraint(field, answers) : null;

        if (visible && field.calculated) {
          const value = this.resolveCalculated(field, answers);
          if (value !== undefined) {
            calculated[key] = value;
          }
        }
      }
    }

    return { visibility, errors, calculated };
  }

  /** Clear memo cache — call when the answers state is fully reset. */
  invalidate(): void {
    this._cache.clear();
  }
}
