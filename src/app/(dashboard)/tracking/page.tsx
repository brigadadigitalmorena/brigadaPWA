'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineBanner } from '@/components/ui/inline-banner';
import { LoadingState } from '@/components/common/loading-state';
import { GitBranch, RefreshCw } from 'lucide-react';
import { useSync } from '@/contexts/sync.context';
import { kvGet, kvSet } from '@/lib/db/database';
import { isModuleEnabled } from '@/lib/services/app-config.service';
import { cn } from '@/lib/utils';

type ManagementStatus = 'pendiente' | 'en_tramite' | 'resuelto' | 'problema' | string;

/** Matches backend GestionTrackingRow */
interface GestionTrackingRow {
  request_id: string;
  assignment_id?: number | null;
  survey_id: number;
  survey_title: string;
  tracking_id: string;
  folio_seq: number;
  assignment_status: string;
  management_status: ManagementStatus;
  comments: string;
  created_at: string;
  updated_at?: string | null;
  closed_at?: string | null;
}

const CACHE_KEY = 'gestion_tracking_cache';

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En trámite',
  resuelto: 'Resuelto',
  problema: 'Problema',
};

function statusLabel(status: ManagementStatus): string {
  return STATUS_LABELS[status] ?? status;
}

function statusBadgeClass(status: ManagementStatus): string {
  switch (status) {
    case 'resuelto':
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    case 'en_tramite':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20';
    case 'problema':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    case 'pendiente':
    default:
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
  }
}

export default function TrackingPage() {
  const { isOnline } = useSync();
  const [rows, setRows] = useState<GestionTrackingRow[]>([]);
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
          setRows(JSON.parse(cached) as GestionTrackingRow[]);
          setFromCache(true);
        } else {
          setError('Sin datos de gestiones en caché');
        }
        return;
      }

      const response = await apiClient.get<GestionTrackingRow[]>(
        '/mobile/gestiones/tracking'
      );
      const data = Array.isArray(response.data) ? response.data : [];
      setRows(data);
      await kvSet(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error(err);
      const cached = await kvGet(CACHE_KEY);
      if (cached) {
        setRows(JSON.parse(cached) as GestionTrackingRow[]);
        setFromCache(true);
        setError('Mostrando última copia en caché');
      } else {
        setError('No se pudo cargar tus gestiones');
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
        <PageHeader title="Gestión" description="Módulo no disponible" />
        <EmptyState
          icon={GitBranch}
          title="Gestión deshabilitada"
          description="Este módulo no está habilitado en la configuración actual."
        />
      </div>
    );
  }

  if (loading) {
    return <LoadingState message="Cargando gestiones..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión"
        description="Estado de tus encuestas de gestión"
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
        <EmptyState icon={GitBranch} title="Sin datos" description={error} />
      )}

      {!error && rows.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title="No tienes gestiones aún"
          description="Cuando completes una encuesta de tipo Gestión, su seguimiento aparecerá aquí."
        />
      )}

      {error && rows.length > 0 && (
        <InlineBanner variant="warning" message={error} />
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const comments = (row.comments || '').trim();
            const updated = row.updated_at || row.created_at;
            return (
              <Card key={row.request_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">
                      {row.survey_title || 'Gestión'}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={cn('flex-shrink-0', statusBadgeClass(row.management_status))}
                    >
                      {statusLabel(row.management_status)}
                    </Badge>
                  </div>
                  <CardDescription className="space-y-0.5">
                    <span className="block">
                      Folio {row.folio_seq || '—'}
                      {row.tracking_id ? ` · ${row.tracking_id}` : ''}
                    </span>
                    {updated ? (
                      <span className="block text-xs">
                        Actualizado {new Date(updated).toLocaleString('es-MX')}
                      </span>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {comments || 'Sin comentarios'}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
