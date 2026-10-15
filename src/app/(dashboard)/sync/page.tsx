'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/contexts/sync.context';
import { db } from '@/lib/db/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { InlineBanner } from '@/components/ui/inline-banner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { SubmissionHistory } from '@/components/sync/submission-history';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSyncErrorCopy } from '@/lib/sync/error-copy';
import { reopenForCorrection } from '@/lib/services/draft.service';
import { parseOptionalScopeId, surveyResumeHref } from '@/lib/campaigns/scope';
import { toast } from 'sonner';

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'retry_wait':
      return 'Reintento';
    case 'leased':
    case 'syncing':
      return 'Enviando';
    case 'completed':
      return 'Enviado';
    case 'dead_letter':
    case 'failed_permanent':
    case 'failed':
      return 'Con error';
    case 'discarded':
      return 'Descartado';
    default:
      return status;
  }
}

function operationLabel(operationType: string): string {
  switch (operationType) {
    case 'CREATE_RESPONSE':
      return 'Respuesta';
    case 'UPLOAD_FILE':
      return 'Archivo';
    case 'CONFIRM_DOCUMENT':
      return 'Confirmación de archivo';
    case 'UPSERT_FIELD_SESSION':
      return 'Recorrido';
    case 'UPLOAD_FIELD_SESSION_SAMPLES':
      return 'Puntos del recorrido';
    default:
      return 'Envío pendiente';
  }
}

export default function SyncPage() {
  const router = useRouter();
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const {
    isOnline,
    isSyncing,
    pendingCount,
    deadLetterCount,
    lastSyncedAt,
    error,
    syncNow,
    retryFailed,
    clearDeadLetter,
  } = useSync();

  const queueCount = pendingCount + (deadLetterCount ?? 0);

  const queueItems = useLiveQuery(async () => {
    const rows = await db.sync_queue
      .filter((item) => item.status !== 'completed' && item.status !== 'discarded')
      .toArray();
    return rows
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 50);
  }, []);

  const historyData = useLiveQuery(async () => {
    const [responses, surveys] = await Promise.all([
      db.responses
        .filter((response) => response.sync_status === 'synced')
        .toArray(),
      db.surveys.toArray(),
    ]);
    responses.sort((a, b) => {
      const aDate =
        a.last_synced_at || a.completed_at || a.updated_at || a.created_at;
      const bDate =
        b.last_synced_at || b.completed_at || b.updated_at || b.created_at;
      return bDate.localeCompare(aDate);
    });
    return {
      responses,
      surveyTitles: new Map(
        surveys.map((survey) => [survey.survey_id, survey.title])
      ),
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis envíos"
        description="Consulta tus respuestas confirmadas y el estado de sincronización"
        action={
          <Link href="/sync/map" className="text-sm font-medium text-primary">
            Ver mapa
          </Link>
        }
      />

      {!isOnline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión. Los envíos se reintentarán al recuperar red."
        />
      )}

      <Tabs defaultValue="history" className="gap-5">
        <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl p-1 group-data-horizontal/tabs:h-14">
          <TabsTrigger
            value="history"
            className="h-12 min-h-12 rounded-lg px-3 text-sm font-medium sm:text-base"
          >
            Historial
          </TabsTrigger>
          <TabsTrigger
            value="queue"
            className="h-12 min-h-12 rounded-lg px-3 text-sm font-medium sm:text-base"
          >
            <span>Pendientes</span>
            {queueCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[11px] font-semibold tabular-nums">
                {queueCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <SubmissionHistory
            responses={historyData?.responses ?? []}
            surveyTitles={historyData?.surveyTitles ?? new Map()}
          />
        </TabsContent>

        <TabsContent value="queue" className="space-y-5">
          {(deadLetterCount ?? 0) > 0 && (
            <InlineBanner
              variant="error"
              message={`${deadLetterCount} envío(s) con error. Revisa el detalle abajo o reintenta.`}
            />
          )}

          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  isOnline ? 'bg-green-500/10' : 'bg-red-500/10'
                )}
              >
                {isOnline ? (
                  <Wifi className="h-7 w-7 text-green-500" />
                ) : (
                  <WifiOff className="h-7 w-7 text-red-500" />
                )}
              </div>
              <div>
                <span className="text-xl">{isOnline ? 'En línea' : 'Sin conexión'}</span>
                <CardDescription className="mt-0.5">
                  {isOnline ? 'Conectado al servidor' : 'Modo offline'}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <RefreshCw
                  className={cn('h-7 w-7 text-primary', isSyncing && 'animate-spin')}
                />
              </div>
              <div>
                <span className="text-3xl font-bold">{pendingCount}</span>
                <CardDescription className="mt-0.5">
                  {pendingCount === 0
                    ? 'Nada pendiente'
                    : `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={syncNow}
              disabled={!isOnline || isSyncing || (pendingCount === 0 && (deadLetterCount ?? 0) === 0)}
              size="mobile"
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Sincronizar ahora
                </>
              )}
            </Button>
            {(deadLetterCount ?? 0) > 0 && (
              <div className="flex gap-2">
                <Button onClick={retryFailed} variant="outline" size="sm" className="flex-1">
                  Reintentar fallidos
                </Button>
                <Button onClick={clearDeadLetter} variant="ghost" size="sm" className="flex-1">
                  Descartar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <span className="text-xl">Última sync</span>
                <CardDescription className="mt-0.5">
                  {lastSyncedAt
                    ? new Date(lastSyncedAt).toLocaleString()
                    : 'Nunca'}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
          </div>

          {error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Error de sincronización
                </CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={retryFailed} variant="outline" size="mobile" className="w-full">
                  Reintentar fallidos
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="text-base font-semibold">Cola de sincronización</h2>
            {!queueItems || queueItems.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No hay envíos pendientes ni con error.
                </CardContent>
              </Card>
            ) : (
              queueItems.map((item) => {
            const copy = getSyncErrorCopy(item.last_error_code);
            const isError = ['dead_letter', 'failed_permanent', 'failed', 'retry_wait'].includes(
              item.status
            );
            const canCorrect =
              item.operation_type === 'CREATE_RESPONSE' &&
              (item.status === 'dead_letter' || item.status === 'failed_permanent') &&
              copy.needsManualFix;

            return (
              <Card
                key={item.queue_id}
                className={cn(isError && item.status !== 'retry_wait' && 'border-destructive/40')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span>{operationLabel(item.operation_type)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {statusLabel(item.status)}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs break-all">
                    {item.entity_id}
                  </CardDescription>
                </CardHeader>
                {(item.last_error || item.last_error_code || canCorrect) && (
                  <CardContent className="pt-0 text-sm space-y-2">
                    {(item.last_error || item.last_error_code) && (
                      <>
                        <p className="font-medium text-destructive">{copy.title}</p>
                        <p className="text-muted-foreground">
                          {item.last_error || copy.body || copy.action}
                        </p>
                      </>
                    )}
                    {item.retry_count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Intentos: {item.retry_count}/{item.max_retries}
                      </p>
                    )}
                    {canCorrect && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={correctingId === item.queue_id}
                        onClick={async () => {
                          setCorrectingId(item.queue_id);
                          try {
                            const result = await reopenForCorrection(
                              item.queue_id,
                              item.entity_id
                            );
                            if (!result) {
                              toast.error('No se encontró la respuesta para corregir.');
                              return;
                            }
                            const survey = await db.surveys
                              .where('survey_id')
                              .equals(String(result.surveyId))
                              .first();
                            const title = survey?.title || `Encuesta #${result.surveyId}`;
                            let fromRow: {
                              campaign_id?: number | null;
                              entitlement_id?: number | null;
                              campaign_name?: string | null;
                            } = {};
                            const raw =
                              survey?.entitlement_json ?? survey?.assignment_json;
                            if (raw) {
                              try {
                                fromRow = JSON.parse(raw) as typeof fromRow;
                              } catch {
                                fromRow = {};
                              }
                            }
                            const href = surveyResumeHref({
                              survey_id: result.surveyId,
                              response_id: item.entity_id,
                              survey_title: title,
                              campaign_id: parseOptionalScopeId(fromRow.campaign_id),
                              entitlement_id: parseOptionalScopeId(
                                fromRow.entitlement_id
                              ),
                              campaign_name: fromRow.campaign_name,
                            });
                            if (navigator.onLine) {
                              router.push(href);
                            } else {
                              window.location.assign(href);
                            }
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : 'No se pudo reabrir la respuesta.'
                            );
                          } finally {
                            setCorrectingId(null);
                          }
                        }}
                      >
                        Corregir respuesta
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
