/**
 * Client-side helpers to send a bug report with screenshot attachments.
 *
 * Browsers cannot attach files to `mailto:`. The correct path is the Web Share
 * API with File payloads (opens the device share sheet → Gmail/Mail/etc.).
 * When that is unavailable we fall back to mailto + download prompts.
 */

export const SUPPORT_EMAIL = 'brigadadigitalmorena@gmail.com';

export const REPORT_MAX_ATTACHMENTS = 5;
export const REPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const REPORT_ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface ReportAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (!files.length) return true;
  if (typeof navigator.canShare !== 'function') {
    // Older Chromium: share exists but canShare may be missing — try anyway.
    return true;
  }
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export function buildReportBody(input: {
  description: string;
  appVersion: string;
  route: string;
  userAgent: string;
  attachmentNames: string[];
}): string {
  const lines = [
    'Hola equipo de soporte,',
    '',
    'Descripción del problema:',
    input.description.trim(),
    '',
    `App: Brigada PWA ${input.appVersion}`,
    `Ruta: ${input.route}`,
    `Navegador: ${input.userAgent}`,
  ];
  if (input.attachmentNames.length > 0) {
    lines.push(
      '',
      `Capturas adjuntas (${input.attachmentNames.length}):`,
      ...input.attachmentNames.map((name, index) => `  ${index + 1}. ${name}`)
    );
  }
  lines.push('', 'Enviado desde la PWA de Brigada Digital.');
  return lines.join('\n');
}

export async function shareBugReport(input: {
  subject: string;
  body: string;
  files: File[];
}): Promise<'shared' | 'aborted' | 'unsupported'> {
  if (!canShareFiles(input.files)) return 'unsupported';
  try {
    await navigator.share({
      title: input.subject,
      text: input.body,
      files: input.files.length > 0 ? input.files : undefined,
    });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'aborted';
    }
    // Some engines reject when `files` is present — retry text-only.
    if (input.files.length > 0) {
      try {
        await navigator.share({ title: input.subject, text: input.body });
        return 'shared';
      } catch (retryError) {
        if (
          retryError instanceof DOMException &&
          retryError.name === 'AbortError'
        ) {
          return 'aborted';
        }
      }
    }
    return 'unsupported';
  }
}

export function openMailtoReport(subject: string, body: string): void {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

export function downloadAttachment(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name || 'captura-brigada.jpg';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function validateReportImage(file: File): string | null {
  if (!REPORT_ACCEPTED_TYPES.has(file.type) && !file.type.startsWith('image/')) {
    return `"${file.name}" no es una imagen válida.`;
  }
  if (file.size > REPORT_MAX_FILE_BYTES) {
    return `"${file.name}" supera 5 MB.`;
  }
  return null;
}
