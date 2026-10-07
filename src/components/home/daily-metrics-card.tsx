'use client';

import Link from 'next/link';
import { mergeDailyCounts, type DailyMetrics } from '@/lib/metrics/daily-metrics';

interface DailyMetricsCardProps {
  localCompleted: number;
  localPending: number;
  remote: DailyMetrics | null;
}

export function DailyMetricsCard({
  localCompleted,
  localPending,
  remote,
}: DailyMetricsCardProps) {
  const counts = mergeDailyCounts({ localCompleted, localPending, remote });
  if (counts.completed === 0 && counts.pending === 0 && counts.comments === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Hoy</h2>
      <div className="mt-3 flex flex-wrap gap-4">
        {counts.completed > 0 && (
          <Link href="/sync" className="text-sm">
            <span className="font-semibold text-emerald-600">
              {counts.completed}
            </span>{' '}
            <span className="text-muted-foreground">
              completada{counts.completed === 1 ? '' : 's'}
            </span>
          </Link>
        )}
        {counts.pending > 0 && (
          <Link href="/sync" className="text-sm">
            <span className="font-semibold text-amber-600">{counts.pending}</span>{' '}
            <span className="text-muted-foreground">
              pendiente{counts.pending === 1 ? '' : 's'}
            </span>
          </Link>
        )}
        {counts.comments > 0 && (
          <Link href="/tracking" className="text-sm">
            <span className="font-semibold text-primary">{counts.comments}</span>{' '}
            <span className="text-muted-foreground">
              comentario{counts.comments === 1 ? '' : 's'}
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
