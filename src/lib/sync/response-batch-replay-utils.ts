export type BatchValidationStatus =
  | "success"
  | "synced"
  | "partial"
  | "duplicate"
  | "failed";

export interface ResponseBatchPayloadRef {
  client_id: string;
}

export interface ResponseBatchQueueRef {
  entity_id: string;
}

export function isAcceptedBatchStatus(status: string | undefined): boolean {
  return (
    status === "success" ||
    status === "synced" ||
    status === "partial" ||
    status === "duplicate"
  );
}

export function isRejectedBatchStatus(status: string | undefined): boolean {
  return status === "failed";
}

export function categorizeBatchRejectReason(message: string): string {
  const value = message.toLowerCase();

  if (
    value.includes("not yet open") ||
    value.includes("aun no") ||
    value.includes("todavia no")
  ) {
    return "survey_not_open";
  }
  if (value.includes("closed") || value.includes("cerrad")) {
    return "survey_closed";
  }
  if (value.includes("unpublished") || value.includes("no publicada")) {
    return "version_unpublished";
  }
  if (value.includes("version") && value.includes("not found")) {
    return "version_not_found";
  }
  if (value.includes("duplicate") || value.includes("already synced")) {
    return "duplicate_client_id";
  }
  if (
    value.includes("question") ||
    value.includes("pregunta") ||
    value.includes("validation") ||
    value.includes("invalid") ||
    value.includes("valido") ||
    value.includes("válido") ||
    value.includes("caracter")
  ) {
    return "validation_error";
  }
  if (
    value.includes("permission") ||
    value.includes("forbidden") ||
    value.includes("unauthor")
  ) {
    return "permission_denied";
  }
  if (
    value.includes("schema hash mismatch") ||
    value.includes("schema_hash") ||
    value.includes("version mismatch") ||
    value.includes("does not belong to the selected survey version")
  ) {
    return "schema_mismatch";
  }

  return "other_failed_rejection";
}

export function getResponseItemsToSubmit<T extends ResponseBatchQueueRef>(
  payloads: ResponseBatchPayloadRef[],
  itemMap: Map<string, T>,
  reconciledClientIds: Set<string>,
): T[] {
  return payloads
    .filter((payload) => !reconciledClientIds.has(payload.client_id))
    .map((payload) => itemMap.get(payload.client_id))
    .filter((item): item is T => Boolean(item));
}

export function getAcceptedClientIds(
  results: { client_id?: string; status?: string }[],
): string[] {
  return results
    .filter((result) => Boolean(result.client_id))
    .filter((result) => isAcceptedBatchStatus(result.status))
    .map((result) => result.client_id as string);
}
