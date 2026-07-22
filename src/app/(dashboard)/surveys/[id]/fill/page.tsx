'use client';

import { useEffect, useState, useRef } from 'react';
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

  const {
    version,
    responseId,
    currentSectionIndex,
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
    nextSection,
    prevSection,
    goToSection,
    getVisibleQuestions,
    getProgress,
    reset,
  } = useSurveyFillStore();

  const { isOnline, syncNow } = useSync();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const currentSection = version?.sections?.[currentSectionIndex];
  const visibleQuestions = currentSection
    ? getVisibleQuestions(currentSection)
    : [];
  const progress = getProgress();
  const isLastSection =
    currentSectionIndex >= (version?.sections?.length || 0) - 1;

  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isDirty, isValid },
  } = useForm({
    defaultValues: answers,
    mode: 'onChange',
  });

  useEffect(() => {
    return () => {
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

  const onSubmit = async (data: Record<string, unknown>) => {
    Object.entries(data).forEach(([key, value]) => {
      setAnswer(key, value);
    });

    if (!isLastSection) {
      nextSection();
      return;
    }

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

  const handleNext = () => {
    if (!isValid && visibleQuestions.length > 0) {
      toast.error('Completa los campos obligatorios antes de continuar');
      scrollToFirstError();
      return;
    }
    handleSubmit(onSubmit)();
  };

  const handleSaveDraft = async () => {
    await saveDraft();
    toast.success('Borrador guardado');
  };

  const handleExit = async () => {
    if (currentSectionIndex !== 0) {
      prevSection();
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
            <Button onClick={() => router.push('/surveys')} variant="outline" size="mobile" className="w-full">
              Volver a encuestas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!version || !currentSection) {
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
              {currentSectionIndex + 1} / {version.sections?.length}
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
              key={index}
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

      <div className="px-4 pt-4 pb-2">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">{currentSection.title}</h2>
          {currentSection.description && (
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              {currentSection.description}
            </p>
          )}
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-6"
      >
        {visibleQuestions.length === 0 ? (
          <p className="text-base text-muted-foreground text-center py-8">
            No hay preguntas en esta sección.
          </p>
        ) : (
          visibleQuestions.map((question, index) => {
            const questionKey = question.question_key || question.id.toString();
            return (
              <div
                key={question.id}
                className="bg-card rounded-xl border border-border p-5 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-primary uppercase tracking-wide pt-1.5">
                    Pregunta {index + 1} de {visibleQuestions.length}
                  </span>
                </div>
                <Controller
                  name={questionKey}
                  control={control}
                  rules={{
                    required: question.is_required
                      ? 'Este campo es obligatorio'
                      : false,
                  }}
                  render={({ field }) => (
                    <QuestionRenderer
                      question={question}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        setAnswer(questionKey, value);
                      }}
                      error={errors[questionKey]?.message as string}
                    />
                  )}
                />
              </div>
            );
          })
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
            {currentSectionIndex === 0 ? 'Salir' : 'Anterior'}
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
              : isLastSection
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
