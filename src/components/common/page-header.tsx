'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** When set, shows a back control — essential on mobile sub-pages without tabs. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = 'Volver',
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 -ml-1',
            'text-sm font-medium text-muted-foreground',
            'transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
