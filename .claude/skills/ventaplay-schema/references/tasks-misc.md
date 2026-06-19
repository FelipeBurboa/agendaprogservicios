# Tasks & Miscellaneous

> 9 tables in this domain

### tareas

| Column | Type | Null | Default |
|--------|------|------|---------|
| fecha_inicio | timestamptz | ✓ | - |
| duracion_estimada | int4 | ✓ | - |
| prioridad | USER-DEFINED | ✗ | `media`::prioridad_tarea |
| descripcion | text | ✗ | - |
| titulo | text | ✗ | ``::text |
| notas_completado | text | ✓ | - |
| estado | USER-DEFINED | ✗ | `pendiente`::estado_tarea |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| fecha_completada | timestamptz | ✓ | - |
| recordatorio_activo | bool | ✗ | false |
| recordatorio_fecha | timestamptz | ✓ | - |
| tipo | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| fecha_expiracion | timestamptz | ✗ | - |
| tipo_tarea | USER-DEFINED | ✗ | `seguimiento`::tipo_tarea_crm |
| asignado_id | uuid | ✓ | - |
| usuario_id | uuid | ✗ | - |
| oportunidad_id | uuid | ✗ | - |

**FK →** usuario_id → `usuarios.id` | oportunidad_id → `oportunidades.id` | asignado_id → `usuarios.id` |

### bug_reports

| Column | Type | Null | Default |
|--------|------|------|---------|
| url | text | ✗ | - |
| descripcion | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| timestamp | timestamptz | ✗ | - |
| user_id | uuid | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| browser_info | jsonb | ✓ | - |
| has_screenshot | bool | ✓ | false |
| is_fixed | bool | ✓ | false |
| fixing_started_at | timestamptz | ✓ | - |
| fixed_at | timestamptz | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| created_at | timestamptz | ✓ | now() |
| deleted_at | timestamptz | ✓ | - |
| deleted_by | uuid | ✓ | - |
| orden | int4 | ✗ | - |
| prioridad | text | ✓ | `baja`::text |
| tipo_incidencia | text | ✓ | - |
| a_cargo | text | ✓ | - |
| status | text | ✓ | `Reportado`::text |
| screenshot_url | text | ✓ | - |
| capture_method | text | ✓ | - |
| user_email | text | ✓ | - |
| user_agent | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | user_id → `usuarios.id` | deleted_by → `usuarios.id` |

### bug_report_comments

| Column | Type | Null | Default |
|--------|------|------|---------|
| user_id | uuid | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| menciones | ARRAY | ✓ | `{}`::text[] |
| tipo_evento | text | ✓ | `comentario`::text |
| mensaje | text | ✗ | - |
| user_name | text | ✗ | - |
| bug_report_id | uuid | ✗ | - |
| editado | bool | ✓ | false |
| metadata | jsonb | ✓ | `{}`::jsonb |
| es_sistema | bool | ✓ | false |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✓ | now() |
| editado_at | timestamptz | ✓ | - |

**FK →** bug_report_id → `bug_reports.id` | user_id → `usuarios.id` |

### availability_api_logs

| Column | Type | Null | Default |
|--------|------|------|---------|
| slots_returned | int4 | ✓ | 0 |
| response_status | int4 | ✗ | - |
| response_payload | jsonb | ✓ | - |
| fecha_fin | date | ✓ | - |
| response_data_type | text | ✓ | - |
| auth_method | text | ✓ | `api_key`::text |
| api_key_used | text | ✓ | - |
| user_agent | text | ✓ | - |
| error_message | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✓ | - |
| request_payload | jsonb | ✓ | - |
| request_headers | jsonb | ✓ | - |
| ip_address | inet | ✓ | - |
| profesional_id | uuid | ✓ | - |
| servicio_ids | ARRAY | ✓ | - |
| items_returned | int4 | ✓ | 0 |
| appointment_id | uuid | ✓ | - |
| api_type | USER-DEFINED | ✗ | `availability`::api_type_enum |
| tag_id | uuid | ✓ | - |
| tag_ids | ARRAY | ✓ | - |
| profesional_ids | ARRAY | ✓ | - |
| fecha_inicio | date | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| execution_time_ms | int4 | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` | appointment_id → `citas.id` | tag_id → `servicio_tags.id` |

### internal_video_recordings

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| created_by | uuid | ✗ | - |
| title | text | ✗ | - |
| storage_path | text | ✗ | - |
| thumbnail_path | text | ✓ | - |
| mime_type | text | ✗ | - |
| size_bytes | int8 | ✓ | - |
| duration_seconds | int4 | ✓ | - |
| status | text | ✗ | `pending`::text |
| source_url | text | ✓ | - |
| metadata | jsonb | ✗ | `{}`::jsonb |
| public_view_count | int4 | ✗ | 0 |
| last_public_viewed_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | created_by → `usuarios.id` (RESTRICT) |

**Constraints:** UNIQUE on storage_path | CHECK(`status IN ('pending','ready','failed')`) |

### internal_video_recording_views

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| recording_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| share_token | text | ✗ | - |
| viewer_hash | text | ✗ | - |
| user_agent | text | ✓ | - |
| referrer | text | ✓ | - |
| playhead_seconds | int4 | ✓ | - |
| duration_seconds | int4 | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** recording_id → `internal_video_recordings.id` (CASCADE) | organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** CHECK(`playhead_seconds >= 0`) | CHECK(`duration_seconds >= 0`) |

**Trigger:** AFTER INSERT increments `internal_video_recordings.public_view_count` and updates `last_public_viewed_at`.

### academy_topics

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| title | text | ✗ | - |
| description | text | ✓ | - |
| position | int4 | ✗ | 0 |
| published | bool | ✗ | false |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**Notes:** Global (no `organizacion_id`) — academy content is platform-wide, not multi-tenant.

### academy_videos

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| topic_id | uuid | ✗ | - |
| created_by | uuid | ✗ | - |
| title | text | ✗ | - |
| description | text | ✓ | - |
| storage_path | text | ✗ | - |
| thumbnail_path | text | ✓ | - |
| mime_type | text | ✗ | - |
| size_bytes | int8 | ✓ | - |
| duration_seconds | int4 | ✓ | - |
| status | text | ✗ | `pending`::text |
| position | int4 | ✗ | 0 |
| published | bool | ✗ | false |
| metadata | jsonb | ✗ | `{}`::jsonb |
| video_bucket | text | ✗ | `ventaplay-academy-videos`::text |
| thumbnail_bucket | text | ✓ | - |
| source_type | text | ✗ | `upload`::text |
| source_recording_id | uuid | ✓ | - |
| subtitle_status | text | ✗ | `pending`::text |
| subtitle_language | text | ✓ | - |
| subtitle_storage_path | text | ✓ | - |
| subtitle_error | text | ✓ | - |
| subtitle_generated_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** topic_id → `academy_topics.id` (CASCADE) | created_by → `usuarios.id` (RESTRICT) | source_recording_id → `internal_video_recordings.id` |

**Constraints:** UNIQUE on storage_path |

**Notes:** `source_type` is `'upload'` or `'internal_recording'`. When `'internal_recording'`, `source_recording_id` links to a capture from `internal_video_recordings`.

### availability_api_logs_legacy

| Column | Type | Null | Default |
|--------|------|------|---------|
| slots_returned | int4 | ✓ | - |
| created_at | timestamptz | ✓ | - |
| api_type | USER-DEFINED | ✓ | - |
| execution_time_ms | int4 | ✓ | - |
| items_returned | int4 | ✓ | - |
| response_status | int4 | ✓ | - |
| response_payload | jsonb | ✓ | - |
| fecha_fin | date | ✓ | - |
| fecha_inicio | date | ✓ | - |
| tag_ids | ARRAY | ✓ | - |
| tag_id | uuid | ✓ | - |
| servicio_ids | ARRAY | ✓ | - |
| profesional_ids | ARRAY | ✓ | - |
| profesional_id | uuid | ✓ | - |
| ip_address | inet | ✓ | - |
| request_headers | jsonb | ✓ | - |
| request_payload | jsonb | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| id | uuid | ✓ | - |
| api_key_used | text | ✓ | - |
| user_agent | text | ✓ | - |
| error_message | text | ✓ | - |
| response_data_type | text | ✓ | - |

