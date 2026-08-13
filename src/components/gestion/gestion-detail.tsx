import { CalendarClock, FileText, Hash, MessageSquare, Route } from 'lucide-react';
import type {
  GestionTrackingRow,
  ManagementStatus,
} from '@/lib/api/gestion.service';
import {
  buildFolioDisplay,
  formatGestionDateTime,
  STATUS_BADGE_CLASSES,
} from '@/lib/gestion/display';
import { Badge } from '@/components/ui/badge';
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
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function GestionDetail({
  row,
  statusLabels,
  isOnline,
}: GestionDetailProps) {
  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-lg font-semibold">{row.survey_title}</h2>
          <p className="mt-1 text-sm font-medium text-primary">
            {buildFolioDisplay(row)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={STATUS_BADGE_CLASSES[row.management_status]}
        >
          {statusLabels[row.management_status]}
        </Badge>
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
          <DetailRow icon={Hash} label="Tracking ID" value={row.tracking_id || '—'} />
          <DetailRow icon={Hash} label="Referencia" value={row.request_id} />
          {row.comments?.trim() && (
            <div className="rounded-lg border bg-card px-3 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Nota de seguimiento
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{row.comments}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
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
