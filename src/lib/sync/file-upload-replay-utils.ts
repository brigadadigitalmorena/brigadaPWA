export interface ConfirmDocumentReplayPayload {
  document_id?: unknown;
  remote_url?: unknown;
  storage_key?: unknown;
}

export interface ConfirmDocumentFallbackFile {
  document_id: string | null;
  remote_url: string | null;
  storage_key: string | null;
}

export interface NormalizedConfirmDocumentPayload {
  document_id: string;
  remote_url: string;
  storage_key: string;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function normalizeConfirmDocumentPayload(
  payload: ConfirmDocumentReplayPayload | null,
  fallbackFile?: ConfirmDocumentFallbackFile | null,
): NormalizedConfirmDocumentPayload | null {
  const documentId =
    nonEmptyString(payload?.document_id) ??
    nonEmptyString(fallbackFile?.document_id);
  const remoteUrl =
    nonEmptyString(payload?.remote_url) ??
    nonEmptyString(fallbackFile?.remote_url);
  const storageKey =
    nonEmptyString(payload?.storage_key) ??
    nonEmptyString(fallbackFile?.storage_key);

  if (!documentId || !remoteUrl || !storageKey) {
    return null;
  }

  return {
    document_id: documentId,
    remote_url: remoteUrl,
    storage_key: storageKey,
  };
}
