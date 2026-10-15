export interface TimelineEvent {
  type: string;
  label: string;
  at: string;
  detail?: string;
}

const LABELS: Record<string, string> = {
  draft_created: 'Borrador creado',
  response_submitted: 'Encuesta enviada',
  sync_enqueued: 'Encolado para sincronización',
  sync_succeeded: 'Sincronización exitosa',
  sync_failed: 'Fallo de sincronización',
};

interface ResponseLike {
  created_at: string;
  completed_at?: string | null;
  updated_at: string;
  sync_status: string;
  sync_error?: string | null;
  last_synced_at?: string | null;
}

interface QueueLike {
  operation_type: string;
  status: string;
  created_at: string;
  processed_at?: string | null;
  last_error?: string | null;
  last_error_code?: string | null;
}

export function buildResponseTimeline(
  response: ResponseLike,
  queue: QueueLike[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      type: 'draft_created',
      label: LABELS.draft_created,
      at: response.created_at,
    },
  ];

  if (response.completed_at) {
    events.push({
      type: 'response_submitted',
      label: LABELS.response_submitted,
      at: response.completed_at,
    });
  }

  for (const item of queue) {
    events.push({
      type: 'sync_enqueued',
      label: LABELS.sync_enqueued,
      at: item.created_at,
      detail: item.operation_type,
    });
    if (item.status === 'completed' && item.processed_at) {
      events.push({
        type: 'sync_succeeded',
        label: LABELS.sync_succeeded,
        at: item.processed_at,
        detail: item.operation_type,
      });
    }
    if (
      (item.status === 'failed' ||
        item.status === 'failed_permanent' ||
        item.status === 'dead_letter') &&
      item.last_error
    ) {
      events.push({
        type: 'sync_failed',
        label: LABELS.sync_failed,
        at: item.processed_at || response.updated_at,
        detail: item.last_error_code || item.last_error,
      });
    }
  }

  if (response.sync_status === 'synced' && response.last_synced_at) {
    const already = events.some((event) => event.type === 'sync_succeeded');
    if (!already) {
      events.push({
        type: 'sync_succeeded',
        label: LABELS.sync_succeeded,
        at: response.last_synced_at,
      });
    }
  }

  if (response.sync_status === 'error' && response.sync_error) {
    events.push({
      type: 'sync_failed',
      label: LABELS.sync_failed,
      at: response.updated_at,
      detail: response.sync_error,
    });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
