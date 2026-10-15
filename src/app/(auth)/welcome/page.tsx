'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList, MapPinned, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SEEN_KEY = 'brigada_welcome_seen';

export default function WelcomePage() {
  const router = useRouter();

  const continueToLogin = () => {
    localStorage.setItem(SEEN_KEY, '1');
    router.replace('/login');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-primary">Brigada Digital</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Encuestas de campo, también sin señal</h1>
      </div>
      <ul className="space-y-4 text-sm">
        <li className="flex gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 text-primary" />
          <span>Aplicas las encuestas asignadas y retomas los borradores cuando quieras.</span>
        </li>
        <li className="flex gap-3">
          <WifiOff className="mt-0.5 h-5 w-5 text-primary" />
          <span>Las respuestas se guardan en el dispositivo y se envían al volver la red.</span>
        </li>
        <li className="flex gap-3">
          <MapPinned className="mt-0.5 h-5 w-5 text-primary" />
          <span>Mapas, recorridos y ubicación siguen disponibles para el trabajo en territorio.</span>
        </li>
      </ul>
      <Button type="button" size="mobile" onClick={continueToLogin}>
        Entrar
      </Button>
    </main>
  );
}
