'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/api/notifications.service';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const next = await getUnreadNotificationCount();
        if (!cancelled) setCount(next);
      } catch {
        /* badge is best-effort */
      }
    };

    const startup = window.setTimeout(() => {
      void load();
    }, 0);
    const timer = window.setInterval(load, 60_000);
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.clearTimeout(startup);
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
      aria-label={
        count > 0 ? `${count} notificaciones sin leer` : 'Notificaciones'
      }
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span
          className={cn(
            'absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground'
          )}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
