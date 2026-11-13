'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/contexts/sync.context';
import { Badge } from '@/components/ui/badge';
import { MoreNavSheet } from '@/components/common/more-nav-sheet';
import { useDraftCount } from '@/components/common/use-draft-count';
import {
  getMoreNavItems,
  getPrimaryNavItems,
  isMoreRouteActive,
} from '@/components/common/nav-items';

export function BottomNav() {
  const pathname = usePathname();
  const { isOnline } = useSync();
  const draftCount = useDraftCount();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = getPrimaryNavItems(isOnline);
  const moreItems = getMoreNavItems(isOnline);
  const moreActive = isMoreRouteActive(pathname, isOnline);

  return (
    <>
      <MoreNavSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        draftCount={draftCount}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur md:hidden safe-area-bottom"
        style={{ height: 'var(--bottom-nav-height)' }}
        aria-label="Navegación principal"
      >
        <div className="flex h-full items-stretch px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors touch-target',
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
                    'max-w-full truncate text-[10px] leading-tight',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Más opciones"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors touch-target',
              moreActive || moreOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center rounded-xl px-3 py-1 transition-colors',
                (moreActive || moreOpen) && 'bg-primary/10'
              )}
            >
              <Ellipsis size={22} strokeWidth={moreActive || moreOpen ? 2.5 : 2} />
            </div>
            <span
              className={cn(
                'text-[10px] leading-tight',
                moreActive || moreOpen ? 'font-semibold' : 'font-medium'
              )}
            >
              Más
            </span>
            {draftCount > 0 ? (
              <Badge
                variant="default"
                className="absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]"
              >
                {draftCount > 9 ? '9+' : draftCount}
              </Badge>
            ) : null}
          </button>
        </div>
      </nav>
    </>
  );
}
