const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  '.r2.cloudflarestorage.com',
  '.r2.dev',
  '.brigadadigital.com',
] as const;

const DEFAULT_ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'tiles.brigadadigital.com',
]);

function extraAllowedHosts(): string[] {
  return (process.env.MAP_MANIFEST_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isLocalManifestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

export function isAllowedManifestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (DEFAULT_ALLOWED_HOSTS.has(host)) return true;
  if (extraAllowedHosts().includes(host)) return true;
  return DEFAULT_ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isAllowedManifestUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol === 'https:') {
    return isAllowedManifestHost(parsed.hostname);
  }

  if (parsed.protocol === 'http:') {
    return isLocalManifestHost(parsed.hostname);
  }

  return false;
}
