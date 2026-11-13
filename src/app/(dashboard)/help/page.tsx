'use client';

import { useState } from 'react';
import { CheckCircle2, LifeBuoy, Mail } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'brigadadigitalmorena@gmail.com';

const TIPS = [
  'Sincroniza tus encuestas al recuperar internet',
  'Mantén actualizada tu foto y datos de perfil',
  'Adjunta captura al reportar incidencias',
];

/** FAQ aligned with mobile `app/help.tsx` (wording adapted for PWA). */
const SECTIONS = [
  {
    title: 'General',
    items: [
      {
        question: '¿Qué es Brigada Digital?',
        answer:
          'Es una plataforma para gestionar encuestas de campo. Los brigadistas aplican encuestas en territorio, los encargados supervisan equipos y los administradores gestionan todo desde el CMS web.',
      },
      {
        question: '¿Se puede usar sin internet?',
        answer:
          'Sí. Las encuestas se guardan localmente y se sincronizan cuando tengas conexión. El indicador de conexión en el encabezado muestra tu estado.',
      },
    ],
  },
  {
    title: 'Encuestas',
    items: [
      {
        question: '¿Cómo empiezo una encuesta?',
        answer:
          'Ve a Encuestas, selecciona una encuesta asignada y toca Iniciar. Responde cada pregunta y al terminar confirma el envío.',
      },
      {
        question: '¿Puedo guardar y continuar después?',
        answer:
          'Sí, las respuestas se guardan como borrador automáticamente. Puedes cerrar la app y retomar donde la dejaste desde Borradores.',
      },
      {
        question: '¿Cómo subo fotos o documentos?',
        answer:
          'En preguntas de tipo archivo, usa cámara o galería. Los archivos se suben cuando haya conexión y aparecen como pendientes mientras tanto.',
      },
    ],
  },
  {
    title: 'Sincronización',
    items: [
      {
        question: "¿Qué significa un envío pendiente?",
        answer:
          'Indica respuestas guardadas localmente que aún no se envían al servidor. Conéctate a internet y deja que la sincronización termine, o abre Mis envíos.',
      },
      {
        question: '¿Mis datos se pierden si borro el sitio?',
        answer:
          'Los datos ya sincronizados están seguros en el servidor. Los borradores pendientes sí se perderían, así que sincroniza antes de limpiar datos del navegador.',
      },
    ],
  },
  {
    title: 'Cuenta y Perfil',
    items: [
      {
        question: '¿Cómo cambio mi foto de perfil?',
        answer:
          'Ve a Perfil y contraseña → foto de perfil. Puedes tomar una foto o elegir una de tu galería.',
      },
      {
        question: '¿Cómo cambio mi contraseña?',
        answer:
          'Ve a Perfil y contraseña → Cambiar contraseña. Necesitarás tu contraseña actual para confirmar el cambio.',
      },
      {
        question: '¿No puedo iniciar sesión, qué hago?',
        answer:
          'Verifica que tu cuenta esté activada. Si el problema persiste, contacta al administrador de tu brigada o escribe al correo de soporte.',
      },
    ],
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].items[0].question);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Ayuda" description="Preguntas frecuentes de campo" />

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Centro de ayuda</h2>
            <p className="text-sm text-muted-foreground">
              Resuelve dudas rápidas sobre uso, sincronización y soporte
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {TIPS.map((tip) => (
            <li
              key={tip}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {section.title}
          </h2>
          {section.items.map((item) => {
            const expanded = open === item.question;
            return (
              <button
                key={item.question}
                type="button"
                className="w-full rounded-xl border bg-card p-4 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.question)}
              >
                <p className="font-medium">{item.question}</p>
                {expanded && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                )}
              </button>
            );
          })}
        </section>
      ))}

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Soporte</h2>
            <p className="text-sm text-muted-foreground">
              Contáctanos si necesitas ayuda adicional
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-3 h-auto py-3"
          onClick={() => {
            window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Soporte Brigada Digital')}`;
          }}
        >
          <Mail className="h-5 w-5 shrink-0" />
          <span className="text-left">
            <span className="block font-medium">Correo de soporte</span>
            <span className="block text-sm font-normal text-muted-foreground">
              {SUPPORT_EMAIL}
            </span>
          </span>
        </Button>
      </section>

      <div className="rounded-xl border bg-card px-4 py-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Brigada Digital
        </p>
        <p className="text-xs text-muted-foreground">v{appVersion}</p>
      </div>
    </div>
  );
}
