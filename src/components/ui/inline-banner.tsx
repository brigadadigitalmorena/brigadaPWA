'use client';

import { useState, type MouseEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type InlineBannerVariant = 'success' | 'error' | 'info' | 'warning';

interface InlineBannerProps {
  variant?: InlineBannerVariant;
  message: string;
  /** When true (default), shows a close control. Pass onClose for parent side-effects. */
  dismissible?: boolean;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<InlineBannerVariant, string> = {
  success:
    'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
  error:
    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
  warning:
    'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
};

const variantIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

export function InlineBanner({
  variant = 'info',
  message,
  dismissible = true,
  onClose,
  className,
}: InlineBannerProps) {
  const Icon = variantIcon[variant];
  const canDismiss = dismissible;
  const token = `${variant}\0${message}`;
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);

  if (dismissedToken === token) return null;

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDismissedToken(token);
    onClose?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border py-2 pl-4 pr-1.5',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-2 h-5 w-5 flex-shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 py-1.5 text-sm leading-relaxed">{message}</p>
      {canDismiss ? (
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            'opacity-80 transition-opacity hover:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label="Cerrar notificación"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
