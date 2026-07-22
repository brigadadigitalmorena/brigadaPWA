// User types
export interface User {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  role_key: string;
  telefono?: string;
  avatar_url?: string;
  created_at: string;
  activo: boolean;
  custom_role_id?: number;
  custom_role_name?: string;
  permissions: string[];
  create_user_targets: string[];
  allowed_survey_ids: number[];
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
}

// Auth state
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Survey types (from API)
export interface SurveyMetadata {
  id: number;
  title: string;
  description?: string;
  survey_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_version?: SurveyVersion;
}

export interface SurveyVersion {
  id: number;
  survey_id?: number;
  version_number: number;
  is_published: boolean;
  is_archived?: boolean;
  published_at?: string;
  change_summary?: string;
  engine_version: number;
  schema_hash?: string;
  schema_version?: number;
  sections?: SurveySection[];
  questions?: Question[];
  data_lists?: Record<string, unknown>;
}

export interface SurveySection {
  id: number;
  version_id: number;
  section_key: string;
  title: string;
  description?: string;
  order: number;
  relevance_expression?: string;
  questions?: Question[];
}

export interface Question {
  id: number;
  version_id: number;
  question_text: string;
  question_type: QuestionType;
  question_key?: string;
  order: number;
  is_required: boolean;
  validation_rules?: ValidationRules;
  options?: AnswerOption[];
  relevance_expression?: string;
  constraint_expression?: string;
  calculated_expression?: string;
  default_value_expression?: string;
  section_id?: number;
  ui?: QuestionUI;
}

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'time'
  | 'single_choice'
  | 'multi_choice'
  | 'yes_no'
  | 'photo'
  | 'signature'
  | 'location'
  | 'file'
  | 'ine_front'
  | 'ine_back'
  | 'slider'
  | 'rating'
  | 'data_list';

export interface ValidationRules {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  regex?: string;
  regex_message?: string;
  custom_message?: string;
  [key: string]: unknown;
}

export interface AnswerOption {
  id: number;
  question_id: number;
  option_text: string;
  order: number;
  is_exclusive?: boolean;
}

export interface QuestionUI {
  helper_text?: string;
  placeholder?: string;
  columns?: number;
  rows?: number;
  [key: string]: unknown;
}

// Assignment types (matches backend AssignedSurveyResponse)
export interface Assignment {
  assignment_id: number;
  survey_id: number;
  survey_title: string;
  survey_description?: string;
  survey_type?: string;
  assignment_status: string;
  inactive_reason?: string;
  management_status?: string;
  assigned_location?: string;
  group_id?: number;
  group_name?: string;
  group_path?: string;
  group_depth?: number;
  area_names?: string[];
  notes?: string;
  latest_version: SurveyVersion;
  engine_version?: number;
  assigned_at: string;
  min_responses_per_day?: number;
  max_responses_per_day?: number;
}

// Sync types
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  error?: string;
}

export interface SyncQueueItem {
  id: number;
  queue_id: string;
  operation_type: string;
  entity_type: 'survey' | 'response' | 'user' | 'file';
  entity_id: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'dead_letter';
  priority: number;
  retry_count: number;
  last_error?: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  retriable: boolean;
  request_id: string;
  trace_id: string;
  details?: unknown;
}

// Form types
export interface SurveyFormData {
  response_id: string;
  survey_id: string;
  survey_version: string;
  answers: Record<string, unknown>;
  files?: FileUpload[];
  location?: LocationData;
  metadata: ResponseMetadata;
}

export interface FileUpload {
  question_id: string;
  file: File;
  file_type: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
}

export interface ResponseMetadata {
  device_platform: string;
  device_os_version: string;
  device_app_version: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
}

// App Config types
export interface AppConfig {
  id: number;
  app_display_name: string;
  default_theme_mode: string;
  default_color_scheme: string;
  allow_user_theme_override: boolean;
  splash_gradient_start: string;
  splash_gradient_mid: string;
  splash_gradient_end: string;
  splash_message_color: string;
  splash_font_type: string;
  bottom_bar_survey_ids: number[];
  bottom_bar_menu_items: unknown[];
  social_links: unknown[];
  offline_enabled_modules: string[];
  online_enabled_modules: string[];
  management_status_labels: Record<string, string>;
}
