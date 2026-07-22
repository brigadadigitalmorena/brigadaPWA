'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/common/sidebar';
import { BottomNav } from '@/components/common/bottom-nav';
import { SyncIndicator } from '@/components/sync/sync-indicator';
import { UserMenu } from '@/components/common/user-menu';
import { InstallPrompt } from '@/components/common/install-prompt';
import { LoadingState } from '@/components/common/loading-state';
import { ClipboardList } from 'lucide-react';

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
        <InstallPrompt />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} currentPath={pathname} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="flex items-center justify-between border-b bg-background px-4 safe-area-top"
          style={{ height: 'var(--header-height)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 md:hidden">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-semibold truncate md:hidden">Brigada</h1>
          </div>

          <div className="flex items-center gap-3">
            <SyncIndicator />
            <UserMenu user={user} />
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] md:pb-6"
        >
          {children}
        </main>

        <BottomNav />
      </div>

      <InstallPrompt />
    </div>
  );
}
