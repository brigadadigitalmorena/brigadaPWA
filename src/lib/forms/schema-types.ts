/** Portable Form Engine v2 schema types (shared between mobile and PWA). */

export interface FormSchemaFieldResponse {
  question_id: number;
  question_key: string | null;
  type: string;
  label: string;
  label_expression?: Record<string, unknown> | null;
  required: boolean;
  is_required_expr?: Record<string, unknown> | null;
  relevance?: Record<string, unknown> | null;
  constraint?: Record<string, unknown> | null;
  constraint_message?: string | null;
  calculated?: Record<string, unknown> | null;
  default?: Record<string, unknown> | null;
  default_expression?: Record<string, unknown> | null;
  appearance?: string | null;
  ui?: Record<string, unknown> | null;
  options: Record<string, unknown>[];
  dataset_ref?: string | null;
  validation_rules?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface FormSchemaSectionResponse {
  key: string;
  title?: string | null;
  description?: string | null;
  relevance?: Record<string, unknown> | null;
  appearance?: string | null;
  appearance_meta?: Record<string, unknown> | null;
  fields: FormSchemaFieldResponse[];
}

export interface FormSchemaResponse {
  version: string;
  schema_version: number;
  engine: string;
  engine_version: number;
  settings: Record<string, unknown>;
  sections: FormSchemaSectionResponse[];
  data_lists?: Record<string, unknown>;
}
