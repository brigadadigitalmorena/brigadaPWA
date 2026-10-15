'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { getSocialLinks, type SocialLinkItem } from '@/lib/api/networks.service';

export default function NetworksPage() {
  const [links, setLinks] = useState<SocialLinkItem[]>([]);
  const [qr, setQr] = useState<SocialLinkItem | null>(null);

  useEffect(() => {
    void getSocialLinks().then(setLinks);
  }, []);

  const share = async (link: SocialLinkItem) => {
    if (!link.url) {
      toast.error('Esta red no tiene enlace.');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: link.label, url: link.url });
      return;
    }
    await navigator.clipboard.writeText(link.url);
    toast.success('Enlace copiado');
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Redes" description="Canales oficiales para compartir" />
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay redes configuradas. Se cargan desde la configuración pública cuando hay conexión.
        </p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={`${link.platform}-${link.label}`} className="rounded-xl border bg-card p-4">
              <p className="font-medium">{link.label}</p>
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
                {link.qr_url && (
                  <Button size="sm" variant="ghost" onClick={() => setQr(link)}>
                    QR
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {qr?.qr_url && (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 font-medium">{qr.label}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qr_url} alt={`Código QR de ${qr.label}`} className="h-48 w-48" />
        </div>
      )}
    </div>
  );
}
