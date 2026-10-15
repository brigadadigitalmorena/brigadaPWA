export type MapSyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export interface ResponseMapPoint {
  responseId: string;
  surveyId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  syncStatus: MapSyncStatus;
  completedAt?: string;
}

interface ResponseRow {
  response_id: string;
  survey_id: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  sync_status: string;
  status: string;
  completed_at?: string | null;
}

export function mapStatusColor(status: MapSyncStatus): string {
  if (status === 'synced') return '#16a34a';
  if (status === 'pending' || status === 'syncing') return '#d97706';
  return '#dc2626';
}

function toMapStatus(status: string): MapSyncStatus {
  if (status === 'synced') return 'synced';
  if (status === 'syncing' || status === 'pending') return status;
  return 'error';
}

export function toResponseMapPoints(rows: ResponseRow[]): ResponseMapPoint[] {
  return rows.flatMap((row) => {
    const latitude = row.latitude;
    const longitude = row.longitude;
    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return [];
    }
    if (row.status === 'draft') return [];
    return [
      {
        responseId: row.response_id,
        surveyId: row.survey_id,
        latitude,
        longitude,
        accuracy: row.accuracy ?? undefined,
        syncStatus: toMapStatus(row.sync_status),
        completedAt: row.completed_at ?? undefined,
      },
    ];
  });
}

export function responsePointsToGeoJson(
  points: ResponseMapPoint[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      id: point.responseId,
      properties: {
        responseId: point.responseId,
        surveyId: point.surveyId,
        syncStatus: point.syncStatus,
        color: mapStatusColor(point.syncStatus),
        accuracy: point.accuracy ?? null,
      },
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}
