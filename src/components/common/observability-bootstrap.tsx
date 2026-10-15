'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { captureError, initObservability } from '@/lib/observability/client';

export function ObservabilityBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    void initObservability(user ? String(user.id) : undefined);
  }, [user]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      captureError(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      captureError(event.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
