'use client';

import { ClipboardList } from 'lucide-react';

import type { SurveySection } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SurveyFillHeaderProps {
  surveyTitle: string;
  campaignName?: string | null;
  progress: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  sections?: SurveySection[];
  currentSectionIndex: number;
  onGoToSection: (index: number) => void;
  fieldSession?: {
    sampleCount: number;
    pendingSamples: number;
  } | null;
}

export function SurveyFillHeader({
  surveyTitle,
  campaignName,
  progress,
  currentQuestionIndex,
  totalQuestions,
  sections,
  currentSectionIndex,
  onGoToSection,
  fieldSession,
}: SurveyFillHeaderProps) {
  const roundedProgress = Math.round(progress);

  return (
    <header className="sticky top-0 z-20 text-secondary-foreground safe-area-top [background-color:color-mix(in_oklch,var(--primary)_16%,var(--background))]">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:h-12 md:w-12">
            <ClipboardList className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
              {surveyTitle}
            </h1>
            {campaignName ? (
              <p className="truncate text-base font-semibold tracking-wide text-foreground/85 md:text-lg">
                {campaignName}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="flex w-full shrink-0 items-center justify-between gap-4 sm:gap-5 md:w-auto md:justify-end"
          aria-live="polite"
        >
          <div className="text-left md:text-right">
            <p className="whitespace-nowrap text-2xl font-bold tabular-nums leading-none text-primary sm:text-3xl">
              {roundedProgress}%
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70 sm:text-xs">
              Avance
            </p>
          </div>
          <div className="h-10 w-px bg-foreground/20" aria-hidden="true" />
          <div className="text-right">
            <p className="whitespace-nowrap text-2xl font-bold tabular-nums leading-none text-foreground sm:text-3xl">
              {currentQuestionIndex + 1}
              <span className="text-lg font-semibold text-foreground/60 sm:text-xl">
                {' '}
                / {totalQuestions}
              </span>
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70 sm:text-xs">
              Preguntas
            </p>
          </div>
        </div>
      </div>

      <div
        className="h-1.5 w-full bg-primary/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedProgress}
        aria-label="Progreso de la encuesta"
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {fieldSession ? (
        <div className="flex items-center gap-2 px-4 pt-2 text-sm font-medium text-foreground/80">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Recorrido activo
          </span>
          <span aria-hidden="true">·</span>
          <span>{fieldSession.sampleCount} puntos</span>
          {fieldSession.pendingSamples > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{fieldSession.pendingSamples} por enviar</span>
            </>
          ) : null}
        </div>
      ) : null}

      {sections && sections.length > 0 ? (
        <nav
          className="flex items-end gap-1 overflow-x-auto no-scrollbar px-3"
          aria-label="Secciones de la encuesta"
        >
          {sections.map((section, index) => {
            const isCurrent = index === currentSectionIndex;
            const isComplete = index < currentSectionIndex;

            return (
              <button
                key={section.section_key || index}
                type="button"
                onClick={() => onGoToSection(index)}
                className={cn(
                  'h-11 shrink-0 px-3 text-sm font-medium transition-colors touch-target sm:text-base',
                  'border-b-2',
                  isCurrent
                    ? 'border-primary font-semibold text-foreground'
                    : isComplete
                      ? 'border-transparent text-primary'
                      : 'border-transparent text-foreground/55 hover:text-foreground'
                )}
                aria-label={`Ir a sección ${index + 1}: ${section.title}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {section.title}
              </button>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
