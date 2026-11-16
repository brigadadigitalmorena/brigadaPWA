export const SUPPORT_CAPABILITIES = ['gestiones'] as const;

export type SupportCapability = (typeof SUPPORT_CAPABILITIES)[number];

export function normalizeSupportCapabilities(
  values: readonly unknown[] | null | undefined
): SupportCapability[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim().toLowerCase())
        .filter((value): value is SupportCapability =>
          SUPPORT_CAPABILITIES.includes(value as SupportCapability)
        )
    )
  );
}

export function hasSupportCapability(
  capabilities: readonly SupportCapability[],
  capability: SupportCapability
): boolean {
  return capabilities.includes(capability);
}
