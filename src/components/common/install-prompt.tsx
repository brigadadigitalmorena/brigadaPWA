'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISS_AT_KEY = 'install_banner_dismissed_at';
const DISMISS_COUNT_KEY = 'install_banner_dismissed_count';

function readDismissCount(): number {
  if (typeof window === 'undefined') return 0;
  const count = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
  return Number.isNaN(count) ? 0 : count;
}

function shouldShowBanner(): boolean {
  if (typeof window === 'undefined') return false;
  const lastDismissed = localStorage.getItem(DISMISS_AT_KEY);
  if (!lastDismissed) return true;

  const hoursSinceDismissed = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60);
  const count = readDismissCount();
  if (hoursSinceDismissed < 24) return false;
  if (count >= 3 && hoursSinceDismissed < 168) return false;
  return true;
}

function sitsAboveBottomNav(pathname: string): boolean {
  return !/^\/(login|welcome|activate)(\/|$)/.test(pathname);
}

export function InstallPrompt() {
  const pathname = usePathname();
  const { isInstallable, isInstalled, isIos, install } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const showIosHelp = isIos && !isInstallable;

  useEffect(() => {
    if (isInstalled || pathname.includes('/fill') || !shouldShowBanner()) {
      setVisible(false);
      return;
    }
    if (!isInstallable && !showIosHelp) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, pathname, showIosHelp]);

  const dismiss = () => {
    setVisible(false);
    const nextCount = readDismissCount() + 1;
    localStorage.setItem(DISMISS_AT_KEY, Date.now().toString());
    localStorage.setItem(DISMISS_COUNT_KEY, nextCount.toString());
  };

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Instalar aplicación"
      className={cn(
        'fixed inset-x-3 z-50 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur md:inset-x-auto md:right-4 md:w-[22rem]',
        sitsAboveBottomNav(pathname)
          ? 'bottom-[calc(var(--bottom-nav-chrome)+0.5rem)] md:bottom-4'
          : 'bottom-4'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {showIosHelp ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      </div>
      <p className="min-w-0 flex-1 text-sm leading-snug">
        {showIosHelp
          ? 'Toca Compartir y luego Agregar a inicio para abrirla como app.'
          : 'Instala Brigada. Al confirmar, el navegador la abre como app.'}
      </p>
      {showIosHelp ? null : (
        <Button size="sm" onClick={handleInstall}>
          Instalar
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={dismiss}
        aria-label="Cerrar aviso de instalación"
      >
        <X />
      </Button>
    </div>
  );
}
