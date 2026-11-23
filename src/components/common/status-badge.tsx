import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  isOnline: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  className?: string;
}

export function StatusBadge({
  isOnline,
  isSyncing = false,
  pendingCount = 0,
  className,
}: StatusBadgeProps) {
  const statusText = isOnline ? 'En línea' : 'Offline';
  const pendingText =
    pendingCount > 0
      ? ` · ${pendingCount} pend.`
      : isSyncing
        ? ' · Sync...'
        : '';

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold',
        isOnline
          ? 'bg-green-500/15 text-green-800 dark:bg-green-500/10 dark:text-green-300'
          : 'bg-red-500/15 text-red-800 dark:bg-red-500/10 dark:text-red-300',
        pendingCount > 0 && 'animate-pulse',
        className
      )}
    >
      {isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : isOnline ? (
        <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="truncate">{`${statusText}${pendingText}`}</span>
    </span>
  );
}
