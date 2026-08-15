'use client';

import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { staticMapsRepository } from '@/lib/services/static-maps.repository';
import {
  syncStaticMaps,
  type StaticMapsSyncResult,
} from '@/lib/services/static-maps-sync.service';

export function useOfflineMaps(selectedMapId?: number | null) {
  const maps = useLiveQuery(() => staticMapsRepository.listMaps(), [], undefined);
  const featureCounts = useLiveQuery(
    () => staticMapsRepository.getFeatureCounts(),
    [],
    undefined
  );
  const selectedMap = useLiveQuery(
    () =>
      selectedMapId == null
        ? staticMapsRepository.getFirstMap()
        : staticMapsRepository.getMap(selectedMapId),
    [selectedMapId],
    undefined
  );
  const features = useLiveQuery(
    async () => {
      const mapId =
        selectedMapId ?? (await staticMapsRepository.getFirstMap())?.map_id;
      return mapId == null ? [] : staticMapsRepository.getFeatures(mapId);
    },
    [selectedMapId],
    undefined
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<StaticMapsSyncResult | null>(null);

  const sync = useCallback(async () => {
    if (isSyncing) return null;
    setIsSyncing(true);
    try {
      const result = await syncStaticMaps();
      setSyncResult(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    maps: maps ?? [],
    featureCounts: featureCounts ?? new Map<number, number>(),
    selectedMap,
    features: features ?? [],
    isLoading: maps === undefined || featureCounts === undefined,
    isViewerLoading:
      selectedMapId != null && (selectedMap === undefined || features === undefined),
    isSyncing,
    syncResult,
    sync,
  };
}
