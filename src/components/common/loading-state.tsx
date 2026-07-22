import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  minHeight?: string;
}

export function LoadingState({
  message = 'Cargando...',
  className,
  minHeight = 'min-h-[400px]',
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        minHeight,
        className
      )}
    >
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-base text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
