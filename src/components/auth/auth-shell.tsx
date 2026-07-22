'use client';

import { ReactNode } from 'react';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface AuthShellProps {
  children: ReactNode;
  layout?: 'center' | 'top';
  showThemeToggle?: boolean;
}

export function AuthShell({
  children,
  layout = 'center',
  showThemeToggle = true,
}: AuthShellProps) {
  const containerClass =
    layout === 'center'
      ? 'relative min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/15 via-background to-background p-4 safe-area-top safe-area-bottom'
      : 'relative min-h-screen flex items-start md:items-center justify-center overflow-y-auto bg-gradient-to-b from-primary/15 via-background to-background px-4 pb-8 pt-14 safe-area-top safe-area-bottom';

  const innerClass =
    layout === 'center' ? 'w-full max-w-md space-y-6' : 'w-full max-w-md pt-2';

  return (
    <div className={containerClass}>
      {showThemeToggle && (
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
      )}
      <div className={innerClass}>{children}</div>
    </div>
  );
}
