import { NextRequest, NextResponse } from 'next/server';
import { buildPwaManifest, isHexColor } from '@/lib/pwa-manifest';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const fromQuery = request.nextUrl.searchParams.get('theme_color');
  const fromCookie = request.cookies.get('brigada-pwa-chrome')?.value;
  const color = isHexColor(fromQuery)
    ? fromQuery
    : isHexColor(fromCookie)
      ? fromCookie
      : '#FF1B8D';

  return NextResponse.json(buildPwaManifest(color), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  });
}
