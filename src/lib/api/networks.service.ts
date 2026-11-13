import { apiClient } from '@/lib/api/client';

export interface SocialLinkItem {
  platform: string;
  label: string;
  url: string | null;
  qr_url: string | null;
}

export interface SocialLinksResult {
  links: SocialLinkItem[];
  /** True when the public config request failed and nothing was cached. */
  unavailable: boolean;
}

const CACHE_KEY = 'brigada_social_links';

function readStored(storage: Storage | undefined): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function writeStored(storage: Storage | undefined, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, value);
  } catch {
    // Private mode or quota: the in-memory result still renders.
  }
}

function normalizeLinks(value: unknown): SocialLinkItem[] {
  if (!Array.isArray(value)) return [];
  const links: SocialLinkItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<SocialLinkItem>;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label) continue;
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    const qrUrl = typeof row.qr_url === 'string' ? row.qr_url.trim() : '';
    links.push({
      platform:
        typeof row.platform === 'string' && row.platform.trim()
          ? row.platform.trim()
          : 'other',
      label,
      url: url || null,
      qr_url: qrUrl || null,
    });
  }
  return links;
}

function readCache(): SocialLinkItem[] {
  if (typeof window === 'undefined') return [];
  const raw =
    readStored(window.localStorage) ?? readStored(window.sessionStorage);
  if (!raw) return [];
  try {
    return normalizeLinks(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeCache(links: SocialLinkItem[]): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(links);
  writeStored(window.localStorage, serialized);
  writeStored(window.sessionStorage, serialized);
}

export async function getSocialLinks(): Promise<SocialLinksResult> {
  try {
    const response = await apiClient.get<{ social_links?: unknown }>(
      '/public/app-config'
    );
    const links = normalizeLinks(response.data?.social_links);
    writeCache(links);
    return { links, unavailable: false };
  } catch {
    const cached = readCache();
    return { links: cached, unavailable: cached.length === 0 };
  }
}
