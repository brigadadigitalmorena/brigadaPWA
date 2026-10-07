export interface ZipSettlement {
  colonia: string;
  tipo: string;
  municipio: string;
  estado: string;
  ciudad: string;
  zona: string;
}

export interface ZipCompoundValue {
  codigo_postal: string;
  colonia: string;
  tipo: string;
  municipio: string;
  estado: string;
  ciudad: string;
  zona: string;
}

export function emptyZipValue(zip = ''): ZipCompoundValue {
  return {
    codigo_postal: zip,
    colonia: '',
    tipo: '',
    municipio: '',
    estado: '',
    ciudad: '',
    zona: '',
  };
}

export function parseZipValue(value: unknown): ZipCompoundValue {
  if (!value) return emptyZipValue();
  if (typeof value === 'string') return emptyZipValue(digitsOnly(value));
  if (typeof value !== 'object' || Array.isArray(value)) return emptyZipValue();

  const raw = value as Record<string, unknown>;
  const zip = digitsOnly(
    String(raw.codigo_postal ?? raw.zip ?? raw.cp ?? '')
  );
  return {
    codigo_postal: zip,
    colonia: String(raw.colonia ?? raw.settlement ?? ''),
    tipo: String(raw.tipo ?? ''),
    municipio: String(raw.municipio ?? ''),
    estado: String(raw.estado ?? ''),
    ciudad: String(raw.ciudad ?? ''),
    zona: String(raw.zona ?? ''),
  };
}

export function formatSettlement(row: ZipSettlement | ZipCompoundValue): string {
  const colonia = row.colonia.trim();
  const municipio = row.municipio.trim();
  const estado = row.estado.trim();
  return [colonia, municipio, estado].filter(Boolean).join(', ');
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 5);
}

export function isCompleteZip(value: string): boolean {
  return /^\d{5}$/.test(value);
}
