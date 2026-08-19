'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyEntitlements } from '@/lib/api/survey.service';
import type { Assignment } from '@/lib/types';
import { campaignLabel, surveyFillHref } from '@/lib/campaigns/scope';
import {
  prioritySurveyBadge,
  resolvePriorityDisplayItems,
} from '@/lib/campaigns/extras';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/common/loading-state';
import { Zap, Play, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PrioritariasPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getMyEntitlements();
      setItems(resolvePriorityDisplayItems(all));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <LoadingState message="Cargando prioritarias..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prioritarias"
        description="Encuestas temporales o con fecha de cierre"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Sin encuestas prioritarias"
          description="Aquí aparecen encuestas tipo extra o con fecha de cierre. Para iniciar encuestas de gestión, ve a Encuestas."
          action={
            <Link
              href="/surveys"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-base font-medium hover:bg-accent"
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Ir a Encuestas
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const { level, label } = prioritySurveyBadge(item);
            return (
              <Card key={item.entitlement_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {item.survey_title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        level === 'high' && 'border-red-500/40 text-red-700',
                        level === 'medium' && 'border-amber-500/40 text-amber-700',
                        level === 'low' && 'border-muted'
                      )}
                    >
                      {label}
                    </Badge>
                  </div>
                  <CardDescription>
                    {campaignLabel(item)
                      ? campaignLabel(item)
                      : `Disponible ${new Date(item.assigned_at).toLocaleDateString()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={surveyFillHref(item)}
                    className="inline-flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
