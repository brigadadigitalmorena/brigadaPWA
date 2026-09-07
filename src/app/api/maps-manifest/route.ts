import { NextRequest, NextResponse } from 'next/server';
import { isAllowedManifestUrl } from '@/lib/api/maps-manifest-hosts';

const FETCH_TIMEOUT_MS = Number(process.env.BACKEND_REQUEST_TIMEOUT_MS) || 30000;

/**
 * Server-side fetch for static-map GeoJSON manifests stored on R2.
 * The browser cannot load those URLs directly (CORS / Failed to fetch).
 */
export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ detail: 'Falta url' }, { status: 400 });
  }
  if (!isAllowedManifestUrl(rawUrl)) {
    return NextResponse.json({ detail: 'URL de manifiesto no permitida' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(rawUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    headers.set('content-type', contentType || 'application/json');
    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('[maps-manifest] Failed to fetch remote manifest', error);
    return NextResponse.json(
      { detail: 'No se pudo descargar el manifiesto' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
