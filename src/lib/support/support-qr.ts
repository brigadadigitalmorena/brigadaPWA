/** Parses backend `qr_data` or a bare 6-digit code (parity with mobile). */

const CODE_PATTERN = /^\d{6}$/;

export function parseSupportQr(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  if (CODE_PATTERN.test(text)) return text;

  try {
    const parsed = JSON.parse(text) as { type?: unknown; code?: unknown };
    if (parsed?.type !== 'brigada_support') return null;
    const code = String(parsed.code ?? '').trim();
    return CODE_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
}
