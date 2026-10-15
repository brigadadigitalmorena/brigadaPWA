'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { PageHeader } from '@/components/common/page-header';

export default function DebugPage() {
  const queue = useLiveQuery(() => db.sync_queue.toArray(), []) ?? [];
  const responses = useLiveQuery(() => db.responses.count(), []) ?? 0;
  const [online, setOnline] = useState(true);
  const [storage, setStorage] = useState<string>('—');
  const [sw, setSw] = useState('sin service worker');

  useEffect(() => {
    setOnline(navigator.onLine);
    void navigator.storage?.estimate?.().then((estimate) => {
      const used = Math.round((estimate.usage ?? 0) / (1024 * 1024));
      const quota = Math.round((estimate.quota ?? 0) / (1024 * 1024));
      setStorage(`${used} MB de ${quota} MB`);
    });
    setSw(navigator.serviceWorker?.controller ? 'activo' : 'inactivo');
  }, []);

  const recent = [...queue]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Diagnóstico"
        description="Estado local para soporte. No muestra tokens."
      />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border p-3">
          <dt className="text-muted-foreground">En línea</dt>
          <dd className="font-medium">{online ? 'sí' : 'no'}</dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-muted-foreground">Service worker</dt>
          <dd className="font-medium">{sw}</dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-muted-foreground">Respuestas locales</dt>
          <dd className="font-medium">{responses}</dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-muted-foreground">Almacenamiento</dt>
          <dd className="font-medium">{storage}</dd>
        </div>
      </dl>
      <ul className="space-y-2">
        {recent.map((item) => (
          <li key={item.queue_id} className="rounded-xl border p-3 text-sm">
            <p className="font-medium">
              {item.operation_type} · {item.status}
            </p>
            <p className="text-muted-foreground">
              {item.entity_id}
              {item.last_error_code ? ` · ${item.last_error_code}` : ''}
            </p>
          </li>
        ))}
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground">La cola de sync está vacía.</p>
        )}
      </ul>
    </div>
  );
}
