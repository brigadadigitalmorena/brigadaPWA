/** Campaign/entitlement scope helpers for PWA. */

/**
 * Query/JSON ids. `Number(null) === 0`, so missing search params must not
 * become campaignId/entitlementId 0 (that breaks resume + Dexie fallback).
 */
export function parseOptionalScopeId(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function entitlementIdOf(row: {
  entitlement_id?: number | null;
}): number | null {
  return parseOptionalScopeId(row.entitlement_id);
}

export function campaignIdOf(row: {
  campaign_id?: number | null;
}): number | null {
  return parseOptionalScopeId(row.campaign_id);
}

export function campaignLabel(row: {
  campaign_name?: string | null;
}): string | null {
  const label = (row.campaign_name || "").trim();
  return label.length > 0 ? label : null;
}

export function campaignGroupKey(row: {
  campaign_id?: number | null;
  survey_id: number;
}): string {
  const campaignId = campaignIdOf(row);
  return campaignId != null ? `c:${campaignId}` : `s:${row.survey_id}`;
}

export function revokedScopeIds(delta: {
  revoked_entitlement_ids?: number[] | null;
}): number[] {
  return [...new Set(delta.revoked_entitlement_ids ?? [])];
}

export function geoNeedsLocation(
  geoEnforcement?: string | null,
  areaNames?: string[] | null,
): boolean {
  if (geoEnforcement !== "warn" && geoEnforcement !== "block") return false;
  return (areaNames?.length ?? 0) > 0;
}

export function geoLocationRequired(
  geoEnforcement?: string | null,
  areaNames?: string[] | null,
): boolean {
  return geoEnforcement === "block" && (areaNames?.length ?? 0) > 0;
}

export const GEO_ERROR_MESSAGES: Record<string, string> = {
  GEO_LOCATION_REQUIRED:
    "Esta campaña requiere tu ubicación GPS para enviar la respuesta.",
  GEO_OUTSIDE_AREA:
    "Estás fuera del territorio permitido para esta campaña.",
};

export function geoErrorMessage(detail: unknown): string | null {
  if (typeof detail === "object" && detail !== null && "code" in detail) {
    const code = String((detail as { code?: string }).code ?? "");
    if (GEO_ERROR_MESSAGES[code]) return GEO_ERROR_MESSAGES[code];
  }
  if (typeof detail === "string") {
    if (detail.includes("GEO_OUTSIDE_AREA")) return GEO_ERROR_MESSAGES.GEO_OUTSIDE_AREA;
    if (detail.includes("GEO_LOCATION_REQUIRED")) {
      return GEO_ERROR_MESSAGES.GEO_LOCATION_REQUIRED;
    }
  }
  return null;
}

export function matchEntitlement<T extends {
  survey_id: number;
  entitlement_id: number;
  campaign_id?: number | null;
}>(
  entitlements: T[],
  surveyId: number,
  options?: { campaignId?: number | null; entitlementId?: number | null },
): T | undefined {
  const entitlementId = parseOptionalScopeId(options?.entitlementId);
  if (entitlementId != null) {
    return entitlements.find((row) => row.entitlement_id === entitlementId);
  }

  const campaignId = parseOptionalScopeId(options?.campaignId);
  if (campaignId != null) {
    return entitlements.find(
      (row) => row.survey_id === surveyId && row.campaign_id === campaignId,
    );
  }

  return entitlements.find((row) => row.survey_id === surveyId);
}

export function surveyFillHref(row: {
  survey_id: number;
  survey_title: string;
  entitlement_id: number;
  campaign_id?: number | null;
  campaign_name?: string | null;
}): string {
  const params = new URLSearchParams({
    title: row.survey_title,
    entitlementId: String(row.entitlement_id),
  });
  const campaignId = parseOptionalScopeId(row.campaign_id);
  if (campaignId != null) {
    params.set("campaignId", String(campaignId));
  }
  const campaign = campaignLabel(row);
  if (campaign) {
    params.set("campaign", campaign);
  }
  return `/surveys/${row.survey_id}/fill?${params.toString()}`;
}

export function surveyResumeHref(row: {
  survey_id: string | number;
  response_id: string;
  survey_title?: string | null;
  entitlement_id?: number | null;
  campaign_id?: number | null;
  campaign_name?: string | null;
}): string {
  const params = new URLSearchParams({
    resumeDraftId: row.response_id,
  });
  const title = (row.survey_title || "").trim();
  if (title) params.set("title", title);

  const entitlementId = parseOptionalScopeId(row.entitlement_id);
  if (entitlementId != null) {
    params.set("entitlementId", String(entitlementId));
  }
  const campaignId = parseOptionalScopeId(row.campaign_id);
  if (campaignId != null) {
    params.set("campaignId", String(campaignId));
  }
  const campaign = campaignLabel(row);
  if (campaign) {
    params.set("campaign", campaign);
  }
  return `/surveys/${row.survey_id}/fill?${params.toString()}`;
}
