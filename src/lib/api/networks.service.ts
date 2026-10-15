import { apiClient } from '@/lib/api/client';

export interface SocialLinkItem {
  platform: string;
  label: string;
  url: string | null;
  qr_url: string | null;
}

const CACHE_KEY = 'brigada_social_links';

export async function getSocialLinks(): Promise<SocialLinkItem[]> {
  try {
    const response = await apiClient.get<{ social_links?: SocialLinkItem[] }>(
      '/public/app-config'
    );
    const links = Array.isArray(response.data.social_links)
      ? response.data.social_links
      : [];
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(links));
    }
    return links;
  } catch {
    if (typeof sessionStorage === 'undefined') return [];
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    try {
      const parsed = JSON.parse(cached) as SocialLinkItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
