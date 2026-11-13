'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/common/sidebar';
import { BottomNav } from '@/components/common/bottom-nav';
import { SyncIndicator } from '@/components/sync/sync-indicator';
import { NotificationBell } from '@/components/common/notification-bell';
import { UserMenu } from '@/components/common/user-menu';
import { LoadingState } from '@/components/common/loading-state';
import { FieldStatusBanners } from '@/components/banners/field-status-banners';
import { ObservabilityBootstrap } from '@/components/common/observability-bootstrap';
import { SupportModeBanner } from '@/components/support/support-mode-banner';
import { ClipboardList } from 'lucide-react';
import { registerWebPush } from '@/lib/services/web-push.service';
import { registerPeriodicSync } from '@/lib/services/periodic-sync';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();

  const isFillRoute = pathname.includes('/fill');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerWebPush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    void registerPeriodicSync();
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingState message="Cargando..." minHeight="min-h-screen" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isFillRoute) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-hidden">{children}</main>
        <ObservabilityBootstrap />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} currentPath={pathname} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <SupportModeBanner />
        <header
          className="flex items-center justify-between border-b bg-background px-4 pr-5 safe-area-top md:pr-6"
          style={{ height: 'var(--header-height)' }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 md:hidden">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <h1 className="truncate text-lg font-semibold md:hidden">Brigada</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
            <SyncIndicator />
            <UserMenu user={user} />
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(var(--bottom-nav-chrome)+1rem)] md:pb-6"
        >
          <div className="mb-4">
            <FieldStatusBanners />
          </div>
          {children}
        </main>

        <BottomNav />
      </div>

      <ObservabilityBootstrap />
    </div>
  );
}
