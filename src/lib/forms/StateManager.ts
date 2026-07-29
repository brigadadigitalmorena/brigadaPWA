/**
 * StateManager — single source of truth for form fill (Form Engine v2).
 *
 * B5 (2.2): reactive state for answers, visibility, and constraint errors.
 * Holds a flat map of all fields; consumers subscribe for change notifications.
 * Does NOT evaluate expressions — that is ExpressionEvaluator's responsibility.
 *
 * Rules:
 * - Every setter is no-op if the value didn't change (prevents unnecessary rerenders).
 * - `applyEvaluation()` performs a single atomic publish for a full recompute cycle.
 * - Max 200 lines.
 */

import type {
  FormSchemaFieldResponse,
  FormSchemaResponse,
} from './schema-types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Keyed by question_key (preferred) or "q:{question_id}" as fallback. */
export type AnswersMap = Record<string, unknown>;

/** true = field should be shown; false = hidden by relevance logic. */
export type VisibilityMap = Record<string, boolean>;

/** null = no error; string = constraint / required error message. */
export type ErrorMap = Record<string, string | null>;

export interface FormState {
  readonly answers: AnswersMap;
  readonly visibility: VisibilityMap;
  readonly errors: ErrorMap;
}

export type FormStateListener = (state: FormState) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable per-field key used in all maps. */
export function fieldKey(field: FormSchemaFieldResponse): string {
  return field.question_key ?? `q:${field.question_id}`;
}

/** Flatten all fields from all sections. */
export function getAllFields(
  schema: Pick<FormSchemaResponse, "sections">,
): FormSchemaFieldResponse[] {
  return schema.sections.flatMap((s) => s.fields);
}

// ─── StateManager ─────────────────────────────────────────────────────────────

export class StateManager {
  private _schema: FormSchemaResponse;
  private _state: FormState;
  private _listeners = new Set<FormStateListener>();

  constructor(schema: FormSchemaResponse, initialAnswers: AnswersMap = {}) {
    this._schema = schema;

    // Default all fields to visible — ExpressionEvaluator corrects on first sync.
    const visibility: VisibilityMap = {};
    for (const field of getAllFields(schema)) {
      visibility[fieldKey(field)] = true;
    }

    this._state = {
      answers: { ...initialAnswers },
      visibility,
      errors: {},
    };
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  get state(): Readonly<FormState> {
    return this._state;
  }

  get schema(): FormSchemaResponse {
    return this._schema;
  }

  isVisible(key: string): boolean {
    return this._state.visibility[key] !== false;
  }

  getAnswer(key: string): unknown {
    return this._state.answers[key];
  }

  getError(key: string): string | null {
    return this._state.errors[key] ?? null;
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  setAnswer(key: string, value: unknown): void {
    if (this._state.answers[key] === value) return;
    this._state = {
      ...this._state,
      answers: { ...this._state.answers, [key]: value },
    };
    this._publish();
  }

  setVisibility(key: string, visible: boolean): void {
    if (this._state.visibility[key] === visible) return;
    this._state = {
      ...this._state,
      visibility: { ...this._state.visibility, [key]: visible },
    };
    this._publish();
  }

  setError(key: string, error: string | null): void {
    const current = this._state.errors[key] ?? null;
    if (current === error) return;
    this._state = {
      ...this._state,
      errors: { ...this._state.errors, [key]: error },
    };
    this._publish();
  }

  /**
   * Apply a full visibility + errors patch in a single publish.
   * Called by ExpressionEvaluator after recomputing the whole form.
   * Skips publish when nothing changed.
   */
  applyEvaluation(patch: {
    visibility: VisibilityMap;
    errors: ErrorMap;
  }): void {
    let visChanged = false;
    let errChanged = false;

    for (const [k, v] of Object.entries(patch.visibility)) {
      if (this._state.visibility[k] !== v) {
        visChanged = true;
        break;
      }
    }
    for (const [k, v] of Object.entries(patch.errors)) {
      if ((this._state.errors[k] ?? null) !== v) {
        errChanged = true;
        break;
      }
    }

    if (!visChanged && !errChanged) return;

    this._state = {
      ...this._state,
      visibility: visChanged
        ? { ...this._state.visibility, ...patch.visibility }
        : this._state.visibility,
      errors: errChanged
        ? { ...this._state.errors, ...patch.errors }
        : this._state.errors,
    };
    this._publish();
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────

  subscribe(listener: FormStateListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _publish(): void {
    const snap = this._state;
    for (const fn of this._listeners) fn(snap);
  }
}
