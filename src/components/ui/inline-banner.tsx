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
  onClose,
  className,
}: InlineBannerProps) {
  const Icon = variantIcon[variant];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm leading-relaxed">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex items-center justify-center opacity-70 transition-opacity hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
