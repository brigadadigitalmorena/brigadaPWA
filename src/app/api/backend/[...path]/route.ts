import { NextRequest, NextResponse } from 'next/server';

const RAW_BACKEND_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000';

const BACKEND_REQUEST_TIMEOUT_MS =
  Number(process.env.BACKEND_REQUEST_TIMEOUT_MS) || 30000;

const PUBLIC_PATH_PREFIXES = [
  'public/activate/',
  'mobile/login',
  'mobile/token/refresh',
];

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix)
  );
}

function buildTargetUrl(
  baseUrl: string,
  path: string,
  request: NextRequest
): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

function localFallbackBaseUrl(baseUrl: string): string | null {
  if (baseUrl.includes('://localhost:')) {
    return baseUrl.replace('://localhost:', '://127.0.0.1:');
  }
  if (baseUrl.includes('://127.0.0.1:')) {
    return baseUrl.replace('://127.0.0.1:', '://localhost:');
  }
  return null;
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  const path = pathSegments.join('/');
  const authorization = request.headers.get('authorization');

  if (!authorization && !isPublicPath(path)) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }

  const primaryTargetUrl = buildTargetUrl(RAW_BACKEND_URL, path, request);
  const fallbackBaseUrl = localFallbackBaseUrl(RAW_BACKEND_URL);
  const fallbackTargetUrl = fallbackBaseUrl
    ? buildTargetUrl(fallbackBaseUrl, path, request)
    : null;

  const headers: HeadersInit = {};
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  if (authorization) headers['Authorization'] = authorization;

  const forwardHeader = (source: string, target: string) => {
    const value = request.headers.get(source);
    if (value) headers[target] = value;
  };

  forwardHeader('x-request-id', 'X-Request-Id');
  forwardHeader('traceparent', 'traceparent');
  forwardHeader('x-trace-id', 'X-Trace-Id');
  forwardHeader('idempotency-key', 'Idempotency-Key');
  forwardHeader('x-mobile-api-version', 'X-Mobile-Api-Version');
  forwardHeader('x-app-version', 'X-App-Version');

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = await request.text();
  }

  const fetchWithTimeout = async (targetUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      BACKEND_REQUEST_TIMEOUT_MS
    );

    try {
      return await fetch(targetUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let backendResponse: Response;
  try {
    backendResponse = await fetchWithTimeout(primaryTargetUrl);
  } catch (primaryError) {
    if (!fallbackTargetUrl) {
      console.error(`[pwa-proxy] Failed to reach backend: ${path}`, primaryError);
      return NextResponse.json(
        { detail: 'No se pudo conectar con el servidor' },
        { status: 502 }
      );
    }

    try {
      backendResponse = await fetchWithTimeout(fallbackTargetUrl);
    } catch (fallbackError) {
      console.error(`[pwa-proxy] Failed to reach backend: ${path}`, fallbackError);
      return NextResponse.json(
        { detail: 'No se pudo conectar con el servidor' },
        { status: 502 }
      );
    }
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    'content-type',
    'x-request-id',
    'x-trace-id',
    'traceparent',
    'x-mobile-api-version',
    'x-mobile-api-min-supported',
    'x-app-version',
  ];

  for (const headerName of passthroughHeaders) {
    const value = backendResponse.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  const body = await backendResponse.arrayBuffer();
  return new NextResponse(body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
