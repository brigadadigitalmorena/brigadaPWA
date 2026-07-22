'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { registerServiceWorker } from '@/lib/service-worker';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const handleUpdate = () => {
      toast('Nueva versión disponible', {
        description: 'Recarga la app para obtener las últimas mejoras.',
        action: {
          label: 'Recargar',
          onClick: () => window.location.reload(),
        },
        duration: Infinity,
      });
    };

    window.addEventListener('sw-update-available', handleUpdate);
    registerServiceWorker();

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  return null;
}
