'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Loader2, RefreshCw } from 'lucide-react';
import {
  getGestionTrackingRows,
  getManagementStatusLabels,
  type GestionTrackingRow,
} from '@/lib/api/gestion.service';
import { normalizeStatusLabels } from '@/lib/gestion/display';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InlineBanner } from '@/components/ui/inline-banner';
import { LoadingState } from '@/components/common/loading-state';
import { GestionMetrics } from '@/components/gestion/gestion-metrics';
import {
  GestionFilters,
  type GestionStatusFilter,
} from '@/components/gestion/gestion-filters';
import { GestionCard } from '@/components/gestion/gestion-card';
import { GestionDetail } from '@/components/gestion/gestion-detail';
import { useSync } from '@/contexts/sync.context';
import { kvGet, kvSet } from '@/lib/db/database';
import { isModuleEnabled } from '@/lib/services/app-config.service';

const CACHE_KEY = 'gestion_tracking_cache';

function normalizeCachedRows(value: string): GestionTrackingRow[] {
  try {
    const parsed = JSON.parse(value) as Partial<GestionTrackingRow>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => typeof row.request_id === 'string')
      .map((row) => ({
        request_id: row.request_id as string,
        entitlement_id: row.entitlement_id ?? null,
        campaign_id: row.campaign_id ?? null,
        survey_id: Number(row.survey_id ?? 0),
        survey_title: row.survey_title || 'Gestión',
        tracking_id: row.tracking_id || '',
        folio_seq: Number(row.folio_seq ?? 0),
        entitlement_status: row.entitlement_status || 'active',
        inactive_reason: row.inactive_reason ?? null,
        management_status: row.management_status || 'pendiente',
        comments: row.comments || '',
        created_at: row.created_at || new Date(0).toISOString(),
        updated_at: row.updated_at ?? null,
        closed_at: row.closed_at ?? null,
        id_attributes: row.id_attributes ?? [],
        source_values: row.source_values ?? {},
        status_history: row.status_history ?? [],
      }));
  } catch {
    return [];
  }
}

export default function TrackingPage() {
  const { isOnline } = useSync();
  const [rows, setRows] = useState<GestionTrackingRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<GestionStatusFilter>('all');
  const [surveyId, setSurveyId] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('requestId');
  });
  const [statusLabels, setStatusLabels] = useState(normalizeStatusLabels());
  const deepLinkScrolled = useRef(false);

  const enabled = isModuleEnabled('tracking', isOnline);

  const refreshFromNetwork = useCallback(async (silent = false) => {
    if (!navigator.onLine) return;
    if (!silent) setRefreshing(true);

    const [trackingResult, labelsResult] = await Promise.allSettled([
      getGestionTrackingRows(),
      getManagementStatusLabels(),
    ]);

    if (trackingResult.status === 'fulfilled') {
      setRows(trackingResult.value);
      setFromCache(false);
      setError(null);
      await kvSet(CACHE_KEY, JSON.stringify(trackingResult.value));
    } else {
      setError((current) =>
        current ?? 'No se pudo cargar el seguimiento. Revisa tu conexión e intenta de nuevo.'
      );
    }

    if (labelsResult.status === 'fulfilled') {
      setStatusLabels(normalizeStatusLabels(labelsResult.value));
    }

    setRefreshing(false);
    setInitialLoading(false);
  }, []);

  const loadStaleFirst = useCallback(async () => {
    const cached = await kvGet(CACHE_KEY);
    if (cached) {
      const cachedRows = normalizeCachedRows(cached);
      if (cachedRows.length > 0) {
        setRows(cachedRows);
        setFromCache(true);
        setInitialLoading(false);
      }
    }

    if (navigator.onLine) {
      await refreshFromNetwork(true);
    } else {
      setInitialLoading(false);
      if (!cached) {
        setError('Sin datos de gestiones guardados en este dispositivo.');
      }
    }
  }, [refreshFromNetwork]);

  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => void loadStaleFirst(), 0);
    return () => window.clearTimeout(timeout);
  }, [enabled, loadStaleFirst]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && enabled) {
        void refreshFromNetwork(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, refreshFromNetwork]);

  const surveys = useMemo(() => {
    const unique = new Map<number, string>();
    rows.forEach((row) => unique.set(row.survey_id, row.survey_title));
    return [...unique.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-MX');
    return rows.filter((row) => {
      const matchesStatus =
        status === 'all' ||
        (status === 'proceso'
          ? row.management_status === 'pendiente' ||
            row.management_status === 'en_tramite'
          : row.management_status === status);
      const matchesSurvey = surveyId === 'all' || row.survey_id === surveyId;
      const haystack = [
        row.survey_title,
        row.folio_seq,
        row.tracking_id,
        row.request_id,
        ...Object.values(row.source_values ?? {}),
      ]
        .join(' ')
        .toLocaleLowerCase('es-MX');
      return (
        matchesStatus &&
        matchesSurvey &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      );
    });
  }, [query, rows, status, surveyId]);

  useEffect(() => {
    if (
      deepLinkScrolled.current ||
      typeof selectedId !== 'string' ||
      !rows.some((row) => row.request_id === selectedId)
    ) {
      return;
    }
    deepLinkScrolled.current = true;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`gestion-${selectedId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [rows, selectedId]);

  const selectedRow =
    filteredRows.find((row) => row.request_id === selectedId) ??
    filteredRows[0] ??
    null;

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

  if (initialLoading) {
    return <LoadingState message="Cargando gestiones..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestión"
        description="Consulta el avance y conversa sobre tus solicitudes enviadas"
        action={
          <Button
            variant="outline"
            size="mobile"
            onClick={() => void refreshFromNetwork()}
            disabled={!isOnline || refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {refreshing ? 'Actualizando' : 'Actualizar'}
          </Button>
        }
      />

      {fromCache && (
        <InlineBanner
          variant="warning"
          message={
            isOnline
              ? 'Mostrando la última copia mientras se actualiza.'
              : 'Viendo datos guardados. Conéctate para actualizar y comentar.'
          }
        />
      )}

      {error && rows.length > 0 && (
        <InlineBanner variant="warning" message={error} />
      )}

      {rows.length > 0 && (
        <>
          <GestionMetrics
            rows={rows}
            activeStatus={status}
            onStatusChange={setStatus}
          />
          <GestionFilters
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            surveyId={surveyId}
            onSurveyChange={setSurveyId}
            surveys={surveys}
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filteredRows.length}{' '}
            {filteredRows.length === 1 ? 'gestión' : 'gestiones'}
          </p>
        </>
      )}

      {error && rows.length === 0 ? (
        <EmptyState icon={GitBranch} title="Sin datos" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No tienes gestiones aún"
          description="Cuando completes una encuesta de tipo Gestión desde Encuestas, su seguimiento aparecerá aquí."
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Sin coincidencias"
          description="Ajusta la búsqueda o limpia los filtros para ver más gestiones."
          action={
            <Button
              variant="outline"
              size="mobile"
              onClick={() => {
                setQuery('');
                setStatus('all');
                setSurveyId('all');
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <div key={row.request_id} id={`gestion-${row.request_id}`}>
                <GestionCard
                  row={row}
                  selected={selectedId === row.request_id}
                  statusLabels={statusLabels}
                  onSelect={() =>
                    setSelectedId((current) =>
                      current === row.request_id ? null : row.request_id
                    )
                  }
                  mobileDetail={
                    <GestionDetail
                      row={row}
                      statusLabels={statusLabels}
                      isOnline={isOnline}
                    />
                  }
                />
              </div>
            ))}
          </div>

          <div className="sticky top-4 hidden lg:block">
            <Card>
              <CardContent className="p-5">
                {selectedRow ? (
                  <GestionDetail
                    row={selectedRow}
                    statusLabels={statusLabels}
                    isOnline={isOnline}
                  />
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Selecciona una gestión para ver su detalle.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
