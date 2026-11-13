'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { SocialQrImage } from '@/components/networks/social-qr-image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getSocialLinks,
  type SocialLinkItem,
} from '@/lib/api/networks.service';

export default function NetworksPage() {
  const [links, setLinks] = useState<SocialLinkItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );
  const [qr, setQr] = useState<SocialLinkItem | null>(null);

  useEffect(() => {
    void getSocialLinks().then((result) => {
      setLinks(result.links);
      setStatus(result.unavailable ? 'unavailable' : 'ready');
    });
  }, []);

  const share = async (link: SocialLinkItem) => {
    if (!link.url) {
      toast.error('Esta red no tiene enlace.');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: link.label, text: link.label, url: link.url });
      return;
    }
    await navigator.clipboard.writeText(link.url);
    toast.success('Enlace copiado');
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Redes" description="Canales oficiales para compartir" />
      {status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Cargando redes…</p>
      ) : status === 'unavailable' ? (
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar las redes. Revisa la conexión e inténtalo de nuevo.
        </p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay redes configuradas. Se cargan desde la configuración pública cuando hay conexión.
        </p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={`${link.platform}-${link.label}`} className="rounded-xl border bg-card p-4">
              <p className="font-medium">{link.label}</p>
              <p className="text-sm capitalize text-muted-foreground">{link.platform}</p>
              <p className="truncate text-sm text-muted-foreground">{link.url ?? 'Sin enlace'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {link.url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(link.url!, '_blank', 'noopener')}>
                    Abrir
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void share(link)}>
                  Compartir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!link.url) {
                      toast.error('Esta red no tiene enlace, no se puede generar el QR.');
                      return;
                    }
                    setQr(link);
                  }}
                >
                  QR
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(qr)} onOpenChange={(open) => !open && setQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR de {qr?.label ?? 'campaña'}</DialogTitle>
            <DialogDescription>
              Escanea para abrir el enlace oficial de esta red.
            </DialogDescription>
          </DialogHeader>
          {qr?.url ? (
            <div className="flex justify-center">
              <SocialQrImage value={qr.url} label={qr.label} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
