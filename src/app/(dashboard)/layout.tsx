'use client';

import { useEffect, useRef } from 'react';
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
import { purgeEmptyDrafts } from '@/lib/services/draft.service';
import { DraftCountProvider } from '@/components/common/draft-count';
import { NAV_ITEMS } from '@/components/common/nav-items';
import { useKeyboardViewport } from '@/hooks/use-keyboard-inset';

function FillShell({ children }: { children: React.ReactNode }) {
  const { height: viewportHeight } = useKeyboardViewport();

  return (
    <div
      className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background"
      style={
        viewportHeight
          ? { height: viewportHeight, maxHeight: viewportHeight }
          : undefined
      }
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      <ObservabilityBootstrap />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();
  const prefetched = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

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
    // Clear empty draft shells left by hydrate autosave on prior sessions.
    void purgeEmptyDrafts();
  }, [isAuthenticated]);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated || prefetched.current) return;
    if (process.env.NODE_ENV !== 'production') return;
    prefetched.current = true;
    NAV_ITEMS.forEach((item, index) => {
      window.setTimeout(() => router.prefetch(item.href), 400 + index * 120);
    });
  }, [isAuthenticated, router]);

  if (isLoading) {
    return <LoadingState message="Cargando..." minHeight="min-h-screen" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isFillRoute) {
    return <FillShell>{children}</FillShell>;
  }

  return (
    <DraftCountProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar user={user} currentPath={pathname} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <SupportModeBanner />
          <header
            className="flex items-center justify-between border-b bg-white px-4 pr-5 safe-area-top md:pr-6 dark:bg-zinc-950"
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
            ref={mainRef}
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
    </DraftCountProvider>
  );
}
