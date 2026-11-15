'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** When set, shows a back control — essential on mobile sub-pages without tabs. */
  backHref?: string;
  backLabel?: string;
  /** Larger, button-styled back control for screens that feel like a modal. */
  backVariant?: 'link' | 'button';
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = 'Volver',
  backVariant = 'link',
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {backHref ? (
        backVariant === 'button' ? (
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'mobile' }),
              'w-full justify-start gap-2 sm:w-auto'
            )}
          >
            <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
            {backLabel}
          </Link>
        ) : (
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
        )
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
