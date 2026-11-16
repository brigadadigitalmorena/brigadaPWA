import type { ValidationRules } from '@/lib/types';
import { distanceMeters } from '@/lib/forms/field-rules';

const DURATION_GRACE_SECONDS = 1.5;

const MEDIA_TYPES = new Set([
  'photo',
  'selfie',
  'photo_no_gallery',
  'photo_canvas',
  'file',
  'signature',
  'voice',
  'video',
]);

const GIS_LINE_TYPES = new Set([
  'gis_line',
  'gis_tracking_manual',
  'gis_tracking_auto',
]);

/**
 * Location, GIS, time and media rules that mobile enforces in
 * `lib/forms/validation.ts`. Returns null when the type has no extra rule
 * or the value passes.
 */
export function validateStructuredAnswer(
  questionType: string,
  value: unknown,
  rules: ValidationRules
): string | null {
  if (questionType === 'time') return validateTime(value, rules);
  if (questionType === 'location') return validateLocation(value, rules);
  if (questionType === 'gis_polygon') return validatePolygon(value, rules);
  if (GIS_LINE_TYPES.has(questionType)) return validateLine(questionType, value, rules);
  if (MEDIA_TYPES.has(questionType)) return validateMedia(value, rules);
  return null;
}

function validateTime(value: unknown, rules: ValidationRules): string | null {
  const parsed = parseTimeValue(value);
  if (parsed === null) return 'Ingresa una hora válida';
  const minTime = parseTimeValue(rules.min_time);
  if (minTime !== null && parsed < minTime) {
    return 'La hora es anterior al mínimo permitido';
  }
  const maxTime = parseTimeValue(rules.max_time);
  if (maxTime !== null && parsed > maxTime) {
    return 'La hora supera el máximo permitido';
  }
  return null;
}

function validateLocation(value: unknown, rules: ValidationRules): string | null {
  const record = asRecord(value);
  const latitude = coordinate(record, ['latitude', 'lat']);
  const longitude = coordinate(record, ['longitude', 'lng', 'lon']);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return 'Ingresa una ubicación válida';
  }
  const maxAccuracy =
    toFiniteNumber(rules.max_accuracy_m) ??
    toFiniteNumber(rules.accuracy_threshold_m);
  const accuracy = toFiniteNumber(record?.accuracy);
  if (maxAccuracy !== null && accuracy !== null && accuracy > maxAccuracy) {
    return `La precisión GPS debe ser menor o igual a ${Math.floor(maxAccuracy)} m`;
  }
  if (rules.require_altitude === true && record?.altitude == null) {
    return 'Esta ubicación requiere altitud GPS';
  }
  return null;
}

function validateLine(
  questionType: string,
  value: unknown,
  rules: ValidationRules
): string | null {
  const points = geometryPoints(value);
  if (questionType === 'gis_line' && points === null) {
    return 'Traza una línea válida';
  }
  if (!points) return null;
  const minPoints = toFiniteNumber(rules.min_points);
  const maxPoints = toFiniteNumber(rules.max_points);
  if (minPoints !== null && points.length < minPoints) {
    return questionType === 'gis_line'
      ? `Dibuja al menos ${Math.floor(minPoints)} puntos`
      : `Registra al menos ${Math.floor(minPoints)} puntos`;
  }
  if (maxPoints !== null && points.length > maxPoints) {
    return `Dibuja máximo ${Math.floor(maxPoints)} puntos`;
  }
  const maxDistance = toFiniteNumber(rules.max_distance_m);
  if (
    questionType === 'gis_line' &&
    maxDistance !== null &&
    totalDistance(points) > maxDistance
  ) {
    return `La distancia máxima permitida es ${Math.floor(maxDistance)} m`;
  }
  return null;
}

function validatePolygon(value: unknown, rules: ValidationRules): string | null {
  const ring = Array.isArray(value) ? latLngList(value) : polygonRing(asRecord(value));
  if (!ring) return 'Dibuja un polígono válido';
  const minPoints = toFiniteNumber(rules.min_points);
  const maxPoints = toFiniteNumber(rules.max_points);
  if (minPoints !== null && ring.length < minPoints) {
    return `Dibuja al menos ${Math.floor(minPoints)} puntos`;
  }
  if (maxPoints !== null && ring.length > maxPoints) {
    return `Dibuja máximo ${Math.floor(maxPoints)} puntos`;
  }
  const area = polygonAreaM2(ring);
  const minArea = toFiniteNumber(rules.min_area_m2);
  const maxArea = toFiniteNumber(rules.max_area_m2);
  if (minArea !== null && area < minArea) {
    return `El área mínima permitida es ${Math.floor(minArea)} m²`;
  }
  if (maxArea !== null && area > maxArea) {
    return `El área máxima permitida es ${Math.floor(maxArea)} m²`;
  }
  const maxDistance = toFiniteNumber(rules.max_distance_m);
  if (maxDistance !== null && totalDistance(ring) > maxDistance) {
    return `El perímetro máximo permitido es ${Math.floor(maxDistance)} m`;
  }
  return null;
}

function validateMedia(value: unknown, rules: ValidationRules): string | null {
  const record = asRecord(value);
  if (!record) return null;
  const maxSizeMb = toFiniteNumber(rules.max_size_mb);
  const size = toFiniteNumber(record.size);
  if (maxSizeMb !== null && size !== null && size > maxSizeMb * 1024 * 1024) {
    return `El archivo no puede superar ${maxSizeMb} MB`;
  }
  const maxDuration =
    toFiniteNumber(rules.max_duration_s) ??
    toFiniteNumber(rules.max_duration_seconds);
  const duration =
    durationSeconds(record.durationSeconds) ??
    durationSeconds(record.duration_s) ??
    durationSeconds(record.duration);
  if (
    maxDuration !== null &&
    duration !== null &&
    duration > maxDuration + DURATION_GRACE_SECONDS
  ) {
    return `La duración máxima permitida es ${maxDuration} s`;
  }
  const allowedMimes = stringList(rules.allowed_mimes);
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : undefined;
  if (!mimeAllowed(mimeType, allowedMimes)) {
    return 'El formato del archivo no está permitido';
  }
  return null;
}

function parseTimeValue(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function coordinate(
  record: Record<string, unknown> | null,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = toFiniteNumber(record?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function isPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function latLngList(value: unknown[]): [number, number][] | null {
  const pairs: [number, number][] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const point = item as { lat?: unknown; lng?: unknown };
    if (typeof point.lat !== 'number' || typeof point.lng !== 'number') return null;
    pairs.push([point.lng, point.lat]);
  }
  return pairs;
}

function geometryPoints(value: unknown): [number, number][] | null {
  if (Array.isArray(value)) return latLngList(value);
  return linePoints(asRecord(value));
}

function linePoints(record: Record<string, unknown> | null): [number, number][] | null {
  const raw = Array.isArray(record?.coordinates)
    ? record.coordinates
    : Array.isArray(record?.points)
      ? record.points
      : null;
  if (!raw || !raw.every(isPair)) return null;
  return raw.map((pair) => [Number(pair[0]), Number(pair[1])]);
}

function polygonRing(record: Record<string, unknown> | null): [number, number][] | null {
  if (record?.type !== 'Polygon' || !Array.isArray(record.coordinates)) return null;
  const ring = record.coordinates[0];
  if (!Array.isArray(ring) || !ring.every(isPair)) return null;
  const points = ring.map((pair) => [Number(pair[0]), Number(pair[1])] as [number, number]);
  if (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    return points.slice(0, -1);
  }
  return points;
}

function totalDistance(points: [number, number][]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) return 0;
    return total + distanceMeters(points[index - 1], point);
  }, 0);
}

function polygonAreaM2(vertices: [number, number][]): number {
  if (vertices.length < 3) return 0;
  const radius = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const originLat = toRad(vertices[0][1]);
  const projected = vertices.map(([lng, lat]) => [
    radius * toRad(lng) * Math.cos(originLat),
    radius * toRad(lat),
  ]);
  const doubleArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(doubleArea) / 2;
}

function durationSeconds(raw: unknown): number | null {
  const value = toFiniteNumber(raw);
  if (value === null || value <= 0) return null;
  return value > 1000 ? value / 1000 : value;
}

function stringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
  }
  return [];
}

function mimeAllowed(mimeType: string | undefined, allowed: string[]): boolean {
  if (allowed.length === 0 || !mimeType) return true;
  const lower = mimeType.toLowerCase();
  return allowed.some((entry) => {
    if (entry.endsWith('/*')) return lower.startsWith(entry.slice(0, -1));
    return lower === entry;
  });
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
