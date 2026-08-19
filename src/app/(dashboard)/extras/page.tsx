'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyEntitlements } from '@/lib/api/survey.service';
import type { Assignment } from '@/lib/types';
import { campaignLabel, surveyFillHref } from '@/lib/campaigns/scope';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/common/loading-state';
import { Zap, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

function urgency(entitlement: Assignment): 'high' | 'medium' | 'low' {
  const endsAt = (entitlement as Assignment & { ends_at?: string }).ends_at;
  if (!endsAt) return 'low';
  const hours = (new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 24) return 'high';
  if (hours < 72) return 'medium';
  return 'low';
}

export default function ExtrasPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getMyEntitlements();
      const extras = all.filter((a) => {
        const type = (a as Assignment & { survey_type?: string }).survey_type;
        return type === 'extra' || type === 'extras' || Boolean((a as Assignment & { is_extra?: boolean }).is_extra);
      });
      // If API doesn't tag extras, show non-completed with daily caps as "priority"
      setItems(
        extras.length > 0
          ? extras
          : all.filter((a) => a.entitlement_status !== 'completed').slice(0, 5)
      );
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

  if (loading) return <LoadingState message="Cargando extras..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extras"
        description="Encuestas urgentes o adicionales"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Sin extras"
          description="No hay campañas extra por ahora."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const level = urgency(item);
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
                      {level === 'high' ? 'Urgente' : level === 'medium' ? 'Pronto' : 'Normal'}
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
