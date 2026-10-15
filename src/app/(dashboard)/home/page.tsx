'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, FilePenLine, MapPinned, RefreshCw } from 'lucide-react';
import { useSync } from '@/contexts/sync.context';
import { db } from '@/lib/db/database';
import { getDailyMetrics } from '@/lib/api/metrics.service';
import { countCompletedToday, type DailyMetrics } from '@/lib/metrics/daily-metrics';
import { captureEvent } from '@/lib/observability/client';
import { PageHeader } from '@/components/common/page-header';
import { DailyMetricsCard } from '@/components/home/daily-metrics-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LINKS = [
  { href: '/surveys', label: 'Encuestas', icon: ClipboardList },
  { href: '/drafts', label: 'Borradores', icon: FilePenLine },
  { href: '/sync', label: 'Mis envíos', icon: RefreshCw },
  { href: '/sync/map', label: 'Mapa de envíos', icon: MapPinned },
];

export default function HomePage() {
  const { isOnline, pendingCount } = useSync();
  const [remote, setRemote] = useState<DailyMetrics | null>(null);
  const responses = useLiveQuery(() => db.responses.toArray(), []);
  const drafts =
    useLiveQuery(
      () => db.responses.where('status').equals('draft').toArray(),
      []
    ) ?? [];

  useEffect(() => {
    captureEvent('screen.home.opened', {
      pending_count: pendingCount,
      online: isOnline,
    });
  }, [isOnline, pendingCount]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    getDailyMetrics()
      .then((data) => {
        if (!cancelled) setRemote(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  const primaryDraft = drafts[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Inicio"
        description="Resumen del día y accesos de campo"
      />
      <DailyMetricsCard
        localCompleted={countCompletedToday(responses ?? [])}
        localPending={pendingCount}
        remote={remote}
      />
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="font-medium">
            {drafts.length} borrador{drafts.length === 1 ? '' : 'es'} reciente
            {drafts.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {primaryDraft
              ? `El más reciente es la encuesta ${primaryDraft.survey_id}.`
              : 'Puedes retomarlos desde Borradores.'}
          </p>
          <Link href="/drafts" className="mt-3 inline-block text-sm font-medium text-primary">
            Continuar
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardHeader className="pb-2">
                  <Icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
