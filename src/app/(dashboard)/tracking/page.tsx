'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineBanner } from '@/components/ui/inline-banner';
import { LoadingState } from '@/components/common/loading-state';
import { MapPinned, RefreshCw } from 'lucide-react';
import { useSync } from '@/contexts/sync.context';
import { kvGet, kvSet } from '@/lib/db/database';
import { isModuleEnabled } from '@/lib/services/app-config.service';

interface TrackingRow {
  id?: number | string;
  survey_title?: string;
  status?: string;
  updated_at?: string;
  comments_count?: number;
}

const CACHE_KEY = 'gestion_tracking_cache';

export default function TrackingPage() {
  const { isOnline } = useSync();
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const enabled = isModuleEnabled('tracking', isOnline);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      if (!isOnline) {
        const cached = await kvGet(CACHE_KEY);
        if (cached) {
          setRows(JSON.parse(cached) as TrackingRow[]);
          setFromCache(true);
        } else {
          setError('Sin datos de tracking en caché');
        }
        return;
      }

      const response = await apiClient.get<TrackingRow[] | { items: TrackingRow[] }>(
        '/mobile/gestion/tracking'
      );
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.items ?? [];
      setRows(data);
      await kvSet(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error(err);
      const cached = await kvGet(CACHE_KEY);
      if (cached) {
        setRows(JSON.parse(cached) as TrackingRow[]);
        setFromCache(true);
        setError('Mostrando última copia en caché');
      } else {
        setError('No se pudo cargar el tracking de gestión');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [enabled, load]);

  if (!enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tracking" description="Módulo no disponible" />
        <EmptyState
          icon={MapPinned}
          title="Tracking deshabilitado"
          description="Este módulo no está habilitado en la configuración actual."
        />
      </div>
    );
  }

  if (loading) {
    return <LoadingState message="Cargando tracking..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking de gestión"
        description="Estado y comentarios de tus envíos"
        action={
          <Button variant="outline" size="mobile" onClick={load} disabled={!isOnline}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        }
      />

      {fromCache && (
        <InlineBanner
          variant="warning"
          message="Viendo datos en caché. Conéctate para actualizar."
        />
      )}

      {error && !rows.length && (
        <EmptyState icon={MapPinned} title="Sin datos" description={error} />
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <Card key={String(row.id ?? index)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {row.survey_title || `Registro ${row.id ?? index + 1}`}
                </CardTitle>
                <CardDescription>
                  Estado: {row.status || '—'}
                  {row.updated_at
                    ? ` · ${new Date(row.updated_at).toLocaleString()}`
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {row.comments_count != null
                  ? `${row.comments_count} comentario${row.comments_count !== 1 ? 's' : ''}`
                  : 'Sin detalle de comentarios'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
