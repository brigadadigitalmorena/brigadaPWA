'use client';

import { useMemo } from 'react';
import { useFormEngine, type UseFormEngineResult } from '@/lib/forms/FormEngine';
import type { SurveyVersion } from '@/lib/types';
import { surveyVersionToFormSchema } from '@/lib/forms/survey-to-form-schema';
import { useAuth } from '@/contexts/auth.context';

/**
 * Form Engine v2 adapter for PWA SurveyVersion schemas.
 */
export function useSurveyFormEngine(
  version: SurveyVersion | null,
  initialAnswers: Record<string, unknown> = {}
): UseFormEngineResult | null {
  const { user } = useAuth();
  const schema = useMemo(
    () => (version ? surveyVersionToFormSchema(version) : null),
    [version]
  );

  const currentUser = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: `${user.nombre} ${user.apellido}`.trim(),
            email: user.email,
            role: user.role_key,
          }
        : null,
    [user]
  );

  // Hooks can't be conditional — use a placeholder empty schema when null.
  const emptySchema = useMemo(
    () => ({
      version: '0',
      schema_version: 1,
      engine: 'brigada',
      engine_version: 2,
      settings: {},
      sections: [],
    }),
    []
  );

  const engine = useFormEngine(schema ?? emptySchema, initialAnswers, {
    currentUser,
  });

  if (!schema) return null;
  return engine;
}
