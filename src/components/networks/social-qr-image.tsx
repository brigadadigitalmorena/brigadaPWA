'use client';

import { qrcodegen } from '@/lib/qr/qrcodegen';

function qrPath(value: string): { path: string; size: number } {
  const qr = qrcodegen.QrCode.encodeText(value, qrcodegen.QrCode.Ecc.MEDIUM);
  const border = 2;
  const cells: string[] = [];
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.getModule(x, y)) {
        cells.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
  }
  return { path: cells.join(''), size: qr.size + border * 2 };
}

export function SocialQrImage({ value, label }: { value: string; label: string }) {
  let drawing: { path: string; size: number } | null = null;
  try {
    drawing = qrPath(value);
  } catch {
    drawing = null;
  }

  if (!drawing) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo generar el código QR.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${drawing.size} ${drawing.size}`}
      role="img"
      aria-label={`Código QR de ${label}`}
      className="h-56 w-56"
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#fff" />
      <path d={drawing.path} fill="#000" />
    </svg>
  );
}
