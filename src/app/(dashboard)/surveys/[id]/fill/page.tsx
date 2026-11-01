'use client';

import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Navigation, Save } from 'lucide-react';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { isAxiosError } from 'axios';

import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { useSync } from '@/contexts/sync.context';
import { loadSurveyForFill } from '@/lib/api/survey.service';
import {
  finalizeResponse,
  buildDeviceInfo,
} from '@/lib/services/response-submission.service';
import { useFieldSessionGate } from '@/hooks/use-field-session-gate';
import { useFieldSession } from '@/hooks/use-field-session';
import { isAutoAdvanceType } from '@/lib/survey/field-types';
import { useSurveyFormEngine } from '@/lib/forms/use-survey-form-engine';
import { normalizeAnswerByRules } from '@/lib/forms/normalize-answer';
import { visibleAnswerKeySet } from '@/lib/forms/prune-hidden-answers';
import {
  coerceYesNoValue,
  questionKeyOf,
  validateAnswer,
} from '@/lib/forms/validate-answer';
import { applyOcrAutofill, isIneQuestionType } from '@/lib/forms/ine-answer';
import { getRendererKind, normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { parseOptionalScopeId } from '@/lib/campaigns/scope';
import { QuestionRenderer } from '@/components/survey/QuestionTypes/question-renderer';
import { SurveyFillHeader } from '@/components/survey/survey-fill-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoadingState } from '@/components/common/loading-state';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function SurveyFillPage() {
  return (
    <Suspense fallback={<LoadingState message="Cargando encuesta..." />}>
      <SurveyFillPageContent />
    </Suspense>
  );
}

let pendingFillReset: ReturnType<typeof setTimeout> | null = null;

function SurveyFillPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = params.id as string;
  const titleFromUrl = searchParams.get('title');
  const campaignId = parseOptionalScopeId(searchParams.get('campaignId'));
  const entitlementId = parseOptionalScopeId(searchParams.get('entitlementId'));
  const campaignNameFromUrl = searchParams.get('campaign');
  const resumeDraftId = searchParams.get('resumeDraftId');
  const [surveyTitle, setSurveyTitle] = useState<string>(titleFromUrl ?? 'Encuesta');
  const [isOpening, setIsOpening] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    version,
    responseId,
    currentQuestionIndex,
    answers,
    files,
    location,
    startedAt,
    isLoading,
    error,
    isHydrated,
    init,
    saveDraft,
    setAnswer,
    nextQuestion,
    prevQuestion,
    goToSection,
    goToQuestion,
    getFillableQuestions,
    getCurrentQuestionEntry,
    getProgress,
    reset,
  } = useSurveyFillStore();

  const { isOnline, syncNow } = useSync();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const keyboardInset = useKeyboardInset();
  const { confirm, confirmDialog } = useConfirmDialog();

  // Form Engine v2 — keeps visibility/constraints aligned with mobile
  const formEngine = useSurveyFormEngine(version, answers);

  const fillableQuestions = getFillableQuestions();
  const currentEntry = getCurrentQuestionEntry();
  const currentQuestion = currentEntry?.question ?? null;
  const shownQuestion = currentQuestion
    ? {
        ...currentQuestion,
        question_text:
          formEngine?.getLabel(questionKeyOf(currentQuestion)) ||
          currentQuestion.question_text,
        is_required:
          formEngine?.isRequired(questionKeyOf(currentQuestion)) ??
          currentQuestion.is_required,
      }
    : null;
  const totalQuestions = fillableQuestions.length;
  const progress = getProgress();
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion =
    totalQuestions === 0 || currentQuestionIndex >= totalQuestions - 1;
  const currentSectionIndex = currentEntry?.sectionIndex ?? 0;

  const showSectionHeader = useMemo(() => {
    if (!currentEntry) return false;
    if (currentQuestionIndex === 0) return true;
    const previousEntry = fillableQuestions[currentQuestionIndex - 1];
    return previousEntry?.sectionKey !== currentEntry.sectionKey;
  }, [currentEntry, currentQuestionIndex, fillableQuestions]);

  const {
    control,
    handleSubmit,
    reset: resetForm,
    trigger,
    getValues,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: answers,
    mode: 'onChange',
  });

  useEffect(() => {
    if (pendingFillReset) {
      clearTimeout(pendingFillReset);
      pendingFillReset = null;
    }

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      pendingFillReset = setTimeout(() => {
        reset();
        pendingFillReset = null;
      }, 0);
    };
  }, [surveyId, reset]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsOpening(true);
      setLoadError(null);
      try {
        const { title, version } = await loadSurveyForFill(
          Number(surveyId),
          titleFromUrl,
          { campaignId, entitlementId }
        );

        if (mounted) {
          setSurveyTitle(title);
          await init(surveyId, version, { resumeDraftId });
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to load survey:', err);
          const message = isAxiosError(err)
            ? err.response?.status === 403
              ? 'No tienes permiso para acceder a esta encuesta.'
              : err.response?.status === 404
                ? 'No hay una versión publicada disponible para esta encuesta.'
                : 'Error al cargar la encuesta'
            : 'Error al cargar la encuesta';
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (mounted) setIsOpening(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [surveyId, init, titleFromUrl, campaignId, entitlementId, resumeDraftId]);

  // FIELD-TRACK-1 — surveys tied to a route activity may require an open
  // recorrido before any data is captured.
  const fieldSessionGate = useFieldSessionGate(surveyId, Boolean(version), {
    campaignId,
    entitlementId,
  });
  const { session: activeFieldSession, pendingSamples: pendingRouteSamples } =
    useFieldSession();

  useEffect(() => {
    resetForm(answers);
  }, [answers, resetForm]);

  useEffect(() => {
    if (!currentQuestion) return;
    const key = questionKeyOf(currentQuestion);
    const kind = getRendererKind(currentQuestion.question_type);
    if (kind !== 'media' && kind !== 'signature') return;
    const attached = files[key];
    if (!attached?.length) return;
    const ids = attached.map((file) => file.fileId);
    const current = getValues(key);
    const same =
      Array.isArray(current) &&
      current.length === ids.length &&
      current.every((id, index) => id === ids[index]);
    if (same) return;
    setValue(key, ids, { shouldDirty: false, shouldValidate: true });
    setAnswer(key, ids);
  }, [currentQuestion, files, getValues, setValue, setAnswer]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !form.contains(target)) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 250);
    };
    form.addEventListener('focusin', onFocus);
    return () => form.removeEventListener('focusin', onFocus);
  }, [isOpening, currentQuestionIndex]);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = setTimeout(() => {
      saveDraft();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [answers, files, isHydrated, saveDraft]);

  const scrollToFirstError = () => {
    const firstError = formRef.current?.querySelector('[aria-invalid="true"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getFieldValidationMessage = (
    question: NonNullable<typeof currentQuestion>,
    value: unknown
  ): string | null => {
    const engineKey = questionKeyOf(question);
    const engineError = formEngine?.getError?.(engineKey);
    if (typeof engineError === 'string' && engineError.trim()) {
      return engineError === 'CONSTRAINT_COMPARISON_FAILED'
        ? 'La respuesta no cumple la condición de la pregunta'
        : engineError;
    }
    const kind = getRendererKind(question.question_type);
    const attached = useSurveyFillStore.getState().files[engineKey];
    const effective =
      (kind === 'media' || kind === 'signature') && attached && attached.length > 0
        ? attached.map((file) => file.fileId)
        : value;
    const normalized = normalizeAnswerByRules(
      effective,
      question.validation_rules
    );
    const required =
      formEngine?.isRequired(engineKey) ?? Boolean(question.is_required);
    return validateAnswer(
      required === question.is_required
        ? question
        : { ...question, is_required: required },
      normalized
    );
  };

  const finalizeSurvey = async () => {
    if (!version || !responseId || !startedAt) {
      toast.error('Faltan datos para finalizar la encuesta');
      return;
    }

    const snapshot = useSurveyFillStore.getState();
    const formValues = getValues();
    const mergedAnswers: Record<string, unknown> = { ...snapshot.answers };
    for (const [key, value] of Object.entries(formValues)) {
      if (value !== undefined) mergedAnswers[key] = value;
    }
    for (const entry of fillableQuestions) {
      const key = questionKeyOf(entry.question);
      if (normalizeQuestionType(entry.question.question_type) !== 'yes_no') {
        continue;
      }
      const coerced = coerceYesNoValue(mergedAnswers[key]);
      if (coerced !== undefined) mergedAnswers[key] = coerced;
    }

    for (let index = 0; index < fillableQuestions.length; index += 1) {
      const entry = fillableQuestions[index];
      const key = questionKeyOf(entry.question);
      const synced = syncAttachedFiles(entry.question);
      const raw = synced === undefined ? mergedAnswers[key] : synced;
      const value = normalizeAnswerByRules(raw, entry.question.validation_rules);
      mergedAnswers[key] = value;
      const message = getFieldValidationMessage(entry.question, value);
      if (message) {
        goToQuestion(index);
        setError(key, { type: 'validate', message });
        scrollToFirstError();
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await finalizeResponse({
        responseId,
        surveyId,
        version,
        answers: mergedAnswers,
        files: snapshot.files,
        location: snapshot.location,
        startedAt,
        deviceInfo: buildDeviceInfo(),
        campaignId,
        entitlementId,
        visibleAnswerKeys: formEngine
          ? Array.from(visibleAnswerKeySet(formEngine.visibleFields))
          : undefined,
      });

      toast.success('Encuesta guardada. Sincronizando...');

      if (isOnline) {
        syncNow().catch(() => {
          // Background sync will retry later.
        });
      }

      router.push('/surveys');
    } catch (err) {
      console.error('Failed to finalize response:', err);
      toast.error(
        err instanceof Error ? err.message : 'Error al finalizar la encuesta'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceOrFinalize = async () => {
    if (!isLastQuestion) {
      nextQuestion();
      return;
    }

    await finalizeSurvey();
  };

  const syncAttachedFiles = (
    question: NonNullable<typeof currentQuestion>
  ): unknown => {
    const questionKey = questionKeyOf(question);
    const kind = getRendererKind(question.question_type);
    if (kind !== 'media' && kind !== 'signature') {
      return getValues(questionKey);
    }
    const attached = useSurveyFillStore.getState().files[questionKey];
    if (!attached?.length) return getValues(questionKey);
    const ids = attached.map((file) => file.fileId);
    setValue(questionKey, ids, { shouldDirty: true, shouldValidate: false });
    setAnswer(questionKey, ids);
    return ids;
  };

  const handleNext = async () => {
    if (!currentQuestion) return;

    const questionKey = questionKeyOf(currentQuestion);
    const raw = syncAttachedFiles(currentQuestion);
    const value = normalizeAnswerByRules(raw, currentQuestion.validation_rules);
    setValue(questionKey, value, { shouldDirty: true, shouldValidate: false });
    setAnswer(questionKey, value);
    const message = getFieldValidationMessage(currentQuestion, value);

    if (message) {
      setError(questionKey, { type: 'validate', message });
      await trigger(questionKey);
      scrollToFirstError();
      return;
    }

    const valid = await trigger(questionKey);
    if (!valid) {
      scrollToFirstError();
      return;
    }

    setAnswer(questionKey, value);
    formEngine?.setAnswer(questionKey, value);
    await advanceOrFinalize();
  };

  const handleAutoAdvance = (questionKey: string, value: unknown) => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    autoAdvanceTimeoutRef.current = setTimeout(async () => {
      if (!currentQuestion) return;
      const prepared = normalizeAnswerByRules(
        value,
        currentQuestion.validation_rules
      );
      if (prepared !== value) {
        setValue(questionKey, prepared, {
          shouldDirty: true,
          shouldValidate: false,
        });
        setAnswer(questionKey, prepared);
      }
      const message = getFieldValidationMessage(currentQuestion, prepared);
      if (message) {
        setError(questionKey, { type: 'validate', message });
        return;
      }
      const valid = await trigger(questionKey);
      if (!valid) return;
      setAnswer(questionKey, prepared);
      formEngine?.setAnswer(questionKey, prepared);
      await advanceOrFinalize();
    }, 350);
  };

  const handleSaveDraft = async () => {
    await saveDraft();
    toast.success('Borrador guardado');
  };

  const handleExit = async () => {
    if (!isFirstQuestion) {
      prevQuestion();
      return;
    }

    if (isDirty) {
      const confirmed = await confirm({
        title: 'Salir de la encuesta',
        description: 'Tienes cambios sin guardar. ¿Deseas salir de todos modos?',
        confirmText: 'Salir',
        cancelText: 'Continuar',
        variant: 'warning',
      });

      if (!confirmed) return;
    }

    router.push('/surveys');
  };

  if (isOpening || isLoading) {
    return <LoadingState message="Cargando encuesta..." />;
  }

  if (loadError || error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">Error</CardTitle>
            <CardDescription className="text-base">
              {loadError || error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/surveys')}
              variant="outline"
              size="mobile"
              className="w-full"
            >
              Volver a encuestas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl text-center">
          <CardHeader>
            <CardTitle className="text-xl">Encuesta no disponible</CardTitle>
            <CardDescription className="text-base">
              No se encontró la versión activa de esta encuesta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/surveys')}
              variant="outline"
              size="mobile"
              className="w-full"
            >
              Volver a encuestas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fieldSessionGate.blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-lg rounded-2xl text-center">
          <CardHeader>
            <Navigation className="mx-auto mb-2 h-9 w-9 text-primary" />
            <CardTitle>Este trabajo requiere un recorrido</CardTitle>
            <CardDescription>
              Inícialo ahora para registrar la ruta y vincular esta respuesta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              size="mobile"
              disabled={fieldSessionGate.starting}
              onClick={() => void fieldSessionGate.startRequiredSession()}
            >
              {fieldSessionGate.starting ? 'Iniciando…' : 'Iniciar recorrido'}
            </Button>
            <Button
              className="w-full"
              size="mobile"
              variant="outline"
              onClick={() => router.replace('/surveys')}
            >
              Volver a encuestas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl text-center">
          <CardHeader>
            <CardTitle className="text-xl">Sin preguntas</CardTitle>
            <CardDescription className="text-base">
              Esta encuesta no tiene preguntas disponibles para responder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/surveys')} variant="outline" size="mobile" className="w-full">
              Volver a encuestas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen min-h-screen bg-muted/20">
      <SurveyFillHeader
        surveyTitle={surveyTitle}
        campaignName={campaignNameFromUrl}
        progress={progress}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={totalQuestions}
        sections={version.sections}
        currentSectionIndex={currentSectionIndex}
        onGoToSection={goToSection}
        fieldSession={
          activeFieldSession
            ? {
                sampleCount: activeFieldSession.sample_count,
                pendingSamples: pendingRouteSamples,
              }
            : null
        }
      />

      {showSectionHeader && currentEntry && (
        <div className="px-4 pt-4 pb-2">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              {currentEntry.sectionTitle}
            </h2>
            {currentEntry.sectionDescription && (
              <p className="text-base text-muted-foreground mt-1 leading-relaxed">
                {currentEntry.sectionDescription}
              </p>
            )}
          </div>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit(() => handleNext())}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {shownQuestion && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm min-h-[50vh] flex flex-col justify-center">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex-shrink-0">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-xs font-medium text-primary uppercase tracking-wide pt-1.5">
                Pregunta {currentQuestionIndex + 1} de {totalQuestions}
              </span>
            </div>

            <Controller
              name={questionKeyOf(shownQuestion)}
              control={control}
              rules={{
                required:
                  shownQuestion.is_required &&
                  normalizeQuestionType(shownQuestion.question_type) !==
                    'yes_no' &&
                  !isIneQuestionType(shownQuestion.question_type)
                    ? 'Este campo es obligatorio'
                    : false,
                validate: (value) =>
                  getFieldValidationMessage(shownQuestion, value) ?? true,
              }}
              render={({ field }) => {
                const questionKey = questionKeyOf(shownQuestion);

                return (
                  <QuestionRenderer
                    question={shownQuestion}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      setAnswer(questionKey, value);
                      formEngine?.setAnswer(questionKey, value);

                      if (isIneQuestionType(shownQuestion.question_type)) {
                        const allQuestions =
                          version?.sections?.flatMap(
                            (section) => section.questions ?? []
                          ) ?? [];
                        const autofillUpdates = applyOcrAutofill({
                          sourceQuestionKey: questionKey,
                          sourceValue: value,
                          fields: allQuestions,
                          answers: {
                            ...useSurveyFillStore.getState().answers,
                            [questionKey]: value,
                          },
                        });
                        for (const [targetKey, targetValue] of Object.entries(
                          autofillUpdates
                        )) {
                          setAnswer(targetKey, targetValue);
                          formEngine?.setAnswer(targetKey, targetValue);
                          setValue(targetKey, targetValue, {
                            shouldDirty: true,
                          });
                        }
                      }

                      if (
                        !isLastQuestion &&
                        isAutoAdvanceType(shownQuestion.question_type) &&
                        value !== null &&
                        value !== undefined &&
                        value !== ''
                      ) {
                        handleAutoAdvance(questionKey, value);
                      }
                    }}
                    error={errors[questionKey]?.message as string}
                  />
                );
              }}
            />
          </div>
        )}

        <div className="h-4" />
      </form>

      <div
        className="z-30 border-t bg-background/95 backdrop-blur px-3 py-3 safe-area-bottom"
        style={
          keyboardInset > 0
            ? { position: 'fixed', left: 0, right: 0, bottom: keyboardInset }
            : { position: 'sticky', bottom: 0 }
        }
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleExit}
            disabled={isSubmitting}
            className="h-14 min-w-0 flex-1 gap-1 px-3 text-base"
          >
            <ChevronLeft className="h-5 w-5 shrink-0" />
            {isFirstQuestion ? 'Salir' : 'Anterior'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            aria-label="Guardar borrador"
            className="h-14 shrink-0 gap-1.5 px-3 text-sm"
          >
            <Save className="size-5 shrink-0" strokeWidth={2} />
            Borrador
          </Button>

          <Button
            type="button"
            size="lg"
            className="h-14 min-w-0 flex-1 gap-1 px-3 text-base"
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Guardando...'
              : isLastQuestion
                ? 'Finalizar'
                : 'Siguiente'}
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
