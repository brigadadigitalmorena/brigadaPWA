'use client';

import type { MouseEvent } from 'react';
import { ClipboardList, MapPinned, WifiOff } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SEEN_KEY = 'brigada_welcome_seen';

function goToLogin(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode / blocked storage — still allow login.
  }
  // Hard navigation: Next <Link> soft/RSC nav can hang on mobile and leave
  // the login Suspense on "Cargando...". Same idea as redirectToLoginOnce.
  window.location.assign('/login');
}

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-primary">Brigada Digital</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Encuestas de campo, también sin señal
        </h1>
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
      {/* Plain <a> fallback if JS never hydrates; onClick forces a full load. */}
      <a
        href="/login"
        onClick={goToLogin}
        className={cn(buttonVariants({ size: 'mobile' }), 'w-full')}
      >
        Entrar
      </a>
    </main>
  );
}
