'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { RecorridoMap } from '@/components/recorrido/recorrido-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/db/database';
import type { FieldSession, FieldSessionSample } from '@/lib/db/database';
import {
  getMyFieldSessionTrack,
  listMyFieldSessions,
  type FieldSessionHistoryItem,
  type FieldSessionTrackResponse,
} from '@/lib/api/field-session.service';

function formatDistance(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
}

function formatDuration(startedAt: string, endedAt?: string): string {
  const elapsed =
    new Date(endedAt ?? new Date().toISOString()).getTime() -
    new Date(startedAt).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function historyItemToLocal(item: FieldSessionHistoryItem): FieldSession {
  return {
    client_id: item.client_id,
    server_id: item.id,
    activity_type: item.activity_type,
    survey_id: item.survey_id,
    status:
      item.status === 'active'
        ? 'active'
        : item.status === 'abandoned'
          ? 'abandoned'
          : 'completed',
    started_at: item.started_at,
    ended_at: item.ended_at ?? undefined,
    end_reason: item.end_reason ?? undefined,
    degraded_reason: item.degraded_reason ?? undefined,
    config_json: '{}',
    next_seq: item.sample_count,
    sample_count: item.sample_count,
    distance_m: item.distance_m,
    created_at: item.started_at,
    updated_at: item.ended_at ?? item.started_at,
  };
}

export default function RecorridosPage() {
  const localSessionsQuery = useLiveQuery(async () => {
    const rows = await db.field_sessions.toArray();
    return rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
  }, []);
  const localSessions = useMemo(
    () => localSessionsQuery ?? [],
    [localSessionsQuery]
  );
  const [remoteSessions, setRemoteSessions] = useState<FieldSession[]>([]);
  const [remoteTrack, setRemoteTrack] =
    useState<FieldSessionTrackResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const refreshRemote = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setRefreshing(true);
    setRemoteError(null);
    try {
      const response = await listMyFieldSessions();
      setRemoteSessions(response.items.map(historyItemToLocal));
    } catch {
      setRemoteError('No se pudo actualizar el historial remoto.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!navigator.onLine) return;
    let cancelled = false;
    void listMyFieldSessions()
      .then((response) => {
        if (!cancelled) {
          setRemoteSessions(response.items.map(historyItemToLocal));
        }
      })
      .catch(() => {
        // Local sessions remain available when remote history cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = useMemo(() => {
    const byId = new Map(remoteSessions.map((session) => [session.client_id, session]));
    for (const session of localSessions) byId.set(session.client_id, session);
    return [...byId.values()].sort((a, b) =>
      b.started_at.localeCompare(a.started_at)
    );
  }, [localSessions, remoteSessions]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = selectedId ?? sessions[0]?.client_id ?? null;

  const selected =
    sessions.find((session) => session.client_id === effectiveSelectedId) ?? null;
  const samplesQuery = useLiveQuery(
    async () =>
      effectiveSelectedId
          ? db.field_session_samples
              .where('session_client_id')
              .equals(effectiveSelectedId)
              .sortBy('sample_seq')
          : [],
    [effectiveSelectedId]
  );
  const samples = useMemo(() => samplesQuery ?? [], [samplesQuery]);
  useEffect(() => {
    if (
      !effectiveSelectedId ||
      !selected?.server_id ||
      samples.length > 0 ||
      !navigator.onLine
    ) {
      return;
    }
    void getMyFieldSessionTrack(effectiveSelectedId)
      .then(setRemoteTrack)
      .catch(() => setRemoteError('No se pudo descargar el detalle del recorrido.'));
  }, [effectiveSelectedId, samples.length, selected?.server_id]);

  const displayedSamples = useMemo<FieldSessionSample[]>(
    () =>
      samples.length > 0
        ? samples
        : (remoteTrack?.session.client_id === effectiveSelectedId
            ? remoteTrack.points.map((point) => ({
            session_client_id: remoteTrack.session.client_id,
            sample_seq: point.seq,
            sample_type:
              point.sample_type === 'photo'
                ? 'photo'
                : point.sample_type === 'gap'
                  ? 'gap'
                  : 'gps',
            latitude: point.lat,
            longitude: point.lng,
            accuracy_m: point.accuracy_m ?? undefined,
            speed_mps: point.speed_mps ?? undefined,
            recorded_at: point.recorded_at,
            app_state:
              point.app_state === 'background' ||
              point.app_state === 'hidden' ||
              point.app_state === 'foreground'
                ? point.app_state
                : undefined,
            is_mocked: point.is_mocked,
            upload_status: 'uploaded',
            created_at: point.recorded_at,
          }))
            : []),
    [effectiveSelectedId, remoteTrack, samples]
  );
  const linkedResponses =
    useLiveQuery(async () => {
      if (!effectiveSelectedId) return [];
      const queueRows = await db.sync_queue
        .where('operation_type')
        .equals('CREATE_RESPONSE')
        .toArray();
      const responseIds = queueRows.flatMap((row) => {
        try {
          const payload = JSON.parse(row.payload_json) as {
            response_id?: string;
            field_session_client_id?: string;
          };
          return payload.field_session_client_id === effectiveSelectedId &&
            payload.response_id
            ? [payload.response_id]
            : [];
        } catch {
          return [];
        }
      });
      if (responseIds.length === 0) return [];
      const rows = await db.responses
        .where('response_id')
        .anyOf(responseIds)
        .toArray();
      return rows.flatMap((response) =>
        response.latitude != null && response.longitude != null
          ? [
              {
                responseId: response.response_id,
                latitude: response.latitude,
                longitude: response.longitude,
                status: response.sync_status,
              },
            ]
          : []
      );
    }, [effectiveSelectedId]) ?? [];
  const pendingCount = displayedSamples.filter(
    (sample) => sample.upload_status === 'pending'
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis recorridos"
        description="Consulta rutas guardadas en este dispositivo y su estado de envío."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void refreshRemote()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />
      {remoteError && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{remoteError}</p>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
            <Navigation className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Todavía no tienes recorridos</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Inicia uno desde Encuestas para ver aquí su ruta, distancia y
              puntos pendientes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.client_id}
                type="button"
                onClick={() => setSelectedId(session.client_id)}
                className="w-full text-left"
              >
                <Card
                  className={
                    effectiveSelectedId === session.client_id
                      ? 'border-primary ring-1 ring-primary/20'
                      : ''
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">
                        {new Date(session.started_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </CardTitle>
                      <Badge
                        variant={session.status === 'active' ? 'default' : 'secondary'}
                      >
                        {session.status === 'active' ? 'Activo' : 'Finalizado'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {new Date(session.started_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {formatDuration(session.started_at, session.ended_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatDistance(session.distance_m)}</span>
                    <span>{session.sample_count} puntos</span>
                    <span>{session.server_id ? 'Sincronizado' : 'Local'}</span>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          {selected && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Ruta del recorrido
                    </CardTitle>
                    <CardDescription>
                      {formatDistance(selected.distance_m)} · {displayedSamples.length} muestras
                    </CardDescription>
                  </div>
                  {pendingCount > 0 && (
                    <Link href="/sync">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {pendingCount} por enviar
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RecorridoMap
                  samples={displayedSamples}
                  responses={
                    remoteTrack
                      ? remoteTrack.responses.flatMap((response) =>
                          response.lat != null && response.lng != null
                            ? [
                                {
                                  responseId: response.client_id,
                                  latitude: response.lat,
                                  longitude: response.lng,
                                  status: 'synced',
                                },
                              ]
                            : []
                        )
                      : linkedResponses
                  }
                  className="h-[480px]"
                />
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />
                    Enviado
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
                    Pendiente
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-600" />
                    Respuesta
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
