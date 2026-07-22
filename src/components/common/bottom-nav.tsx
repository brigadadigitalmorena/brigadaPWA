'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Encuestas',
    href: '/surveys',
    icon: ClipboardList,
    isActive: (path: string) => path.startsWith('/surveys'),
  },
  {
    label: 'Sincronización',
    href: '/sync',
    icon: RefreshCw,
    isActive: (path: string) => path.startsWith('/sync'),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur md:hidden safe-area-bottom"
      style={{ height: 'var(--bottom-nav-height)' }}
      aria-label="Navegación principal"
    >
      <div className="flex h-full items-stretch">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 transition-colors touch-target',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl px-5 py-1 transition-colors',
                  active && 'bg-primary/10'
                )}
              >
                <Icon size={24} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  'text-xs',
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
