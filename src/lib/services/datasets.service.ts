/**
 * Offline datasets cache for large choice lists / zip autofill.
 */

import { db, kvGet, kvSet } from '@/lib/db/database';
import apiClient from '@/lib/api/client';
import type { ZipSettlement } from '@/lib/forms/zip-answer';

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

const ZIP_LOOKUP_PREFIX = 'zip_lookup_v1:';
const zipMemoryCache = new Map<string, ZipSettlement[]>();

export async function lookupZipSettlements(code: string): Promise<ZipSettlement[]> {
  if (!/^\d{5}$/.test(code)) return [];

  const cached = zipMemoryCache.get(code);
  if (cached) return cached;

  const stored = await kvGet(`${ZIP_LOOKUP_PREFIX}${code}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as ZipSettlement[];
      if (Array.isArray(parsed)) {
        zipMemoryCache.set(code, parsed);
        return parsed;
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  const fromCatalog = settlementsFromCatalog(await readCachedDatasets(), code);
  if (fromCatalog.length > 0) {
    zipMemoryCache.set(code, fromCatalog);
    await kvSet(`${ZIP_LOOKUP_PREFIX}${code}`, JSON.stringify(fromCatalog));
    return fromCatalog;
  }

  try {
    const response = await apiClient.get<{ settlements?: ZipSettlement[] }>(
      `/mobile/zip-lookup/${encodeURIComponent(code)}`
    );
    const settlements = (response.data.settlements ?? []).map(normalizeSettlement);
    zipMemoryCache.set(code, settlements);
    await kvSet(`${ZIP_LOOKUP_PREFIX}${code}`, JSON.stringify(settlements));
    return settlements;
  } catch {
    return [];
  }
}

/** Zip lookup against cached catalog or network. */
export async function zipLookupOfflineFirst(
  code: string
): Promise<Record<string, unknown> | null> {
  const settlements = await lookupZipSettlements(code);
  if (settlements.length === 0) return null;
  const first = settlements[0];
  return { ...first, label: first.colonia, value: code };
}

function settlementsFromCatalog(
  catalog: DatasetCatalog,
  code: string
): ZipSettlement[] {
  const zipList = catalog['codigo_postal'] || catalog['zip'] || catalog['postal_codes'];
  if (!zipList) return [];
  return zipList
    .filter((item) => item.value === code || String(item.meta?.cp ?? '') === code)
    .map((item) =>
      normalizeSettlement({
        colonia: String(item.meta?.colonia ?? item.label ?? ''),
        tipo: String(item.meta?.tipo ?? ''),
        municipio: String(item.meta?.municipio ?? ''),
        estado: String(item.meta?.estado ?? ''),
        ciudad: String(item.meta?.ciudad ?? ''),
        zona: String(item.meta?.zona ?? ''),
      })
    )
    .filter((row) => row.colonia.length > 0);
}

function normalizeSettlement(row: Partial<ZipSettlement>): ZipSettlement {
  return {
    colonia: String(row.colonia ?? ''),
    tipo: String(row.tipo ?? ''),
    municipio: String(row.municipio ?? ''),
    estado: String(row.estado ?? ''),
    ciudad: String(row.ciudad ?? ''),
    zona: String(row.zona ?? ''),
  };
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
