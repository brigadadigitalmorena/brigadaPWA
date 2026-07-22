'use client';

import { useEffect, useState } from 'react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

function getDismissedCount(): number {
  if (typeof window === 'undefined') return 0;
  const count = parseInt(localStorage.getItem('install_prompt_dismissed_count') || '0');
  return Number.isNaN(count) ? 0 : count;
}

function shouldShowPrompt(): boolean {
  if (typeof window === 'undefined') return false;

  const lastDismissed = localStorage.getItem('install_prompt_dismissed_at');
  const count = getDismissedCount();

  if (lastDismissed) {
    const hoursSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60);

    if (hoursSinceDismissed < 24 || (count >= 3 && hoursSinceDismissed < 168)) {
      return false;
    }
  }

  return true;
}

export function InstallPrompt() {
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(getDismissedCount);

  useEffect(() => {
    if (!isInstallable || isInstalled) return;
    if (!shouldShowPrompt()) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    const newCount = dismissedCount + 1;
    setDismissedCount(newCount);
    localStorage.setItem('install_prompt_dismissed_at', Date.now().toString());
    localStorage.setItem('install_prompt_dismissed_count', newCount.toString());
  };

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-left">Instalar Brigada Digital</DialogTitle>
                <DialogDescription className="text-left mt-1">
                  Instala la app para acceder más rápido y trabajar offline
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-10 w-10 touch-target"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <p>
                <strong className="text-foreground">Trabaja offline:</strong> Completa encuestas sin conexión a internet
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <p>
                <strong className="text-foreground">Acceso rápido:</strong> Abre la app desde tu pantalla de inicio
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <p>
                <strong className="text-foreground">Sincronización automática:</strong> Tus datos se sincronizan cuando hay conexión
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          <Button
            onClick={handleInstall}
            size="mobile"
            className="w-full"
          >
            <Download className="w-5 h-5" />
            Instalar app
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            size="mobile"
            className="w-full"
          >
            Ahora no
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
