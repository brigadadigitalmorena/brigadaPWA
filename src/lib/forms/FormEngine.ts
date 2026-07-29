/**
 * FormEngine — orchestrator for Form Engine v2 (portable, no Sentry).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FormSchemaFieldResponse,
  FormSchemaResponse,
} from './schema-types';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import type { JsonLogicCurrentUser } from './jsonlogic';
import {
  StateManager,
  fieldKey,
  getAllFields,
  type AnswersMap,
  type FormState,
} from './StateManager';

export interface FieldMeta {
  field: FormSchemaFieldResponse;
  key: string;
  answer: unknown;
  error: string | null;
  label: string;
  required: boolean;
}

export interface UseFormEngineResult {
  visibleFields: FieldMeta[];
  allFields: FieldMeta[];
  setAnswer: (key: string, value: unknown) => void;
  getAnswer: (key: string) => unknown;
  getError: (key: string) => string | null;
  isVisible: (key: string) => boolean;
  getLabel: (key: string) => string;
  isRequired: (key: string) => boolean;
  isCalculated: (key: string) => boolean;
  hasErrors: () => boolean;
  reset: (initialAnswers?: AnswersMap) => void;
  answers: AnswersMap;
}

export function useFormEngine(
  schema: FormSchemaResponse,
  initial: AnswersMap = {},
  options?: { currentUser?: JsonLogicCurrentUser | null }
): UseFormEngineResult {
  const smRef = useRef<StateManager | null>(null);
  const evRef = useRef<ExpressionEvaluator | null>(null);

  const schemaRef = useRef<FormSchemaResponse>(schema);
  if (smRef.current === null || schemaRef.current !== schema) {
    schemaRef.current = schema;
    smRef.current = new StateManager(schema, initial);
    evRef.current = new ExpressionEvaluator();
    evRef.current.setDataLists(schema.data_lists ?? {});
    evRef.current.setUser(options?.currentUser ?? null);
    _applyDefaults(smRef.current, evRef.current, initial);
    _runRecompute(smRef.current, evRef.current, schema);
  }

  const [formState, setFormState] = useState<FormState>(
    () => smRef.current!.state
  );
  const [smVersion, setSmVersion] = useState(0);

  useEffect(() => {
    const sm = smRef.current!;
    return sm.subscribe((s) => setFormState(s));
  }, [schema, smVersion]);

  const currentUser = options?.currentUser;
  useEffect(() => {
    evRef.current?.setUser(currentUser ?? null);
  }, [currentUser]);

  const setAnswer = useCallback((key: string, value: unknown) => {
    const sm = smRef.current!;
    const ev = evRef.current!;
    sm.setAnswer(key, value);
    _runRecompute(sm, ev, schemaRef.current);
  }, []);

  const getAnswer = useCallback(
    (key: string) => formState.answers[key],
    [formState.answers]
  );

  const getError = useCallback(
    (key: string) => formState.errors[key] ?? null,
    [formState.errors]
  );

  const isVisible = useCallback(
    (key: string) => formState.visibility[key] !== false,
    [formState.visibility]
  );

  const reset = useCallback((initialAnswers: AnswersMap = {}) => {
    const ev = evRef.current!;
    ev.invalidate();
    smRef.current = new StateManager(schemaRef.current, initialAnswers);
    _applyDefaults(smRef.current, ev, initialAnswers);
    _runRecompute(smRef.current, ev, schemaRef.current);
    setFormState(smRef.current.state);
    setSmVersion((v) => v + 1);
  }, []);

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FormSchemaFieldResponse>();
    for (const f of getAllFields(schema)) map.set(fieldKey(f), f);
    return map;
  }, [schema]);

  const getLabel = useCallback(
    (key: string): string => {
      const f = fieldsByKey.get(key);
      if (!f) return '';
      return evRef.current!.resolveLabel(f, formState.answers);
    },
    [fieldsByKey, formState.answers]
  );

  const isRequired = useCallback(
    (key: string): boolean => {
      const f = fieldsByKey.get(key);
      if (!f) return false;
      return evRef.current!.isRequired(f, formState.answers);
    },
    [fieldsByKey, formState.answers]
  );

  const isCalculated = useCallback(
    (key: string): boolean => {
      const f = fieldsByKey.get(key);
      return Boolean(f?.calculated);
    },
    [fieldsByKey]
  );

  const hasErrors = useCallback((): boolean => {
    for (const [k, err] of Object.entries(formState.errors)) {
      if (err && formState.visibility[k] !== false) return true;
    }
    return false;
  }, [formState.errors, formState.visibility]);

  const allFields: FieldMeta[] = useMemo(() => {
    const ev = evRef.current!;
    return getAllFields(schema).map((field) => {
      const key = fieldKey(field);
      return {
        field,
        key,
        answer: formState.answers[key],
        error: formState.errors[key] ?? null,
        label: ev.resolveLabel(field, formState.answers),
        required: ev.isRequired(field, formState.answers),
      };
    });
  }, [schema, formState]);

  const visibleFields = useMemo(
    () => allFields.filter((m) => formState.visibility[m.key] !== false),
    [allFields, formState.visibility]
  );

  return {
    visibleFields,
    allFields,
    setAnswer,
    getAnswer,
    getError,
    isVisible,
    getLabel,
    isRequired,
    isCalculated,
    hasErrors,
    reset,
    answers: formState.answers,
  };
}

function _runRecompute(
  sm: StateManager,
  ev: ExpressionEvaluator,
  schema: FormSchemaResponse
): void {
  let iterations = 0;
  while (iterations < 5) {
    const patch = ev.recompute(schema, sm.state.answers);
    let calcChanged = false;
    for (const [k, v] of Object.entries(patch.calculated)) {
      if (sm.state.answers[k] !== v) {
        sm.setAnswer(k, v);
        calcChanged = true;
      }
    }
    if (!calcChanged) {
      sm.applyEvaluation({
        visibility: patch.visibility,
        errors: patch.errors,
      });
      return;
    }
    iterations++;
  }
  const finalPatch = ev.recompute(schema, sm.state.answers);
  sm.applyEvaluation({
    visibility: finalPatch.visibility,
    errors: finalPatch.errors,
  });
}

function _applyDefaults(
  sm: StateManager,
  ev: ExpressionEvaluator,
  existing: AnswersMap
): void {
  for (const field of getAllFields(sm.schema)) {
    const key = fieldKey(field);
    if (key in existing) continue;
    const defaultValue = ev.resolveDefault(field, existing);
    if (defaultValue !== null && defaultValue !== undefined) {
      sm.setAnswer(key, defaultValue);
    }
  }
}

export type { AnswersMap, FormState };
export type { FormSchemaResponse, FormSchemaFieldResponse } from './schema-types';
