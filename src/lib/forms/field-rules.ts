import type { ValidationRules } from '@/lib/types';

export const BARCODE_DETECTOR_FORMATS = [
  'aztec',
  'codabar',
  'code_39',
  'code_93',
  'code_128',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'pdf417',
  'qr_code',
  'upc_a',
  'upc_e',
] as const;

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf';

export function ruleNumber(
  rules: ValidationRules | undefined,
  key: string
): number | undefined {
  const value = rules?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function barcodePattern(
  rules: ValidationRules | undefined
): string | undefined {
  const pattern = rules?.pattern ?? rules?.regex;
  return typeof pattern === 'string' && pattern.trim() ? pattern : undefined;
}

export function matchesBarcodePattern(
  value: string,
  pattern: string | undefined
): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
}

export function maxDurationSeconds(
  rules: ValidationRules | undefined
): number | undefined {
  const value = ruleNumber(rules, 'max_duration_s');
  if (value == null || value <= 0) return undefined;
  return value;
}

export function signatureStrokeLimits(rules: ValidationRules | undefined): {
  min: number;
  max: number;
} {
  return {
    min: Math.max(0, Math.floor(ruleNumber(rules, 'required_strokes') ?? 0)),
    max: Math.max(0, Math.floor(ruleNumber(rules, 'max_strokes') ?? 0)),
  };
}

export function strokeCountAllowed(
  count: number,
  limits: { min: number; max: number }
): string | null {
  if (limits.min > 0 && count < limits.min) {
    return `La firma necesita al menos ${limits.min} trazo${limits.min === 1 ? '' : 's'}.`;
  }
  if (limits.max > 0 && count > limits.max) {
    return `La firma admite como máximo ${limits.max} trazos.`;
  }
  return null;
}

export interface GisTrack {
  type: 'LineString';
  coordinates: [number, number][];
  timestamps: string[];
}

export function distanceMeters(
  first: [number, number],
  second: [number, number]
): number {
  const radius = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(second[1] - first[1]);
  const dLon = toRad(second[0] - first[0]);
  const lat1 = toRad(first[1]);
  const lat2 = toRad(second[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function emptyTrack(): GisTrack {
  return { type: 'LineString', coordinates: [], timestamps: [] };
}

export function readTrack(value: unknown): GisTrack {
  if (!value || typeof value !== 'object') return emptyTrack();
  const record = value as {
    type?: string;
    coordinates?: unknown;
    timestamps?: unknown;
  };
  if (record.type !== 'LineString' || !Array.isArray(record.coordinates)) {
    return emptyTrack();
  }
  const coordinates = record.coordinates.flatMap((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return [];
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [[lng, lat] as [number, number]];
  });
  const timestamps = Array.isArray(record.timestamps)
    ? record.timestamps.filter((item): item is string => typeof item === 'string')
    : [];
  return { type: 'LineString', coordinates, timestamps };
}

export function appendTrackSample(
  track: GisTrack,
  coordinate: [number, number],
  timestamp: string,
  minDistanceM: number
): GisTrack {
  const last = track.coordinates[track.coordinates.length - 1];
  if (last && distanceMeters(last, coordinate) < minDistanceM) {
    return track;
  }
  return {
    type: 'LineString',
    coordinates: [...track.coordinates, coordinate],
    timestamps: [...track.timestamps, timestamp],
  };
}

export function gisSampleIntervalMs(rules: ValidationRules | undefined): number {
  const seconds = ruleNumber(rules, 'interval_s') ?? 30;
  return Math.max(30, seconds) * 1000;
}
