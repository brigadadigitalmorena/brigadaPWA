import { NextRequest, NextResponse } from 'next/server';
import { DEV_OSM_TILE_MANIFEST } from '@/lib/api/osm-tile-manifest-fallback';

const BACKEND_URL = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const BACKEND_REQUEST_TIMEOUT_MS =
  Number(process.env.BACKEND_REQUEST_TIMEOUT_MS) || 30000;

function shouldServeLocalFallback(status: number): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (status === 404 || status === 502 || status === 503)
  );
}

function passthrough(backendResponse: Response, body: ArrayBuffer): NextResponse {
  const headers = new Headers();
  const contentType = backendResponse.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(body, {
    status: backendResponse.status,
    headers,
  });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    BACKEND_REQUEST_TIMEOUT_MS
  );

  try {
    const backendResponse = await fetch(
      `${BACKEND_URL}/mobile/tiles/osm/manifest`,
      {
        method: 'GET',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      }
    );
    const body = await backendResponse.arrayBuffer();

    if (backendResponse.ok || backendResponse.status === 401) {
      return passthrough(backendResponse, body);
    }

    if (shouldServeLocalFallback(backendResponse.status)) {
      console.warn(
        `[pwa-proxy] Backend returned ${backendResponse.status} for mobile/tiles/osm/manifest; serving local OSM fallback.`
      );
      return NextResponse.json(DEV_OSM_TILE_MANIFEST);
    }

    return passthrough(backendResponse, body);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[pwa-proxy] Could not reach backend for OSM tile manifest; serving local fallback.',
        error
      );
      return NextResponse.json(DEV_OSM_TILE_MANIFEST);
    }

    console.error('[pwa-proxy] Failed to reach backend: mobile/tiles/osm/manifest', error);
    return NextResponse.json(
      { detail: 'No se pudo conectar con el servidor' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
