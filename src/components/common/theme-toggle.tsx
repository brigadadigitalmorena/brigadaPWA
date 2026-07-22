'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  className?: string;
  size?: 'icon' | 'icon-sm';
}

export function ThemeToggle({ className, size = 'icon-sm' }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={className}
        aria-hidden
        disabled
      />
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={className}
      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
      aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
