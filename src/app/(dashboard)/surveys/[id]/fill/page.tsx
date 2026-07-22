'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { isAxiosError } from 'axios';

import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { useSync } from '@/contexts/sync.context';
import { loadSurveyForFill } from '@/lib/api/survey.service';
import {
  finalizeResponse,
  buildDeviceInfo,
} from '@/lib/services/response-submission.service';
import { isAutoAdvanceType } from '@/lib/survey/field-types';
import { QuestionRenderer } from '@/components/survey/QuestionTypes/question-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoadingState } from '@/components/common/loading-state';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

export default function SurveyFillPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = params.id as string;
  const titleFromUrl = searchParams.get('title');
  const [surveyTitle, setSurveyTitle] = useState<string>(titleFromUrl ?? 'Encuesta');
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
    getFillableQuestions,
    getCurrentQuestionEntry,
    getProgress,
    reset,
  } = useSurveyFillStore();

  const { isOnline, syncNow } = useSync();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const fillableQuestions = getFillableQuestions();
  const currentEntry = getCurrentQuestionEntry();
  const currentQuestion = currentEntry?.question ?? null;
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
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: answers,
    mode: 'onChange',
  });

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      reset();
    };
  }, [reset]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { title, version } = await loadSurveyForFill(
          Number(surveyId),
          titleFromUrl
        );

        if (mounted) {
          setSurveyTitle(title);
          await init(surveyId, version);
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
          toast.error(message);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [surveyId, init, titleFromUrl]);

  useEffect(() => {
    resetForm(answers);
  }, [answers, resetForm]);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = setTimeout(() => {
      saveDraft();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [answers, isHydrated, saveDraft]);

  const scrollToFirstError = () => {
    const firstError = formRef.current?.querySelector('[aria-invalid="true"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const finalizeSurvey = async () => {
    if (!version || !responseId || !startedAt) {
      toast.error('Faltan datos para finalizar la encuesta');
      return;
    }

    setIsSubmitting(true);

    try {
      await finalizeResponse({
        responseId,
        surveyId,
        version,
        answers,
        files,
        location,
        startedAt,
        deviceInfo: buildDeviceInfo(),
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

  const handleNext = async () => {
    if (!currentQuestion) return;

    const questionKey =
      currentQuestion.question_key || currentQuestion.id.toString();
    const valid = await trigger(questionKey);

    if (!valid) {
      toast.error('Completa el campo obligatorio antes de continuar');
      scrollToFirstError();
      return;
    }

    const value = getValues(questionKey);
    setAnswer(questionKey, value);
    await advanceOrFinalize();
  };

  const handleAutoAdvance = (questionKey: string, value: unknown) => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    autoAdvanceTimeoutRef.current = setTimeout(async () => {
      const valid = await trigger(questionKey);
      if (!valid) return;
      setAnswer(questionKey, value);
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

  if (isLoading) {
    return <LoadingState message="Cargando encuesta..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">Error</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
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
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 pt-3 pb-2 safe-area-top">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold truncate pr-4 text-foreground">
            {surveyTitle}
          </h1>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm font-medium text-primary">
              {Math.round(progress)}%
            </span>
            <span className="text-sm text-muted-foreground">
              {currentQuestionIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {version.sections?.map((section, index) => (
            <button
              key={section.section_key || index}
              type="button"
              onClick={() => goToSection(index)}
              className={cn(
                'flex-shrink-0 h-9 px-3 rounded-full text-xs font-medium transition-colors touch-target',
                index === currentSectionIndex
                  ? 'bg-primary text-primary-foreground'
                  : index < currentSectionIndex
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
              aria-label={`Ir a sección ${index + 1}: ${section.title}`}
              aria-current={index === currentSectionIndex ? 'step' : undefined}
            >
              <span className="truncate max-w-[120px]">{section.title}</span>
            </button>
          ))}
        </div>
      </div>

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
        {currentQuestion && (
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
              name={
                currentQuestion.question_key || currentQuestion.id.toString()
              }
              control={control}
              rules={{
                required: currentQuestion.is_required
                  ? 'Este campo es obligatorio'
                  : false,
              }}
              render={({ field }) => {
                const questionKey =
                  currentQuestion.question_key ||
                  currentQuestion.id.toString();

                return (
                  <QuestionRenderer
                    question={currentQuestion}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      setAnswer(questionKey, value);

                      if (
                        isAutoAdvanceType(currentQuestion.question_type) &&
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

      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleExit}
            disabled={isSubmitting}
            className="gap-2 h-14 px-4 text-base"
          >
            <ChevronLeft className="h-5 w-5" />
            {isFirstQuestion ? 'Salir' : 'Anterior'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleSaveDraft}
            disabled={!isDirty || isSubmitting}
            aria-label="Guardar borrador"
            className="h-14 w-14 flex flex-col items-center justify-center gap-0.5 touch-target p-0"
          >
            <Save className="h-5 w-5" />
            <span className="text-[10px] font-medium">Guardar</span>
          </Button>

          <Button
            type="button"
            size="lg"
            className="flex-1 gap-2 h-14 px-4 text-base"
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
