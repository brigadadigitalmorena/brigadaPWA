'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import {
  NetworkPlatformIcon,
  networkSubtitle,
} from '@/components/networks/network-platform-icon';
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
      await navigator.share({
        title: link.label,
        text: link.label,
        url: link.url,
      });
      return;
    }
    await navigator.clipboard.writeText(link.url);
    toast.success('Enlace copiado');
  };

  const openLink = (link: SocialLinkItem) => {
    if (!link.url) {
      toast.error('Esta red no tiene enlace.');
      return;
    }
    window.open(link.url, '_blank', 'noopener');
  };

  const showQr = (link: SocialLinkItem) => {
    if (!link.url) {
      toast.error('Esta red no tiene enlace, no se puede generar el QR.');
      return;
    }
    setQr(link);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Redes" description="Canales oficiales para compartir" />
      {status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Cargando redes…</p>
      ) : status === 'unavailable' ? (
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar las redes. Revisa la conexión e inténtalo de
          nuevo.
        </p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay redes configuradas. Se cargan desde la configuración pública
          cuando hay conexión.
        </p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li
              key={`${link.platform}-${link.label}`}
              className="rounded-2xl border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <NetworkPlatformIcon
                  platform={link.platform}
                  label={link.label}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{link.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {networkSubtitle(link.platform, link.label)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  type="button"
                  className="min-w-0 flex-1"
                  onClick={() => void share(link)}
                  disabled={!link.url}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Abrir ${link.label}`}
                  onClick={() => openLink(link)}
                  disabled={!link.url}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`QR de ${link.label}`}
                  onClick={() => showQr(link)}
                  disabled={!link.url}
                >
                  <QrCode className="h-4 w-4" />
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
