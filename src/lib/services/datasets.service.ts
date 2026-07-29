/**
 * Offline datasets cache for large choice lists / zip autofill.
 */

import { db, kvGet, kvSet } from '@/lib/db/database';
import apiClient from '@/lib/api/client';

const DATASETS_KV = 'datasets_catalog_v1';

export interface DatasetItem {
  id: string | number;
  label: string;
  value: string;
  meta?: Record<string, unknown>;
}

export interface DatasetCatalog {
  [datasetKey: string]: DatasetItem[];
}

export async function fetchAndCacheDatasets(): Promise<DatasetCatalog> {
  try {
    const response = await apiClient.get<DatasetCatalog | { datasets: DatasetCatalog }>(
      '/mobile/datasets'
    );
    const catalog = Array.isArray(response.data)
      ? {}
      : 'datasets' in (response.data as object)
        ? (response.data as { datasets: DatasetCatalog }).datasets
        : (response.data as DatasetCatalog);

    await kvSet(DATASETS_KV, JSON.stringify(catalog));
    return catalog;
  } catch (err) {
    const cached = await readCachedDatasets();
    if (Object.keys(cached).length > 0) {
      console.warn('Using cached datasets', err);
      return cached;
    }
    throw err;
  }
}

export async function readCachedDatasets(): Promise<DatasetCatalog> {
  const raw = await kvGet(DATASETS_KV);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as DatasetCatalog;
  } catch {
    return {};
  }
}

export async function getDatasetItems(datasetKey: string): Promise<DatasetItem[]> {
  const catalog = await readCachedDatasets();
  if (catalog[datasetKey]) return catalog[datasetKey];

  try {
    const fresh = await fetchAndCacheDatasets();
    return fresh[datasetKey] ?? [];
  } catch {
    return [];
  }
}

/** Zip lookup against cached catalog or network. */
export async function zipLookupOfflineFirst(code: string): Promise<Record<string, unknown> | null> {
  const catalog = await readCachedDatasets();
  const zipList = catalog['codigo_postal'] || catalog['zip'] || catalog['postal_codes'];
  if (zipList) {
    const hit = zipList.find(
      (item) => item.value === code || String(item.meta?.cp ?? '') === code
    );
    if (hit) return { ...(hit.meta ?? {}), label: hit.label, value: hit.value };
  }

  try {
    const response = await apiClient.get<Record<string, unknown>>(
      `/mobile/zip/${encodeURIComponent(code)}`
    );
    return response.data;
  } catch {
    return null;
  }
}

/** Warm datasets after login when online. */
export async function warmDatasetsIfOnline(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await fetchAndCacheDatasets();
  } catch {
    /* non-fatal */
  }
  // Touch db so Dexie stays opened for subsequent writes
  await db.open();
}
