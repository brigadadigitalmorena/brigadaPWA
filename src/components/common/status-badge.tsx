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
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isOnline
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400',
        pendingCount > 0 && 'animate-pulse',
        className
      )}
    >
      {isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : isOnline ? (
        <Wifi className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      <span>
        {statusText}
        {pendingText}
      </span>
    </span>
  );
}
