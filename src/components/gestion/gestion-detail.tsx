'use client';

import { CalendarClock, Copy, FileText, Hash, MessageSquare, Route } from 'lucide-react';
import { toast } from 'sonner';
import type {
  GestionTrackingRow,
  ManagementStatus,
} from '@/lib/api/gestion.service';
import {
  formatGestionDateTime,
  getGestionReferenceFields,
  getSourceEntries,
} from '@/lib/gestion/display';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CommentThread } from './comment-thread';
import { StatusTimeline } from './status-timeline';

interface GestionDetailProps {
  row: GestionTrackingRow;
  statusLabels: Record<ManagementStatus, string>;
  isOnline: boolean;
}

function DetailRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="break-words text-sm font-medium text-slate-800 dark:text-slate-100">
          {value}
        </p>
      </div>
      {action}
    </div>
  );
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiada`);
  } catch {
    toast.error('No se pudo copiar.');
  }
}

export function GestionDetail({
  row,
  statusLabels,
  isOnline,
}: GestionDetailProps) {
  const sourceEntries = getSourceEntries(row.source_values, {
    idAttributes: row.id_attributes,
  }).filter(
    (entry) =>
      !(
        entry.key.toLowerCase() === 'survey_title' &&
        entry.value === row.survey_title
      )
  );
  const referenceFields = getGestionReferenceFields(row);
  const inactive =
    row.entitlement_status && row.entitlement_status !== 'active';

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Detalle de la solicitud
          </p>
          {inactive && (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Asignación {row.entitlement_status}
              {row.inactive_reason ? `: ${row.inactive_reason}` : ''}
            </p>
          )}
        </div>
        {referenceFields[0] && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() =>
              void copyValue(referenceFields[0].value, referenceFields[0].label)
            }
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copiar ref.
          </Button>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="info" className="min-h-10">
            <FileText aria-hidden />
            <span className="hidden sm:inline">Información</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10">
            <Route aria-hidden />
            Historial
          </TabsTrigger>
          <TabsTrigger value="comments" className="min-h-10">
            <MessageSquare aria-hidden />
            <span className="hidden sm:inline">Comentarios</span>
            <span className="sm:hidden">Chat</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-2">
          {sourceEntries.length > 0 ? (
            sourceEntries.map((entry) => (
              <DetailRow
                key={entry.key}
                icon={FileText}
                label={entry.label}
                value={entry.value}
              />
            ))
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-slate-500">
              No hay datos de captura adicionales.
            </p>
          )}
          {referenceFields.map((field) => (
            <DetailRow
              key={field.label}
              icon={Hash}
              label={field.label}
              value={field.value}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Copiar ${field.label}`}
                  onClick={() => void copyValue(field.value, field.label)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </Button>
              }
            />
          ))}
          {row.comments?.trim() && (
            <div className="rounded-lg border bg-card px-3 py-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nota de seguimiento
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{row.comments}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          <DetailRow
            icon={CalendarClock}
            label="Capturada"
            value={formatGestionDateTime(row.created_at)}
          />
          <DetailRow
            icon={CalendarClock}
            label="Última actualización"
            value={formatGestionDateTime(row.updated_at)}
          />
          {row.closed_at && (
            <DetailRow
              icon={CalendarClock}
              label="Cerrada"
              value={formatGestionDateTime(row.closed_at)}
            />
          )}
          <StatusTimeline
            history={row.status_history ?? []}
            statusLabels={statusLabels}
          />
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <CommentThread requestId={row.request_id} isOnline={isOnline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
