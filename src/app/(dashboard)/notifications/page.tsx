'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/utils/api-errors';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type NotificationItem,
} from '@/lib/api/notifications.service';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 50 });
      setItems(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar las notificaciones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      const updated = await markNotificationRead(item.id);
      setItems((current) =>
        current.map((row) => (row.id === item.id ? updated : row))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      /* non-blocking */
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((row) => ({ ...row, read: true })));
      setUnreadCount(0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron marcar como leídas.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description={unreadCount > 0 ? `${unreadCount} sin leer` : 'Bandeja de avisos'}
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={handleReadAll}>
              Marcar todas
            </Button>
          ) : null
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin notificaciones"
          description="Cuando haya avisos de encuestas o gestiones, aparecerán aquí."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const href = notificationHref(item.action_url);
            return (
              <Card key={item.id} className={cn(!item.read && 'border-primary/40')}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.message}</p>
                    </div>
                    {!item.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    {href && (
                      <Link href={href} onClick={() => void handleRead(item)}>
                        <Button size="sm">Abrir</Button>
                      </Link>
                    )}
                    {!item.read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRead(item)}
                      >
                        Marcar leída
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
