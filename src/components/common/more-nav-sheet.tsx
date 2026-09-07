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
        className="fixed inset-x-0 top-0 z-40 bg-black/40"
        style={{
          bottom: 'var(--bottom-nav-chrome)',
        }}
        onClick={() => onOpenChange(false)}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 z-40 rounded-t-2xl border-t bg-background px-3 pb-3 pt-2 shadow-lg"
        style={{ bottom: 'var(--bottom-nav-chrome)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <h2 id={titleId} className="sr-only">
          Más opciones
        </h2>

        <nav aria-label="Más opciones" className="flex flex-col gap-1">
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-primary/15' : 'bg-muted'
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-medium">{item.label}</span>
                    {showDraftBadge ? (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5">
                        {draftCount}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">
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
