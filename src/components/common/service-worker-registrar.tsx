'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import {
  applyWaitingServiceWorker,
  registerServiceWorker,
} from '@/lib/service-worker';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const handleUpdate = () => {
      toast('Nueva versión disponible', {
        description: 'Recarga la app para obtener las últimas mejoras.',
        action: {
          label: 'Recargar',
          onClick: () => {
            void applyWaitingServiceWorker();
          },
        },
        duration: Infinity,
      });
    };

    window.addEventListener('sw-update-available', handleUpdate);
    void registerServiceWorker();

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  return null;
}
