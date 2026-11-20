'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NavItem } from '@/components/common/nav-items';

interface MoreNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemPress: (href: string) => void;
  items: NavItem[];
  draftCount: number;
}

export function MoreNavSheet({
  open,
  onOpenChange,
  onItemPress,
  items,
  draftCount,
}: MoreNavSheetProps) {
  const pathname = usePathname();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector('a')?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar menú"
        className="fixed inset-x-0 top-0 z-40 bg-black"
        style={{
          bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={() => onOpenChange(false)}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 z-50 overflow-hidden rounded-t-2xl border-t border-border bg-white opacity-100 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-zinc-950"
        style={{
          bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'var(--background)',
        }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <h2 id={titleId} className="sr-only">
          Más opciones
        </h2>

        <nav
          aria-label="Más opciones"
          className="max-h-[min(70dvh,28rem)] space-y-1 overflow-y-auto px-3 pb-3"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);
            const showDraftBadge = item.badge === 'drafts' && draftCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                onClick={() => {
                  onItemPress(item.href);
                  onOpenChange(false);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 touch-target',
                  active
                    ? 'bg-slate-100 text-foreground dark:bg-zinc-800'
                    : 'bg-white text-foreground hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-foreground">
                      {item.label}
                    </span>
                    {showDraftBadge ? (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5">
                        {draftCount}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
