'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { LoadingState } from '@/components/common/loading-state';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/home');
      } else {
        const seen =
          typeof window !== 'undefined' &&
          localStorage.getItem('brigada_welcome_seen') === '1';
        router.replace(seen ? '/login' : '/welcome');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return <LoadingState message="Cargando..." minHeight="min-h-screen" />;
}
