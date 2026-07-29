export const ASSIGNMENTS_ACTIVE_CACHE_KEY = "assignments_active";
export const ASSIGNMENTS_ALL_CACHE_KEY = "assignments_all";
export const ASSIGNMENTS_DURABLE_CACHE_KEY = "assignments_all_offline";

export const ASSIGNMENT_LIST_CACHE_KEYS = [
  ASSIGNMENTS_ACTIVE_CACHE_KEY,
  ASSIGNMENTS_ALL_CACHE_KEY,
  ASSIGNMENTS_DURABLE_CACHE_KEY,
] as const;

/**
 * Events that can change which assignments belong to the current user's
 * hierarchy scope. The aliases keep mobile compatible while backend event
 * naming settles across hierarchy rollouts.
 */
const ASSIGNMENT_SCOPE_EVENT_TYPES = new Set([
  "assignment_scope_changed",
  "group_hierarchy_changed",
  "group_membership_changed",
  "group_reorganized",
  "group_scope_changed",
  "hierarchy_changed",
  "membership_changed",
  "membership_revoked",
]);

export function isAssignmentScopeEvent(eventType: string): boolean {
  const normalized = eventType.trim().toLowerCase();
  if (ASSIGNMENT_SCOPE_EVENT_TYPES.has(normalized)) return true;

  if (normalized.includes("membership") || normalized.includes("hierarchy")) {
    return true;
  }

  return (
    normalized.includes("group") &&
    /(scope|reorg|reparent|move|membership)/.test(normalized)
  );
}
