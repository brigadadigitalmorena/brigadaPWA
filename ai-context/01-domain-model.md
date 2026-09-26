# Modelo de Dominio - brigadaPWA

## Entidades principales (Dexie v7)

### Survey (Encuesta)
```typescript
interface Survey {
  id?: number;                    // PK auto
  survey_id: string;              // UUID del backend
  version: string;                // Versión del esquema
  title: string;
  description?: string;
  category: string;
  schema_json: string;            // JSON stringificado (FormEngine v2)
  engine_version: number;         // 2 = JSONLogic relevance
  author: string;
  estimated_duration: number;     // minutos
  tags?: string;
  is_active: boolean;
  is_published: boolean;
  sync_status: 'pending' | 'synced' | 'error';
  last_synced_at?: string;        // ISO 8601
  remote_updated_at?: string;
  entitlement_json?: string;      // Cache de asignación (v7)
  created_at: string;
  updated_at: string;
}
```
Índices: `survey_id`, `version`, `title`, `sync_status`, `last_synced_at`, `created_at`

### Response (Respuesta de encuesta)
```typescript
interface Response {
  id?: number;
  response_id: string;            // UUID local (client_id)
  survey_id: string;
  survey_version: string;
  status: 'draft' | 'completed' | 'validated' | 'rejected';
  answers_json: string;           // JSON stringificado: { [question_key]: any }
  brigadista_user_id: string;
  brigadista_name: string;
  brigadista_role: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  location_captured_at?: string;
  device_platform: string;
  device_os_version: string;
  device_app_version: string;
  started_at: string;             // ISO 8601
  completed_at?: string;
  duration_seconds?: number;
  validation_status: string;      // 'passed' | 'failed' | 'pending'
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  sync_attempts: number;
  last_sync_attempt_at?: string;
  last_synced_at?: string;
  sync_error?: string;
  offline_mode: boolean;
  immutable: boolean;             // Si true, no editable tras sync
  integrity_hash?: string;        // SHA-256 de answers_json + files
  created_at: string;
  updated_at: string;
}
```
Índices: `response_id`, `survey_id`, `status`, `sync_status`, `brigadista_user_id`, `created_at`, `updated_at`

### ResponseAnswer (Respuesta individual por pregunta)
```typescript
interface ResponseAnswer {
  id?: number;
  response_id: string;
  question_id?: number;
  question_key?: string;          // Clave del schema (p.ej. "q_domicilio_calle")
  answer_json: string;            // Valor serializado
  evaluated_label?: string;       // Label calculado para display
  answered_at?: string;
  created_at: string;
}
```
Índices: `response_id`, `question_key`, `created_at`

### LocalFile (Archivo adjunto)
```typescript
interface LocalFile {
  id?: number;
  file_id: string;                // UUID local
  response_id: string;
  file_type: 'photo' | 'signature' | 'ine_front' | 'ine_back' | 'file';
  question_id: string;
  local_path?: string;            // FileSystem API o blob URL
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key?: string;           // Clave en R2 tras upload
  remote_url?: string;            // URL firmada o pública
  ine_ocr_data?: string;          // JSON con OCR crudo (para INE)
  sync_status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploaded_at?: string;
  upload_started_at?: string;     // Para detección de staleness
  thumbnail_path?: string;
  document_id?: string;           // ID de documento en backend
  presigned_url?: string;
  presigned_expires_at?: string;
  confirmed_at?: string;
  created_at: string;
}
```
Índices: `file_id`, `response_id`, `file_type`, `sync_status`, `created_at`

### SyncQueue (Cola de sincronización)
```typescript
type SyncQueueStatus =
  | 'pending'         // Esperando turno
  | 'leased'          // Tomado por worker (lease_owner + lease_until)
  | 'syncing'         // Enviando al backend
  | 'retry_wait'      // Backoff exponencial
  | 'completed'       // Éxito confirmado
  | 'failed'          // Error transitorio, reintentará
  | 'failed_permanent'// Error 4xx no recuperable
  | 'dead_letter'     // Agotó reintentos, requiere intervención
  | 'discarded'       // Usuario descartó
  | 'cancelled';      // Cancelado por sistema

interface SyncQueue {
  id?: number;
  queue_id: string;               // UUID
  operation_type: string;         // 'CREATE_RESPONSE', 'UPLOAD_FILE', 'CREATE_FIELD_SESSION', etc.
  entity_type: 'survey' | 'response' | 'user' | 'file' | 'field_session';
  entity_id: string;
  payload_json: string;           // Payload completo para reintento
  status: SyncQueueStatus;
  priority: number;               // Menor = más urgente (0 = crítico)
  retry_count: number;
  max_retries: number;            // Default: 12 para uploads, 5 para responses
  next_retry_at?: string;         // ISO 8601
  last_error?: string;
  last_error_code?: string;       // Código del backend (p.ej. 'form_engine_violation')
  lease_owner?: string;           // 'pwa-<uuid8>'
  lease_until?: string;           // ISO 8601
  created_at: string;
  updated_at: string;
  processed_at?: string;
  completed_at?: string;
}
```
Índices: `queue_id`, `operation_type`, `entity_type`, `entity_id`, `status`, `priority`, `next_retry_at`, `created_at`

### FieldSession (Sesión de recorrido de campo)
```typescript
interface FieldSession {
  client_id: string;              // PK (UUID generado en cliente)
  server_id?: number;             // ID asignado por backend tras sync
  activity_type: string;          // 'survey_route', 'audit', 'supervision'
  survey_id?: number | null;
  campaign_id?: number | null;
  entitlement_id?: number | null;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  ended_at?: string;
  end_reason?: string;
  config_json: string;            // Config: intervalo GPS, precisión, etc.
  degraded_reason?: string;       // Si degraded_mode activado
  next_seq: number;               // Monotónico, nunca reutilizado
  sample_count: number;
  distance_m: number;
  last_lat?: number;
  last_lng?: number;
  last_sample_at?: string;
  created_at: string;
  updated_at: string;
}
```
Índices: `client_id`, `status`, `started_at`

### FieldSessionSample (Muestra GPS/foto/gap)
```typescript
interface FieldSessionSample {
  id?: number;
  session_client_id: string;      // FK a FieldSession.client_id
  sample_seq: number;             // Secuencia dentro de sesión
  sample_type: 'gps' | 'photo' | 'gap';
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  altitude_m?: number;
  speed_mps?: number;
  heading_deg?: number;
  recorded_at: string;
  provider?: string;              // 'gps', 'network', 'fused'
  app_state?: 'foreground' | 'background' | 'hidden';
  is_mocked?: boolean;
  battery_pct?: number;
  media_file_id?: string;         // FK a LocalFile si photo
  payload_json?: string;          // Datos extra
  upload_status: 'pending' | 'uploaded';
  uploaded_at?: string;
  created_at: string;
}
```
Índices compuestos: `[session_client_id+sample_seq]`, `[session_client_id+upload_status]`

### StaticMap / StaticMapFeature (Mapas offline)
```typescript
interface StaticMap {
  map_id: number;                 // PK (backend ID)
  name: string;
  description: string | null;
  version: number;
  manifest_etag: string;          // Para invalidación
  published_at: string;
  synced_at: string;
}

interface StaticMapFeature {
  feature_key: string;            // PK local (map_id+layer_id+feature_id)
  feature_id: number;             // ID en backend (único por mapa/capa)
  map_id: number;
  layer_id: number;
  layer_name: string;
  layer_type: string;             // 'polygon', 'line', 'point'
  geometry_json: string;          // GeoJSON geometry
  properties_json: string | null;
}
```
Índices: `map_id`, `feature_key`, `feature_id`, `[map_id+layer_id]`, `[map_id+layer_type]`

### KVCache (Clave-valor con TTL)
```typescript
interface KVCache {
  cache_key: string;              // PK
  cache_value: string;            // JSON stringificado
  expires_at?: string;            // ISO 8601, null = sin expiración
  created_at: string;
  updated_at: string;
}
```

## Relaciones clave

```
Survey 1──N Response (survey_id)
Response 1──N ResponseAnswer (response_id)
Response 1──N LocalFile (response_id)
Response 1──1 SyncQueue (entity_id = response_id, entity_type = 'response')
LocalFile 1──1 SyncQueue (entity_id = file_id, entity_type = 'file')
FieldSession 1──N FieldSessionSample (session_client_id)
FieldSession 1──1 SyncQueue (entity_id = client_id, entity_type = 'field_session')
StaticMap 1──N StaticMapFeature (map_id)
```

## Esquema de encuesta (FormEngine v2)

El `schema_json` de Survey sigue el contrato `seed_local.py` del backend:

```json
{
  "version": 2,
  "title": "Encuesta de Hogar",
  "sections": [
    {
      "id": "sec_datos_generales",
      "title": "Datos Generales",
      "questions": [
        {
          "id": 1,
          "question_key": "q_tipo_vivienda",
          "type": "single_choice",
          "label": "Tipo de vivienda",
          "required": true,
          "options": [
            {"value": "casa", "label": "Casa"},
            {"value": "departamento", "label": "Departamento"}
          ],
          "relevance_expression": "true"
        }
      ]
    }
  ],
  "calculated_fields": [
    {
      "key": "total_habitantes",
      "expression": "sum(q_habitantes_*)",
      "type": "number"
    }
  ]
}
```

**Tipos de pregunta soportados** (ver `question-type-registry.ts`): 44 tipos en 9 grupos (input, choice, location, media, document, calculated, composite, navigation, system).

**Relevancia**: JSONLogic (ver `jsonlogic.ts`). Ejemplo: `{"==": [{"var": "q_tiene_agua"}, "si"]}`.

## Contratos de API (resumen)

| Operación | Endpoint (proxied via `/api/backend/`) | Método |
|-----------|----------------------------------------|--------|
| Login | `/mobile/auth/login` | POST |
| Refresh | `/mobile/auth/refresh` | POST |
| Mis asignaciones | `/mobile/surveys` | GET |
| Detalle encuesta | `/mobile/surveys/{id}` | GET |
| Enviar respuesta | `/mobile/responses` | POST |
| Subir archivo | `/mobile/files/upload` | POST (multipart) |
| Presigned URL | `/mobile/files/presigned-url` | POST |
| Manifiesto tiles | `/mobile/tiles/osm/manifest` | GET |
| Static maps | `/mobile/maps/manifest` | GET |
| Consumibles | `/mobile/consumables/*` | GET/POST |
| Promociones | `/mobile/promotions/*` | GET/POST |

## Diferencias con modelo móvil (brigadaApp)

| Entidad | brigadaApp | brigadaPWA | Nota |
|---------|------------|------------|------|
| Response.immutable | ✅ | ✅ | Igual |
| Response.integrity_hash | ✅ | ✅ | Igual |
| FieldSession | ✅ (SQLite) | ✅ (Dexie) | Esquema idéntico (wire format) |
| SyncQueue lease | ✅ | ✅ | Mismo algoritmo (120s) |
| Consumibles | ✅ completo | Parcial | PWA: solo lectura + asignación básica |
| Promociones | ✅ completo | Parcial | PWA: solo lectura |
| Notificaciones | ✅ | Stub | PWA: sin implementar |