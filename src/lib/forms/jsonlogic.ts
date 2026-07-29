import jsonLogic from "json-logic-js";

export const JSONLOGIC_SECURITY_MAX_DEPTH = 8;
export const JSONLOGIC_SECURITY_MAX_NODES = 50;
export const JSONLOGIC_SECURITY_FORBIDDEN_OPERATORS = new Set([
  "eval",
  "custom",
]);

export const JSONLOGIC_CUSTOM_OPERATORS = [
  "match",
  "date_diff",
  "count",
  "length",
  "between",
  "geo_area",
  "attachment_size",
] as const;

const EARTH_RADIUS_M = 6378137;
let customOperatorsRegistered = false;

// DOC20-D09 — module-level user context injected before each evaluation.
// Single-threaded JS runtime: setting before evaluateJsonLogicExpression is safe.
export interface JsonLogicCurrentUser {
  name: string | null;
  id: number;
}

let _evalCurrentUser: JsonLogicCurrentUser | null = null;

/**
 * DOC20-D09 — Call before evaluateJsonLogicExpression to inject the
 * authenticated user so {current_user_name:[]} / {current_user_id:[]} ops
 * resolve to real values on device.
 *
 */
export function setCurrentUserForEvaluation(
  user: JsonLogicCurrentUser | null,
): void {
  _evalCurrentUser = user;
}

export class JsonLogicSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonLogicSecurityError";
  }
}

export class JsonLogicEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonLogicEvaluationError";
  }
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseIsoDate(value: unknown): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Invalid date");
    }
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.endsWith("Z") ? value : value;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    const fallback = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  throw new Error(`Unsupported date value: ${String(value)}`);
}

function coerceComparable(value: unknown): unknown {
  const numberValue = coerceNumber(value);
  if (numberValue !== null) {
    return numberValue;
  }

  try {
    return parseIsoDate(value).getTime();
  } catch {
    return value;
  }
}

function opMatch(value: unknown, pattern: unknown): boolean {
  if (value == null || pattern == null) {
    return false;
  }

  try {
    return new RegExp(String(pattern)).test(String(value));
  } catch {
    return false;
  }
}

function opDateDiff(
  dateA: unknown,
  dateB: unknown,
  unit: unknown = "days",
): number {
  const left = parseIsoDate(dateA).getTime();
  const right = parseIsoDate(dateB).getTime();
  const deltaSeconds = (left - right) / 1000;
  const unitKey = String(unit).toLowerCase();

  if (["ms", "millisecond", "milliseconds"].includes(unitKey)) {
    return deltaSeconds * 1000;
  }
  if (["second", "seconds"].includes(unitKey)) {
    return deltaSeconds;
  }
  if (["minute", "minutes"].includes(unitKey)) {
    return deltaSeconds / 60;
  }
  if (["hour", "hours"].includes(unitKey)) {
    return deltaSeconds / 3600;
  }
  if (["day", "days"].includes(unitKey)) {
    return deltaSeconds / 86400;
  }
  if (["week", "weeks"].includes(unitKey)) {
    return deltaSeconds / 604800;
  }
  if (["year", "years"].includes(unitKey)) {
    return deltaSeconds / (86400 * 365.25);
  }
  if (["month", "months"].includes(unitKey)) {
    const leftDate = parseIsoDate(dateA);
    const rightDate = parseIsoDate(dateB);
    const monthDelta =
      (leftDate.getUTCFullYear() - rightDate.getUTCFullYear()) * 12 +
      (leftDate.getUTCMonth() - rightDate.getUTCMonth());
    const dayFraction = (leftDate.getUTCDate() - rightDate.getUTCDate()) / 30;
    return monthDelta + dayFraction;
  }

  throw new Error(`Unsupported date_diff unit: ${String(unit)}`);
}

function opCount(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return 1;
}

function opLength(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "string") {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return String(value).length;
}

function opBetween(value: unknown, min: unknown, max: unknown): boolean {
  const current = coerceComparable(value);
  const lower = coerceComparable(min);
  const upper = coerceComparable(max);

  if (
    typeof current === "number" &&
    typeof lower === "number" &&
    typeof upper === "number"
  ) {
    return lower <= current && current <= upper;
  }

  if (
    typeof current === "string" &&
    typeof lower === "string" &&
    typeof upper === "string"
  ) {
    return lower <= current && current <= upper;
  }

  return false;
}

function ringAreaSquareMeters(ring: unknown): number {
  if (!Array.isArray(ring)) {
    return 0;
  }

  const points: [number, number][] = [];
  for (const pair of ring) {
    if (!Array.isArray(pair) || pair.length < 2) {
      continue;
    }

    const lon = coerceNumber(pair[0]);
    const lat = coerceNumber(pair[1]);
    if (lon === null || lat === null) {
      continue;
    }

    points.push([lon, lat]);
  }

  if (points.length < 3) {
    return 0;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    points.push(first);
  }

  const lat0 = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);

  const projected = points.map(([lon, lat]) => {
    const x = ((lon * Math.PI) / 180) * EARTH_RADIUS_M * cosLat0;
    const y = ((lat * Math.PI) / 180) * EARTH_RADIUS_M;
    return [x, y] as [number, number];
  });

  let area2 = 0;
  for (let i = 0; i < projected.length - 1; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[i + 1];
    area2 += x1 * y2 - x2 * y1;
  }

  return Math.abs(area2) * 0.5;
}

function polygonAreaSquareMeters(polygonCoords: unknown): number {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) {
    return 0;
  }

  const shellArea = ringAreaSquareMeters(polygonCoords[0]);
  let holesArea = 0;
  for (let i = 1; i < polygonCoords.length; i += 1) {
    holesArea += ringAreaSquareMeters(polygonCoords[i]);
  }
  return Math.max(shellArea - holesArea, 0);
}

function opGeoArea(geojsonPolygon: unknown): number {
  if (!geojsonPolygon || typeof geojsonPolygon !== "object") {
    return 0;
  }

  const geometry = geojsonPolygon as {
    type?: string;
    coordinates?: unknown;
  };

  if (geometry.type === "Polygon") {
    return polygonAreaSquareMeters(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.reduce(
      (sum, poly) => sum + polygonAreaSquareMeters(poly),
      0,
    );
  }

  return 0;
}

function opAttachmentSize(attachment: unknown): number {
  if (attachment == null) {
    return 0;
  }

  const direct = coerceNumber(attachment);
  if (direct !== null) {
    return Math.max(0, Math.trunc(direct));
  }

  if (Array.isArray(attachment)) {
    return attachment.reduce((sum, item) => sum + opAttachmentSize(item), 0);
  }

  if (typeof attachment === "object") {
    const source = attachment as Record<string, unknown>;
    for (const key of [
      "size_bytes",
      "size",
      "bytes",
      "byte_size",
      "content_length",
      "length",
    ]) {
      if (key in source) {
        const value = coerceNumber(source[key]);
        if (value !== null) {
          return Math.max(0, Math.trunc(value));
        }
      }
    }
  }

  return 0;
}

const CUSTOM_OPERATOR_IMPLS: Record<
  (typeof JSONLOGIC_CUSTOM_OPERATORS)[number],
  (...args: unknown[]) => unknown
> = {
  match: opMatch,
  date_diff: opDateDiff,
  count: opCount,
  length: opLength,
  between: opBetween,
  geo_area: opGeoArea,
  attachment_size: opAttachmentSize,
};

/* JL-OPS-07 — date arithmetic ops (not in CUSTOM_OPERATOR_IMPLS because they
 * are registered separately so we can control the "date only" output format). */
function opDateAdd(date: unknown, n: unknown, unit: unknown = "days"): string {
  const d = parseIsoDate(date);
  const nNum = coerceNumber(n) ?? 0;
  const u = String(unit).toLowerCase();
  const r = new Date(d.getTime());
  if (["day", "days"].includes(u)) r.setUTCDate(r.getUTCDate() + nNum);
  else if (["week", "weeks"].includes(u))
    r.setUTCDate(r.getUTCDate() + nNum * 7);
  else if (["month", "months"].includes(u))
    r.setUTCMonth(r.getUTCMonth() + nNum);
  else if (["year", "years"].includes(u))
    r.setUTCFullYear(r.getUTCFullYear() + nNum);
  else if (["hour", "hours"].includes(u)) r.setUTCHours(r.getUTCHours() + nNum);
  else if (["minute", "minutes"].includes(u))
    r.setUTCMinutes(r.getUTCMinutes() + nNum);
  else throw new Error(`Unsupported date_add unit: ${String(unit)}`);
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return r.toISOString().slice(0, 10);
  }
  return r.toISOString();
}

/* JL-OPS-08 — time_add(time, N, unit): add N units to a HH:MM[:SS] string. */
function opTimeAdd(
  time: unknown,
  n: unknown,
  unit: unknown = "minutes",
): string {
  const str = typeof time === "string" ? time : "00:00:00";
  const parts = str.split(":").map(Number);
  let totalSec =
    (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  const nNum = coerceNumber(n) ?? 0;
  const u = String(unit).toLowerCase();
  if (["second", "seconds"].includes(u)) totalSec += nNum;
  else if (["minute", "minutes"].includes(u)) totalSec += nNum * 60;
  else if (["hour", "hours"].includes(u)) totalSec += nNum * 3600;
  else throw new Error(`Unsupported time_add unit: ${String(unit)}`);
  // Wrap around 24 h
  totalSec = ((totalSec % 86400) + 86400) % 86400;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0")
  );
}

export function registerJsonLogicV2Operators(): void {
  if (customOperatorsRegistered) {
    return;
  }

  for (const operator of JSONLOGIC_CUSTOM_OPERATORS) {
    jsonLogic.add_operation(operator, CUSTOM_OPERATOR_IMPLS[operator]);
  }

  // SB2-UX-28 — DefaultBlock emits { today: [] } / { now: [] } for date/time
  // defaults. Register them as custom ops so they evaluate correctly on device.
  jsonLogic.add_operation("today", () => new Date().toISOString().slice(0, 10));
  jsonLogic.add_operation("now", () => new Date().toISOString());
  // DOC20-D05 — time_now for time fields.
  jsonLogic.add_operation("time_now", () =>
    new Date().toTimeString().slice(0, 8),
  );
  // JL-OPS-07 — date_add / date_sub.
  jsonLogic.add_operation("date_add", opDateAdd);
  jsonLogic.add_operation(
    "date_sub",
    (date: unknown, n: unknown, unit: unknown) =>
      opDateAdd(date, -(coerceNumber(n) ?? 0), unit),
  );
  // JL-OPS-08 — time_add.
  jsonLogic.add_operation("time_add", opTimeAdd);
  // DOC20-D09 — current_user ops resolved from AuthContext context (set via
  // setCurrentUserForEvaluation before each evaluation call).
  jsonLogic.add_operation(
    "current_user_name",
    () => _evalCurrentUser?.name ?? undefined,
  );
  jsonLogic.add_operation(
    "current_user_id",
    () => _evalCurrentUser?.id ?? undefined,
  );
  // DOC20-D11 — current_location: GPS filling is an async Form Engine concern
  // (not a synchronous JSONLogic evaluation). The op returns undefined so that
  // expressions evaluate safely; actual value injection happens at app level.
  jsonLogic.add_operation("current_location", () => undefined);

  customOperatorsRegistered = true;
}

function walkSecurityTree(
  node: unknown,
  depth: number,
  state: { nodes: number },
  maxDepth: number,
  maxNodes: number,
  forbiddenOperators: Set<string>,
): void {
  state.nodes += 1;
  if (state.nodes > maxNodes) {
    throw new JsonLogicSecurityError(
      `JSONLogic expression exceeds max_nodes=${maxNodes}`,
    );
  }

  if (depth > maxDepth) {
    throw new JsonLogicSecurityError(
      `JSONLogic expression exceeds max_depth=${maxDepth}`,
    );
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      walkSecurityTree(
        child,
        depth + 1,
        state,
        maxDepth,
        maxNodes,
        forbiddenOperators,
      );
    }
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const entries = Object.entries(node as Record<string, unknown>);
  if (entries.length === 1) {
    const [operator] = entries[0];
    if (forbiddenOperators.has(operator)) {
      throw new JsonLogicSecurityError(
        `JSONLogic expression contains forbidden operator: ${operator}`,
      );
    }
  }

  for (const [, child] of entries) {
    walkSecurityTree(
      child,
      depth + 1,
      state,
      maxDepth,
      maxNodes,
      forbiddenOperators,
    );
  }
}

export function validateJsonLogicSecurity(
  expression: unknown,
  options?: {
    maxDepth?: number;
    maxNodes?: number;
    forbiddenOperators?: Set<string>;
  },
): void {
  if (!expression) {
    return;
  }

  walkSecurityTree(
    expression,
    1,
    { nodes: 0 },
    options?.maxDepth ?? JSONLOGIC_SECURITY_MAX_DEPTH,
    options?.maxNodes ?? JSONLOGIC_SECURITY_MAX_NODES,
    options?.forbiddenOperators ?? JSONLOGIC_SECURITY_FORBIDDEN_OPERATORS,
  );
}

export function evaluateJsonLogicExpression(
  expression: Record<string, unknown>,
  data: Record<string, unknown> = {},
  options?: {
    maxDepth?: number;
    maxNodes?: number;
    forbiddenOperators?: Set<string>;
  },
): unknown {
  registerJsonLogicV2Operators();
  validateJsonLogicSecurity(expression, options);

  // SB2-UX-28 — handle the { var: ["", literal] } literal pattern from
  // DefaultBlock. json-logic-js resolves var:"" to the root data object, so
  // the second-arg fallback is never returned. Detect and short-circuit here.
  if ("var" in expression && Object.keys(expression).length === 1) {
    const varVal = expression["var"];
    if (Array.isArray(varVal) && varVal.length === 2 && varVal[0] === "") {
      return varVal[1] ?? undefined;
    }
  }

  try {
    return jsonLogic.apply(expression, data);
  } catch (error) {
    throw new JsonLogicEvaluationError(
      `JSONLogic runtime evaluation failed: ${String(error)}`,
    );
  }
}

export function evaluateJsonLogicAsBool(
  expression: Record<string, unknown>,
  data: Record<string, unknown> = {},
  options?: {
    maxDepth?: number;
    maxNodes?: number;
    forbiddenOperators?: Set<string>;
  },
): boolean {
  return Boolean(evaluateJsonLogicExpression(expression, data, options));
}

registerJsonLogicV2Operators();
