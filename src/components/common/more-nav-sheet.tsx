'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NavItem } from '@/components/common/nav-items';

interface MoreNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  draftCount: number;
}

const CLOSE_MS = 200;

export function MoreNavSheet({
  open,
  onOpenChange,
  items,
  draftCount,
}: MoreNavSheetProps) {
  const pathname = usePathname();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setRendered(false);
    }, CLOSE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector('a')?.focus();
    }, 20);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onOpenChange]);

  if (!rendered) return null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar menú"
        className={cn(
          'fixed inset-x-0 top-0 z-40 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
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
        className={cn(
          'fixed inset-x-0 z-50 overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{
          bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
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
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors touch-target',
                  active
                    ? 'bg-[color-mix(in_oklch,var(--primary)_16%,var(--background))] text-foreground'
                    : 'bg-background text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
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
