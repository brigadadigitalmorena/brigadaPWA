import { NextRequest, NextResponse } from 'next/server';
import { buildPwaManifest, resolveChromeColor } from '@/lib/pwa-manifest';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const color = resolveChromeColor(
    request.cookies.get('brigada-pwa-chrome')?.value,
    request.nextUrl.searchParams.get('theme_color')
  );

  return NextResponse.json(buildPwaManifest(color), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  });
}
