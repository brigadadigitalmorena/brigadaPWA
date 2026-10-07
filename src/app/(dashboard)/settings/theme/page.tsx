'use client';

import { Moon, Sun } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ColorSchemeSelector } from '@/components/common/color-scheme-selector';
import { useTheme } from '@/contexts/theme-context';

export default function ThemeSettingsPage() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <PageHeader title="Apariencia" description="Tema y color de la aplicación" />
      <Button
        type="button"
        variant="outline"
        size="mobile"
        className="justify-start gap-3"
        onClick={toggleTheme}
        disabled={!mounted}
      >
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        {theme === 'light' ? 'Usar modo oscuro' : 'Usar modo claro'}
      </Button>
      <ColorSchemeSelector />
    </div>
  );
}
