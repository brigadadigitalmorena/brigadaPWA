'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  RefreshCw,
  FileEdit,
  Zap,
  Workflow,
  Map,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/contexts/sync.context';
import { isModuleEnabled } from '@/lib/services/app-config.service';

const allNavItems = [
  {
    label: 'Encuestas',
    href: '/surveys',
    icon: ClipboardList,
    module: 'surveys' as const,
    isActive: (path: string) => path.startsWith('/surveys'),
  },
  {
    label: 'Borradores',
    href: '/drafts',
    icon: FileEdit,
    module: 'drafts' as const,
    isActive: (path: string) => path.startsWith('/drafts'),
  },
  {
    label: 'Prioritarias',
    href: '/extras',
    icon: Zap,
    module: 'extras' as const,
    isActive: (path: string) => path.startsWith('/extras'),
  },
  {
    label: 'Gestión',
    href: '/tracking',
    icon: Workflow,
    module: 'tracking' as const,
    isActive: (path: string) => path.startsWith('/tracking'),
  },
  {
    label: 'Mapas',
    href: '/maps',
    icon: Map,
    module: 'maps' as const,
    isActive: (path: string) => path.startsWith('/maps'),
  },
  {
    label: 'Recorridos',
    href: '/recorridos',
    icon: Navigation,
    module: 'recorridos' as const,
    isActive: (path: string) => path.startsWith('/recorridos'),
  },
  {
    label: 'Mis envíos',
    href: '/sync',
    icon: RefreshCw,
    module: 'sync' as const,
    isActive: (path: string) => path.startsWith('/sync'),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isOnline } = useSync();

  const navItems = allNavItems.filter((item) =>
    isModuleEnabled(item.module, isOnline)
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur md:hidden safe-area-bottom"
      style={{ height: 'var(--bottom-nav-height)' }}
      aria-label="Navegación principal"
    >
      <div className="flex h-full items-stretch overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 transition-colors touch-target',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl px-3 py-1 transition-colors',
                  active && 'bg-primary/10'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  'text-[10px]',
                  active ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
