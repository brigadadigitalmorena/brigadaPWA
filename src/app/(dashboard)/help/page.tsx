'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/common/page-header';

const SECTIONS = [
  {
    title: 'General',
    items: [
      {
        question: '¿Qué es Brigada Digital?',
        answer:
          'Es la herramienta de campo para aplicar encuestas. Lo que capturas se guarda en este dispositivo y se envía cuando hay conexión.',
      },
      {
        question: '¿Se puede usar sin internet?',
        answer:
          'Sí. Encuestas, borradores y envíos pendientes siguen disponibles. El indicador del encabezado muestra si estás en línea.',
      },
    ],
  },
  {
    title: 'Encuestas',
    items: [
      {
        question: '¿Cómo retomo un borrador?',
        answer:
          'Entra a Borradores y toca Continuar. La encuesta abre en la última pregunta guardada.',
      },
      {
        question: '¿Qué hago si un envío fue rechazado?',
        answer:
          'En Mis envíos, abre Pendientes y usa Corregir respuesta. Eso reabre el borrador y quita el envío fallido.',
      },
    ],
  },
  {
    title: 'Cuenta',
    items: [
      {
        question: '¿Cómo cambio mi contraseña?',
        answer: 'Menú de usuario → Perfil y contraseña → Cambiar contraseña.',
      },
    ],
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>(SECTIONS[0].items[0].question);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Ayuda" description="Preguntas frecuentes de campo" />
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{section.title}</h2>
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
                  <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
