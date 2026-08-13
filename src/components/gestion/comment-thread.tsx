'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  getGestionComments,
  postGestionComment,
  type GestionComment,
} from '@/lib/api/gestion.service';
import { formatGestionDateTime } from '@/lib/gestion/display';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CommentThreadProps {
  requestId: string;
  isOnline: boolean;
}

export function CommentThread({
  requestId,
  isOnline,
}: CommentThreadProps) {
  const [comments, setComments] = useState<GestionComment[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(
    async (silent = false) => {
      if (!isOnline) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        setComments(await getGestionComments(requestId));
      } catch {
        setError('No se pudieron cargar los comentarios.');
      } finally {
        setLoading(false);
      }
    },
    [isOnline, requestId]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadComments(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadComments]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadComments(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadComments]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [comments]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending || !isOnline) return;
    setSending(true);
    setError(null);
    try {
      const created = await postGestionComment(requestId, trimmed);
      setComments((current) => [...current, created]);
      setMessage('');
    } catch {
      setError('No se pudo enviar el comentario. Intenta nuevamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="max-h-[40vh] min-h-32 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3 lg:max-h-[45vh]"
        aria-live="polite"
      >
        {loading ? (
          <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Cargando conversación...
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isOnline
              ? 'Aún no hay comentarios.'
              : 'Conéctate para consultar la conversación.'}
          </p>
        ) : (
          comments.map((comment) => {
            const isUser = comment.author_type === 'user';
            return (
              <div
                key={comment.id}
                className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2',
                    isUser
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border bg-background'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {comment.message}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      isUser
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    {comment.author_name || (isUser ? 'Tú' : 'Gestión')} ·{' '}
                    {formatGestionDateTime(comment.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder={
            isOnline ? 'Escribe un comentario...' : 'Comentarios no disponibles offline'
          }
          disabled={!isOnline || sending}
          rows={2}
          maxLength={2000}
          aria-label="Nuevo comentario"
          className="min-h-12 resize-none"
        />
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-xl"
          onClick={() => void handleSend()}
          disabled={!isOnline || sending || message.trim().length === 0}
          aria-label="Enviar comentario"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-5 w-5" aria-hidden />
          )}
        </Button>
      </div>
      {!isOnline && (
        <p className="text-xs text-muted-foreground">
          La información guardada sigue disponible; para conversar necesitas conexión.
        </p>
      )}
    </div>
  );
}
