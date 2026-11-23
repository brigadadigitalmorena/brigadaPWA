'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronUp, Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSync } from '@/contexts/sync.context';
import { Badge } from '@/components/ui/badge';
import { MoreNavSheet } from '@/components/common/more-nav-sheet';
import { useDraftCount } from '@/components/common/draft-count';
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
  const [pressedHref, setPressedHref] = useState<string | null>(null);

  const primaryItems = getPrimaryNavItems(isOnline);
  const moreItems = getMoreNavItems(isOnline);
  const morePressed =
    pressedHref !== null && moreItems.some((item) => item.href === pressedHref);
  const moreActive =
    morePressed || (pressedHref === null && isMoreRouteActive(pathname, isOnline));

  useEffect(() => {
    setPressedHref(null);
  }, [pathname]);

  return (
    <>
      <MoreNavSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        draftCount={draftCount}
        onItemPress={setPressedHref}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-chrome-surface md:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Navegación principal"
      >
        <div
          className="flex items-stretch px-1"
          style={{ height: 'var(--bottom-nav-height)' }}
        >
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active =
              pressedHref !== null
                ? item.href === pressedHref
                : item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                onClick={() => setPressedHref(item.href)}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 touch-target',
                  active
                    ? 'text-primary'
                    : 'text-slate-700 hover:text-foreground dark:text-slate-300'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center rounded-xl px-3 py-1',
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
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 touch-target',
              moreActive || moreOpen
                ? 'text-primary'
                : 'text-slate-700 hover:text-foreground dark:text-slate-300'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center px-3 py-1',
                moreOpen
                  ? 'rounded-full bg-primary text-primary-foreground'
                  : 'rounded-xl',
                !moreOpen && (moreActive ? 'bg-primary/10' : '')
              )}
            >
              {moreOpen ? (
                <ChevronUp size={22} strokeWidth={2.5} />
              ) : (
                <Ellipsis size={22} strokeWidth={moreActive ? 2.5 : 2} />
              )}
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
