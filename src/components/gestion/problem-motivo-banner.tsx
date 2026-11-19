'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProblemMotivoBannerProps {
  motivo: string | null;
  /** Truncate motivo to ~2 lines (list card). Full text when false (detail). */
  truncate?: boolean;
  onViewHistory?: () => void;
  className?: string;
}

export function ProblemMotivoBanner({
  motivo,
  truncate = false,
  onViewHistory,
  className,
}: ProblemMotivoBannerProps) {
  const hasMotivo = Boolean(motivo?.trim());

  return (
    <div
      className={cn(
        'rounded-lg bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300',
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            Esta gestión tiene un problema reportado
          </p>
          {hasMotivo ? (
            <p
              className={cn(
                'mt-1 text-xs leading-snug',
                truncate && 'line-clamp-2'
              )}
            >
              {motivo}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-snug opacity-90">
              Sin motivo registrado. Revisa el historial o los comentarios.
            </p>
          )}
          {onViewHistory && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewHistory();
              }}
              className="mt-1.5 text-xs font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {hasMotivo && truncate ? 'Ver más' : 'Ver historial'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
