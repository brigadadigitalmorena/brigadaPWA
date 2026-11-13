'use client';

import { Handshake, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function SupportModeBanner() {
  const { isSupport, collectedByName, supportCreatorName, logout } = useAuth();

  if (!isSupport) return null;

  const exit = async () => {
    const ok = window.confirm('¿Deseas cerrar esta sesión de apoyo?');
    if (!ok) return;
    try {
      await logout();
      toast.success('Saliste de Modo Apoyo');
      window.location.href = '/login';
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo salir de Modo Apoyo'
      );
    }
  };

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2 text-sm">
          <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>
            <span className="font-semibold">
              MODO APOYO · de {supportCreatorName ?? 'brigadista'}
            </span>
            <br />
            <span className="text-muted-foreground">
              Hola, {collectedByName ?? 'apoyo'}
            </span>
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void exit()}>
          <LogOut className="mr-1 h-4 w-4" />
          Salir
        </Button>
      </div>
    </div>
  );
}
