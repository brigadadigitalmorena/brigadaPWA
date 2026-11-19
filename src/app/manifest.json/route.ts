import { NextRequest, NextResponse } from 'next/server';
import { buildPwaManifest, normalizeHexColor } from '@/lib/pwa-manifest';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const color =
    normalizeHexColor(request.nextUrl.searchParams.get('theme_color')) ??
    normalizeHexColor(request.cookies.get('brigada-pwa-chrome')?.value) ??
    '#FF1B8D';

  return NextResponse.json(buildPwaManifest(color), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  });
}
