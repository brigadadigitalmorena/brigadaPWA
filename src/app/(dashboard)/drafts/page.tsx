'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/lib/db/database';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileEdit, Trash2 } from 'lucide-react';
import { readCachedEntitlement } from '@/lib/utils/survey-version';
import { deleteDraft } from '@/lib/services/draft.service';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function DraftsPage() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const drafts = useLiveQuery(async () => {
    const rows = await db.responses
      .where('status')
      .equals('draft')
      .reverse()
      .sortBy('updated_at');

    const withTitles = await Promise.all(
      rows.map(async (draft) => {
        const survey = await db.surveys
          .where('survey_id')
          .equals(String(draft.survey_id))
          .first();

        const sessionTitle = readCachedEntitlement(Number(draft.survey_id))
          ?.survey_title;

        return {
          ...draft,
          survey_title:
            survey?.title ||
            sessionTitle ||
            `Encuesta #${draft.survey_id}`,
        };
      })
    );

    return withTitles;
  }, []);

  const handleDelete = async (responseId: string, title: string) => {
    const ok = await confirm({
      title: '¿Borrar borrador?',
      description: `Se eliminará “${title}” de este dispositivo. Esta acción no se puede deshacer.`,
      confirmText: 'Borrar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    setDeletingId(responseId);
    try {
      await deleteDraft(responseId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Borradores"
        description="Continúa encuestas guardadas en este dispositivo"
      />

      {!drafts || drafts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="Sin borradores"
          description="Cuando guardes una encuesta a medias, aparecerá aquí."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <Card key={draft.response_id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">
                  {draft.survey_title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Actualizado {new Date(draft.updated_at).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={deletingId === draft.response_id}
                    onClick={() =>
                      handleDelete(draft.response_id, draft.survey_title)
                    }
                    aria-label={`Borrar borrador ${draft.survey_title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link
                    href={`/surveys/${draft.survey_id}/fill?title=${encodeURIComponent(draft.survey_title)}`}
                    className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    Continuar
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
