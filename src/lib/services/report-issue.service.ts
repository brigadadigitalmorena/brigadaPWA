/**
 * Issue report helpers for the PWA.
 *
 * Evidence is uploaded via R2 presigned URLs (backend `/issue-reports`), not mailto.
 */

import {
  confirmIssueAttachment,
  createIssueReport,
  requestIssueAttachmentUploadUrl,
  type IssueReportCreateResponse,
  type IssueSeverity,
} from '@/lib/api/issue-reports.service';
import { compressPhoto } from '@/lib/services/image-compression.service';

export const REPORT_MAX_ATTACHMENTS = 3;
export const REPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const REPORT_ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const REPORT_SEVERITY_OPTIONS: Array<{
  value: IssueSeverity;
  label: string;
}> = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

export interface ReportAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function normalizeReportMime(mimeType: string): string {
  const mime = mimeType.trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime;
}

export function validateReportImage(file: File): string | null {
  const mime = normalizeReportMime(file.type);
  if (!REPORT_ACCEPTED_TYPES.has(mime) && !file.type.startsWith('image/')) {
    return `"${file.name}" no es una imagen válida (JPEG, PNG o WebP).`;
  }
  if (file.size > REPORT_MAX_FILE_BYTES) {
    return `"${file.name}" supera 5 MB.`;
  }
  return null;
}

/**
 * Compress / convert to an API-allowed image (jpeg/png/webp ≤ 5 MB).
 */
export async function prepareReportImage(file: File): Promise<File> {
  const validationError = validateReportImage(file);
  if (validationError) throw new Error(validationError);

  const mime = normalizeReportMime(file.type);
  let prepared = file;
  if (!REPORT_ACCEPTED_TYPES.has(mime) || file.size >= 200 * 1024) {
    prepared = await compressPhoto(file);
  }

  const outMime = normalizeReportMime(prepared.type);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(outMime)) {
    prepared = await compressPhoto(file);
  }

  if (prepared.size > REPORT_MAX_FILE_BYTES) {
    throw new Error(
      `"${file.name}" sigue superando 5 MB después de comprimir.`
    );
  }
  return prepared;
}

async function putToR2(uploadUrl: string, file: File): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': normalizeReportMime(file.type) },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          'La URL de subida expiró o fue rechazada. Intenta de nuevo.'
        );
      }
      throw new Error(`Error al subir la captura (HTTP ${response.status}).`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La subida de la captura tardó demasiado.');
    }
    const message = error instanceof Error ? error.message : '';
    if (
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('networkerror')
    ) {
      throw new Error(
        'No se pudo subir la captura (red o CORS de almacenamiento). Revisa tu conexión.'
      );
    }
    throw error instanceof Error
      ? error
      : new Error('No se pudo subir la captura.');
  } finally {
    window.clearTimeout(timer);
  }
}

export async function uploadReportAttachment(
  file: File,
  fileClientId: string
): Promise<number> {
  const mimeType = normalizeReportMime(file.type);
  const upload = await requestIssueAttachmentUploadUrl({
    file_name: file.name || 'captura-brigada.jpg',
    file_size: file.size,
    mime_type: mimeType,
    file_client_id: fileClientId,
  });

  await putToR2(upload.upload_url, file);

  const confirmed = await confirmIssueAttachment({
    document_id: upload.document_id,
    storage_key: upload.storage_key,
  });

  return confirmed.id;
}

export async function submitIssueReport(input: {
  clientId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  files: File[];
  fileClientIds: string[];
  appVersion: string;
  route: string;
  userAgent: string;
  userId?: number | string | null;
}): Promise<IssueReportCreateResponse> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      'Sin conexión. Conéctate a internet para enviar el reporte con las capturas.'
    );
  }
  if (input.files.length < 1) {
    throw new Error('Agrega al menos una captura para enviar el reporte.');
  }
  if (input.files.length > REPORT_MAX_ATTACHMENTS) {
    throw new Error(
      `Máximo ${REPORT_MAX_ATTACHMENTS} capturas por reporte.`
    );
  }

  const documentIds: number[] = [];
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    const fileClientId = input.fileClientIds[index] ?? newClientId();
    const documentId = await uploadReportAttachment(file, fileClientId);
    documentIds.push(documentId);
  }

  return createIssueReport({
    client_id: input.clientId,
    title: input.title.trim().slice(0, 200),
    description: input.description.trim(),
    severity: input.severity,
    source: 'pwa',
    platform: 'web',
    app_version: input.appVersion.slice(0, 60),
    route_or_screen: input.route.slice(0, 255),
    device_info: {
      user_agent: input.userAgent.slice(0, 300),
      language:
        typeof navigator !== 'undefined' ? navigator.language : undefined,
    },
    context: {
      user_id: input.userId ?? undefined,
      surface: 'pwa_report',
    },
    attachment_document_ids: documentIds,
  });
}
