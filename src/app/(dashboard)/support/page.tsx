'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Handshake,
  QrCode,
  RefreshCw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { SocialQrImage } from '@/components/networks/social-qr-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth.context';
import { useSync } from '@/contexts/sync.context';
import {
  createSupportSession,
  dismissSupportSession,
  duplicateSupportSession,
  getSupportCredentials,
  getSupportStats,
  listSupportSessions,
  reactivateSupportSession,
  revokeSupportSession,
  type CreateSupportSessionResponse,
  type SupportSession,
  type SupportStatsResponse,
} from '@/lib/api/support.service';
import { hasSupportCapability } from '@/lib/support/access-policy';

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'active':
      return 'Activo';
    case 'revoked':
      return 'Revocado';
    case 'expired':
      return 'Expirado';
    default:
      return status;
  }
}

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default function SupportModePage() {
  const { isSupport } = useAuth();
  const { isOnline } = useSync();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [stats, setStats] = useState<SupportStatsResponse | null>(null);
  const [maxSessions, setMaxSessions] = useState(3);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [helperName, setHelperName] = useState('');
  const [allowGestiones, setAllowGestiones] = useState(false);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] =
    useState<CreateSupportSessionResponse | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<SupportSession | null>(
    null
  );

  const refresh = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, statsResult] = await Promise.all([
        listSupportSessions(),
        getSupportStats(),
      ]);
      setSessions(list.sessions);
      setMaxSessions(list.max_sessions);
      setActiveCount(list.active_count);
      setStats(statsResult);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las sesiones de apoyo.'
      );
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (isSupport) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <PageHeader
          title="Modo Apoyo"
          description="Esta sesión es de ayudante; no puedes gestionar apoyos desde aquí."
        />
      </div>
    );
  }

  const canAdd = activeCount < maxSessions;

  const createOrDuplicate = async () => {
    const name = helperName.trim();
    if (!name) {
      toast.error('Escribe el nombre de quien te apoyará.');
      return;
    }
    if (!isOnline) {
      toast.error('Necesitas conexión para crear un apoyo.');
      return;
    }
    setCreating(true);
    try {
      const caps = allowGestiones ? (['gestiones'] as const) : [];
      const created = duplicateFrom
        ? await duplicateSupportSession(
            duplicateFrom.session_id,
            name,
            [...caps]
          )
        : await createSupportSession(name, null, [...caps]);
      setCredentials(created);
      setHelperName('');
      setAllowGestiones(false);
      setDuplicateFrom(null);
      toast.success('Sesión de apoyo lista');
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo crear el apoyo.'
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Modo Apoyo"
        description="Genera un código o QR para que alguien te ayude a capturar encuestas"
      />

      {!isOnline && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          Sin conexión: puedes ver esta pantalla, pero crear o gestionar apoyos
          requiere internet.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3 text-center">
        <div>
          <p className="text-xl font-semibold text-primary">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Activos</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-primary">
            {stats?.total_responses ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">Encuestas</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-muted-foreground">
            {activeCount}/{maxSessions}
          </p>
          <p className="text-xs text-muted-foreground">Límite</p>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">
            {duplicateFrom ? 'Duplicar apoyo' : 'Agregar apoyo'}
          </h2>
        </div>
        {!canAdd ? (
          <p className="text-sm text-muted-foreground">
            Límite de apoyos activos alcanzado ({maxSessions})
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="helper-name">Nombre del apoyo</Label>
              <Input
                id="helper-name"
                value={helperName}
                onChange={(event) => setHelperName(event.target.value)}
                placeholder="Ej. María Pérez"
                maxLength={100}
                disabled={!isOnline || creating}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allowGestiones}
                onCheckedChange={(value) => setAllowGestiones(value === true)}
                disabled={!isOnline || creating}
              />
              Permitir gestiones
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void createOrDuplicate()}
                disabled={!isOnline || creating}
              >
                {creating ? 'Creando…' : duplicateFrom ? 'Duplicar' : 'Crear apoyo'}
              </Button>
              {duplicateFrom && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDuplicateFrom(null);
                    setHelperName('');
                    setAllowGestiones(false);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Sesiones
          </h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void refresh()}
            disabled={!isOnline || loading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <Handshake className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 font-medium">No hay apoyos activos</p>
            <p className="text-sm text-muted-foreground">
              Agrega un apoyo para que alguien te ayude a levantar encuestas
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <li
                key={session.session_id}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{session.helper_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Vence {formatWhen(session.expires_at)} ·{' '}
                      {session.survey_count} envío
                      {session.survey_count === 1 ? '' : 's'}
                      {hasSupportCapability(
                        session.allowed_capabilities,
                        'gestiones'
                      )
                        ? ' · gestiones'
                        : ''}
                    </p>
                  </div>
                  <Badge variant={session.is_active ? 'default' : 'secondary'}>
                    {statusLabel(session.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          setCredentials(
                            await getSupportCredentials(session.session_id)
                          );
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'No se pudo obtener el código'
                          );
                        }
                      }}
                    >
                      <QrCode className="mr-1 h-4 w-4" />
                      Código / QR
                    </Button>
                  )}
                  {session.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDuplicateFrom(session);
                        setHelperName('');
                        setAllowGestiones(
                          hasSupportCapability(
                            session.allowed_capabilities,
                            'gestiones'
                          )
                        );
                      }}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Duplicar
                    </Button>
                  )}
                  {session.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `¿Revocar el apoyo de ${session.helper_name}?`
                          )
                        ) {
                          return;
                        }
                        try {
                          await revokeSupportSession(session.session_id);
                          toast.success('Apoyo revocado');
                          await refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'No se pudo revocar'
                          );
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Revocar
                    </Button>
                  )}
                  {!session.is_active && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            setCredentials(
                              await reactivateSupportSession(session.session_id)
                            );
                            toast.success('Apoyo reactivado');
                            await refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'No se pudo reactivar'
                            );
                          }
                        }}
                      >
                        Reactivar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await dismissSupportSession(session.session_id);
                            toast.success('Tarjeta ocultada');
                            await refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'No se pudo ocultar'
                            );
                          }
                        }}
                      >
                        Quitar
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={Boolean(credentials)}
        onOpenChange={(open) => !open && setCredentials(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Código de {credentials?.helper_name ?? 'apoyo'}
            </DialogTitle>
            <DialogDescription>
              Comparte el código o el QR para que la persona se una como apoyo.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-mono text-3xl tracking-[0.3em]">
                {credentials.access_code}
              </p>
              <SocialQrImage
                value={credentials.qr_data}
                label={credentials.helper_name}
              />
              <p className="text-center text-sm text-muted-foreground">
                Vence {formatWhen(credentials.expires_at)}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(credentials.access_code);
                  toast.success('Código copiado');
                }}
              >
                Copiar código
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
