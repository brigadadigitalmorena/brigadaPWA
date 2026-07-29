'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/lib/db/database';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit } from 'lucide-react';

export default function DraftsPage() {
  const drafts = useLiveQuery(
    () => db.responses.where('status').equals('draft').reverse().sortBy('updated_at'),
    []
  );

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
                <CardTitle className="text-base">
                  Encuesta #{draft.survey_id}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Actualizado {new Date(draft.updated_at).toLocaleString()}
                </p>
                <Link
                  href={`/surveys/${draft.survey_id}/fill`}
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  Continuar
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
