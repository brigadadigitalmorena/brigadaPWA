import type {
  GestionStatusHistoryEntry,
  ManagementStatus,
} from '@/lib/api/gestion.service';
import { formatGestionDateTime } from '@/lib/gestion/display';
import { Badge } from '@/components/ui/badge';

interface StatusTimelineProps {
  history: GestionStatusHistoryEntry[];
  statusLabels: Record<ManagementStatus, string>;
}

export function StatusTimeline({
  history,
  statusLabels,
}: StatusTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="rounded-lg bg-muted/60 px-3 py-4 text-center text-sm text-muted-foreground">
        Aún no hay cambios de estado.
      </p>
    );
  }

  return (
    <ol className="space-y-0" aria-label="Historial de estados">
      {[...history].reverse().map((entry, index) => (
        <li
          key={`${entry.changed_at}-${index}`}
          className="relative grid grid-cols-[1rem_1fr] gap-3 pb-5 last:pb-0"
        >
          {index < history.length - 1 && (
            <span className="absolute left-[7px] top-4 h-full w-px bg-border" />
          )}
          <span className="relative mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {entry.from_status && (
                <>
                  <Badge variant="secondary">
                    {statusLabels[entry.from_status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">a</span>
                </>
              )}
              <Badge variant="outline">{statusLabels[entry.to_status]}</Badge>
            </div>
            {entry.note && (
              <p className="mt-2 whitespace-pre-wrap text-sm">{entry.note}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.changed_by_name || 'Sistema'} ·{' '}
              {formatGestionDateTime(entry.changed_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
