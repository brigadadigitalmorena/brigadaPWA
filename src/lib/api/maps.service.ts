import { apiClient } from './client';

export interface MobileMapSyncItem {
  map_id: number;
  name: string;
  description: string | null;
  version: number;
  manifest_etag: string;
  manifest_url: string;
  manifest_r2_key?: string | null;
  published_at: string;
}

export interface MobileMapSyncResponse {
  /** String representation of the latest StaticMapPublication.id. */
  server_etag: string;
  maps: MobileMapSyncItem[];
}

export type MobileMapsResult =
  | { status: 'not-modified' }
  | { status: 'ok'; data: MobileMapSyncResponse };

export async function getMobileMaps(
  since?: string,
  signal?: AbortSignal
): Promise<MobileMapsResult> {
  const response = await apiClient.get<MobileMapSyncResponse>('/mobile/maps', {
    params: since === undefined ? undefined : { since },
    signal,
    timeout: 30_000,
    validateStatus: (status) => status === 200 || status === 304,
  });

  return response.status === 304
    ? { status: 'not-modified' }
    : { status: 'ok', data: response.data };
}
