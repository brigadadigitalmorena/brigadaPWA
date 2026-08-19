export const ENTITLEMENTS_ACTIVE_CACHE_KEY = "entitlements_active";
export const ENTITLEMENTS_ALL_CACHE_KEY = "entitlements_all";
export const ENTITLEMENTS_DURABLE_CACHE_KEY = "entitlements_all_offline";

export const ENTITLEMENT_LIST_CACHE_KEYS = [
  ENTITLEMENTS_ACTIVE_CACHE_KEY,
  ENTITLEMENTS_ALL_CACHE_KEY,
  ENTITLEMENTS_DURABLE_CACHE_KEY,
] as const;

const LEGACY_ASSIGNMENT_CACHE_KEYS = [
  "assignments_active",
  "assignments_all",
  "assignments_all_offline",
] as const;

const ENTITLEMENT_SCOPE_EVENT_TYPES = new Set([
  "entitlement_scope_changed",
  "campaign_audience_changed",
  "campaign_scope_changed",
  "group_hierarchy_changed",
  "group_membership_changed",
  "group_reorganized",
  "group_scope_changed",
  "hierarchy_changed",
  "membership_changed",
  "membership_revoked",
  "team_hierarchy_changed",
  "team_membership_changed",
  "team_reorganized",
  "team_scope_changed",
]);

export function isEntitlementScopeEvent(eventType: string): boolean {
  const normalized = eventType.trim().toLowerCase();
  if (ENTITLEMENT_SCOPE_EVENT_TYPES.has(normalized)) return true;

  if (normalized.includes("membership") || normalized.includes("hierarchy")) {
    return true;
  }

  if (
    normalized.includes("entitlement") &&
    /(scope|revoke|recompute|campaign)/.test(normalized)
  ) {
    return true;
  }

  if (
    normalized.includes("campaign") &&
    /(scope|audience|reorg|membership)/.test(normalized)
  ) {
    return true;
  }

  if (
    normalized.includes("team") &&
    /(scope|reorg|reparent|move|membership)/.test(normalized)
  ) {
    return true;
  }

  return (
    normalized.includes("group") &&
    /(scope|reorg|reparent|move|membership)/.test(normalized)
  );
}

export type EntitlementCacheStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};

export async function migrateEntitlementCacheKeys(
  storage: EntitlementCacheStorage,
): Promise<void> {
  const pairs: [string, string][] = [
    ["assignments_active", ENTITLEMENTS_ACTIVE_CACHE_KEY],
    ["assignments_all", ENTITLEMENTS_ALL_CACHE_KEY],
    ["assignments_all_offline", ENTITLEMENTS_DURABLE_CACHE_KEY],
  ];

  for (const [legacy, canonical] of pairs) {
    const legacyValue = await storage.getItem(legacy);
    if (legacyValue != null && (await storage.getItem(canonical)) == null) {
      await storage.setItem(canonical, legacyValue);
    }
    await storage.removeItem(legacy);
  }

  for (const legacy of LEGACY_ASSIGNMENT_CACHE_KEYS) {
    await storage.removeItem(legacy);
  }
}
