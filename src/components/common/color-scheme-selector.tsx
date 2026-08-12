'use client';

import { Check } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

export function ColorSchemeSelector() {
  const { colorScheme, availableSchemes, setColorScheme, mounted } = useTheme();

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Color de la app</p>
      <div className="grid grid-cols-3 gap-2">
        {availableSchemes.map((scheme) => {
          const selected = scheme.id === colorScheme;
          return (
            <button
              key={scheme.id}
              type="button"
              onClick={() => setColorScheme(scheme.id)}
              aria-pressed={selected}
              aria-label={scheme.name}
              className={cn(
                'relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors touch-target',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-accent/50'
              )}
            >
              <span className="flex h-6 w-11 overflow-hidden rounded-md">
                <span
                  className="h-full w-1/2"
                  style={{ backgroundColor: scheme.swatchLight }}
                />
                <span
                  className="h-full w-1/2"
                  style={{ backgroundColor: scheme.swatchDark }}
                />
              </span>
              <span
                className={cn(
                  'text-[11px] leading-tight',
                  selected
                    ? 'font-semibold text-primary'
                    : 'font-medium text-foreground'
                )}
              >
                {scheme.name}
              </span>
              {selected && (
                <Check
                  className="absolute right-1 top-1 h-3.5 w-3.5 text-primary"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
