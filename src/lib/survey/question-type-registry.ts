export type RendererKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'choice'
  | 'choice_multi'
  | 'choice_image'
  | 'choice_image_multi'
  | 'range'
  | 'media'
  | 'signature'
  | 'location'
  | 'gis'
  | 'ine'
  | 'barcode'
  | 'readonly'
  | 'compound_zip'
  | 'unsupported';

const TYPE_ALIASES: Record<string, string> = {
  multi_choice: 'multiple_choice',
  multi_select: 'multiple_choice',
  checkbox: 'multiple_choice',
  boolean: 'yes_no',
  gps: 'location',
  coordinates: 'location',
  ine_front: 'ine_ocr',
  ine_back: 'ine_ocr',
};

const RENDERER_BY_TYPE: Record<string, RendererKind> = {
  text: 'text',
  textarea: 'textarea',
  email: 'text',
  phone: 'text',
  regex: 'text',
  curp: 'text',
  codigo_postal: 'text',
  seccion: 'text',
  estado: 'text',
  string_masked: 'text',
  number: 'number',
  decimal: 'number',
  edad: 'number',
  single_choice: 'choice',
  select: 'choice',
  radio: 'choice',
  yes_no: 'choice',
  multiple_choice: 'choice_multi',
  multi_choice: 'choice_multi',
  multi_select: 'choice_multi',
  checkbox: 'choice_multi',
  single_choice_image: 'choice_image',
  multiple_choice_image: 'choice_image_multi',
  date: 'date',
  time: 'date',
  datetime: 'date',
  fecha_nacimiento: 'date',
  slider: 'range',
  scale: 'range',
  rating: 'range',
  photo: 'media',
  selfie: 'media',
  photo_no_gallery: 'media',
  photo_canvas: 'media',
  file: 'media',
  voice: 'media',
  video: 'media',
  signature: 'signature',
  location: 'location',
  gis_line: 'gis',
  gis_polygon: 'gis',
  gis_tracking_manual: 'gis',
  gis_tracking_auto: 'gis',
  ine_ocr: 'ine',
  ine_front: 'ine',
  ine_back: 'ine',
  barcode: 'barcode',
  barcode_hidden: 'barcode',
  read_only: 'readonly',
  data_list: 'unsupported',
  codigo_postal_autofill: 'compound_zip',
};

export function normalizeQuestionType(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toLowerCase();
  return TYPE_ALIASES[trimmed] ?? trimmed;
}

export function getRendererKind(raw: string | undefined | null): RendererKind {
  const normalized = normalizeQuestionType(raw);
  if (!normalized) return 'unsupported';
  return RENDERER_BY_TYPE[normalized] ?? 'unsupported';
}

export const BACKEND_QUESTION_TYPES = [
  'text',
  'textarea',
  'email',
  'phone',
  'regex',
  'curp',
  'codigo_postal',
  'codigo_postal_autofill',
  'seccion',
  'estado',
  'string_masked',
  'number',
  'decimal',
  'slider',
  'scale',
  'rating',
  'edad',
  'single_choice',
  'multiple_choice',
  'yes_no',
  'date',
  'time',
  'datetime',
  'fecha_nacimiento',
  'photo',
  'file',
  'signature',
  'voice',
  'location',
  'ine_ocr',
  'barcode',
  'barcode_hidden',
  'read_only',
  'data_list',
  'video',
  'selfie',
  'photo_canvas',
  'photo_no_gallery',
  'single_choice_image',
  'multiple_choice_image',
  'gis_line',
  'gis_polygon',
  'gis_tracking_manual',
  'gis_tracking_auto',
] as const;

export type BackendQuestionType = (typeof BACKEND_QUESTION_TYPES)[number];
