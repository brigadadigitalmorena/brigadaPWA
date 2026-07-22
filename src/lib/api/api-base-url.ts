/**
 * Resolve API base URL for client vs server contexts.
 * Browser requests go through the Next.js proxy to avoid CORS in production.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/backend';
  }

  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  );
}
