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
  items: NavItem[];
  draftCount: number;
}

export function MoreNavSheet({
  open,
  onOpenChange,
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

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar menú"
        className="fixed inset-x-0 top-0 z-40 bg-black/45"
        style={{
          bottom: 'var(--bottom-nav-chrome)',
        }}
        onClick={() => onOpenChange(false)}
      />

      <div
        ref={panelRef}
        role="menu"
        aria-labelledby={titleId}
        className="fixed z-50 flex max-h-[min(70dvh,28rem)] w-[min(17.5rem,calc(100vw-1.25rem))] flex-col items-stretch gap-2 overflow-y-auto pr-2"
        style={{
          right: 0,
          bottom: 'calc(var(--bottom-nav-chrome) + 0.35rem)',
        }}
      >
        <h2 id={titleId} className="sr-only">
          Más opciones
        </h2>

        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          const showDraftBadge = item.badge === 'drafts' && draftCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => onOpenChange(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-md transition-colors touch-target',
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                  active ? 'bg-primary/15' : 'bg-muted'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {item.label}
                  </span>
                  {showDraftBadge ? (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5">
                      {draftCount}
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
