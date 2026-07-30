# Tasks & Miscellaneous

> 17 tables in this domain

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

**RLS (hardening 2026-06, migs `20260725120000` + `20260726120000`):** ENABLED (antes estaba DESACTIVADO + `GRANT ALL` a anon → cualquiera leía logs de otra org, payloads de clientes incluidos). Policy SELECT `organizacion_id = get_current_custom_user_organization() OR is_ventaplay_internal_user()`. La policy de INSERT `WITH CHECK (true)` se DROPeó: el logging real lo hacen edge functions con service_role (bypassean RLS), así que no se necesita y solo dejaba a anon/authenticated meter ruido. Los grants a anon NO se revocan (la seguridad es la RLS). El panel cliente-facing (Configuración → Información → API) lee vía la RPC SECURITY DEFINER **`get_org_api_usage_logs(p_limit int DEFAULT 25)`** (mig `20260724120000`) que devuelve SOLO metadatos (`api_type`, `response_status`, `execution_time_ms`, `items_returned`, `auth_method`, `error_message`) de la org del llamante — NO los payloads; `LIMIT` clamp 1..100.

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

### registros_exportacion

> Log de auditoría de exportaciones de datos (Excel, etc.). Migración `20260802120000_registros_exportacion.sql`. Hoy lo escribe el botón "Exportar" de `/clientes`; genérico a propósito (`recurso` + `tablas` + `metadata`) para reusarlo en otras pantallas sin cambiar el schema.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| usuario_id | uuid | ✓ | - |
| usuario_nombre | text | ✓ | - |
| recurso | text | ✗ | - |
| tablas | ARRAY | ✗ | `{}`::text[] |
| formato | text | ✗ | `excel`::text |
| estado | text | ✗ | `iniciada`::text |
| row_count | int4 | ✓ | - |
| metadata | jsonb | ✗ | `{}`::jsonb |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) | usuario_id → `usuarios.id` (ON DELETE SET NULL) |

**Constraints:** CHECK `estado IN ('iniciada', 'completada', 'fallida')` |

**Indexes:** `idx_registros_exportacion_org_created` on `(organizacion_id, created_at DESC)` |

**RLS:** NO (grants-only — postura del proyecto: `GRANT SELECT, INSERT, UPDATE, DELETE TO anon, authenticated, service_role`; sin esto el rol `anon` daría 42501). Espejo de `stock_por_ubicacion`/`consumo_ayudantes`.

**Notes:** Registro en 2 fases — INSERT `estado='iniciada'` ANTES de exportar, luego UPDATE a `'completada'`(+`row_count`) o `'fallida'`(+`error` en `metadata`), así el intento queda rastreado aunque el export reviente. `tablas` es `text[]` DESCRIPTIVO (qué tablas se tocaron, ej. `{contactos,clientes}`), NO foreign keys. `usuario_nombre` denormalizado sobrevive el borrado del usuario. `row_count` = filas realmente exportadas (NULL hasta completar); el total aproximado + los filtros activos van en `metadata`. `updated_at` lo setea explícito el UPDATE de la 2ª fase (sin trigger). Inmutable salvo la transición de estado.

### notificaciones

> Feed de notificaciones para la **app móvil**. Migraciones `20260805120000_notificaciones.sql` (base) + `20260806120000_notificaciones_derivacion_ayudante.sql` (derivación + ayudante). Se llena por **triggers en `citas`, `atenciones` y `consumo_ayudantes`** (eventos `creada`/`modificada`/`cancelada`/`asignada`); NO hay write path de app — los triggers de BD capturan frontend, edge functions, RPC `crear_citas_pack`, widget público y MCP por igual. La app móvil resuelve su `usuario` logueado → `profesional` (vía `usuario_profesionales`) y filtra por `profesional_id`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| profesional_id | uuid | ✓ | - |
| usuario_id | uuid | ✓ | - |
| cita_id | uuid | ✓ | - |
| atencion_id | uuid | ✓ | - |
| consumo_id | uuid | ✓ | - |
| origen | text | ✗ | - |
| tipo | text | ✗ | - |
| has_been_seen | boolean | ✗ | false |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | profesional_id → `profesionales.id` (CASCADE) | usuario_id → `usuarios.id` (SET NULL) | cita_id → `citas.id` (SET NULL) | atencion_id → `atenciones.id` (SET NULL) | consumo_id → `consumos.id` (SET NULL) |

**Constraints:** CHECK `origen IN ('cita','atencion','derivacion','ayudante')` | CHECK `tipo IN ('creada','modificada','cancelada','asignada')` |

**Taxonomía (origen, tipo):** `('cita', creada|modificada|cancelada)` · `('atencion', modificada|cancelada)` · `('derivacion', asignada)` — atención reasignada a otro profesional · `('ayudante', asignada)` — ayudante agregado a un consumo (`consumo_id` set). `consumo_id` solo lo lleva el origen `ayudante`; el resto lo dejan NULL. `mig 20260806120000`.

**Indexes:** `idx_notificaciones_profesional` on `(profesional_id, created_at DESC)` (feed de la app) | `idx_notificaciones_cita` on `(cita_id, created_at DESC)` (dedup + joins) |

**RLS:** NO (grants-only — postura del proyecto: `GRANT SELECT, INSERT, UPDATE, DELETE TO anon, authenticated, service_role`; sin esto el rol `anon` daría 42501). Espejo de `registros_exportacion`/`stock_por_ubicacion`.

**Triggers que la alimentan** (en OTRAS tablas, vía el helper `_insert_notificacion(p_org, p_profesional, p_usuario, p_cita, p_atencion, p_consumo, p_origen, p_tipo)`):
- `trg_notificar_evento_cita` — AFTER INSERT OR UPDATE ON `citas` → `notificar_evento_cita()`. INSERT → `creada` (salvo `metodo_agendamiento='importacion'`, que se saltea para no spamear importaciones masivas); UPDATE con estado→`cancelada` → `cancelada`; cambio de `estado`/`fecha_cita`/`hora_inicio`/`hora_fin`/`profesional_id` → `modificada`; cualquier otro UPDATE (updated_at, google_meet_url, notas) → no-op.
- `trg_notificar_evento_atencion` — AFTER INSERT OR UPDATE ON `atenciones` → `notificar_evento_atencion()`. **(A) Derivación** (mig `20260806120000`): UPDATE con `profesional_id` distinto (la atención se reasignó vía "Derivar Profesional") → `derivacion`/`asignada` al NUEVO `profesional_id`; UPDATE-only (los INSERT de RPCs setean al dueño, no son derivación) y FUERA del gate `cita_id` (también notifica derivaciones de atenciones standalone). **(B) Estado**: SOLO atenciones con `cita_id`; ignora el INSERT (el "atender" desde una cita ya emite `cita 'modificada'` por la transición a en_curso); UPDATE estado→`cancelada` → `cancelada`; otro cambio de `estado` → `modificada` (incluye `finalizada`/`reabierto`).
- `trg_notificar_evento_ayudante` — AFTER INSERT ON `consumo_ayudantes` → `notificar_evento_ayudante()` (mig `20260806120000`). Notifica al ayudante (`NEW.profesional_id`) → `ayudante`/`asignada`, con `consumo_id = NEW.consumo_id`; resuelve `atencion_id`/`cita_id` vía `consumos → atenciones` (cita puede ser NULL). Una sola fuente de inserts (`useConsumos.agregarAyudante`); el `quitarAyudante` (DELETE) NO notifica.

**Dedup (no duplicar el evento sincronizado cita↔atención):** `_insert_notificacion` salta el INSERT si ya existe una notificación con el mismo **`(cita_id, profesional_id, tipo)`** en los últimos **10 segundos** — cita y atención comparten estado (la web app los sincroniza), así que cancelar/finalizar dispara los dos triggers; la ventana colapsa el par del MISMO profesional en 1 fila. La clave incluye `profesional_id` (cambio mig `20260806120000`) para NO mezclar a dos profesionales distintos (derivado vs ayudante `asignada` sobre la misma cita) y para notificar a AMBOS cuando la atención fue derivada a otro dueño que el de la cita. Solo aplica cuando hay `cita_id`. **Ceiling:** no es race-proof ante 2 UPDATE en paralelo; si aparecen duplicados, migrar a índice único minute-bucket (patrón `idx_auto_ejec_dedup`) + `INSERT ... ON CONFLICT DO NOTHING`.

**`usuario_id` = actor (best-effort), NO el destinatario.** Citas: `COALESCE(vendedor_id, NULLIF(get_current_custom_user_id(), zero-uuid))`. Atenciones: `COALESCE(NULLIF(get_current_custom_user_id(), zero-uuid), finalizado_por_id)`. Es **NULL** en bookings públicos del landing y en citas/atenciones creadas por el agente/MCP (service_role sin sesión) — la columna es nullable a propósito. El destinatario se resuelve por `profesional_id`.

**Retención:** pg_cron `cleanup-notificaciones-old` (diario 07:00 UTC) borra filas con `created_at < now() - interval '14 days'`.

**Notes:** display lean — la fila guarda `cita_id`/`atencion_id`/`consumo_id` y la app hace join a `citas → clientes/servicios` (y `consumos → servicios` para ayudante) para el texto (sin `titulo`/`mensaje` denormalizado). Sin `updated_at`/`seen_at` (append-mostly; solo `has_been_seen` cambia post-insert). Migración idempotente (tabla `if not exists`, funciones `create or replace`, triggers `drop ... if exists` + create, cron `unschedule`-if-exists). Suma a Tasks & Misc (10 → 11).


### device_push_tokens

Un token de push de **Expo** por dispositivo físico, para la **app móvil**. Es el lado servidor de `registerForPushNotificationsAsync()`: la app pide permiso, obtiene un `ExponentPushToken[...]` y lo escribe acá. Lo consume la edge function `send-push`, que hace el fan-out de una fila de [`notificaciones`](#notificaciones) a los dispositivos del profesional destinatario. `mig 20261106120000`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| usuario_id | uuid | ✗ | - |
| expo_push_token | text | ✗ | - |
| platform | text | ✗ | - |
| device_name | text | ✓ | - |
| last_seen_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |

**FK →** usuario_id → `usuarios.id` (CASCADE) |

**Constraints:** UNIQUE `expo_push_token` | CHECK `platform IN ('ios','android','web')` |

**⚠️ El token cuelga de `usuario_id`, NO de `profesional_id`.** El token lo obtiene la **sesión** que inició sesión en ese teléfono, y esa es un `usuarios`. `notificaciones.profesional_id` es el **destinatario**, así que `send-push` resuelve la cadena `profesional_id → usuario_profesionales → usuario_id[] → device_push_tokens`. Colgarlo del profesional se rompe con usuarios sin fila de profesional (admin/manager) y con un usuario vinculado a varios profesionales.

**El UNIQUE sobre `expo_push_token` es la reasignación.** Mismo teléfono + otra cuenta = `upsert ... on conflict (expo_push_token) do update set usuario_id`, en vez de dejar dos filas y mandarle el push a la persona equivocada. La app debe hacer upsert por esa columna, no INSERT.

**Sin `organizacion_id`** — se deriva de `usuarios` y, sin RLS, no compra aislamiento.

**Indexes:** `idx_device_push_tokens_usuario` on `(usuario_id)` (el lookup real de `send-push`) |

**RLS:** NO (grants-only — `GRANT SELECT, INSERT, UPDATE, DELETE TO anon, authenticated, service_role`). Espejo de `notificaciones`/`stock_por_ubicacion`.

**Trigger de fan-out** (vive en `notificaciones`, no acá): `trg_notificar_push` — **AFTER INSERT** ON `notificaciones` → `notificar_push_to_edge()` (SECURITY DEFINER, `search_path = ''`). Hace `net.http_post` a `<supabase_functions_url>/send-push` con `to_jsonb(NEW)` como body, timeout 2000 ms, envuelto en `EXCEPTION WHEN OTHERS → RAISE WARNING` para no abortar jamás la transacción que creó la cita. Mismo patrón que `trigger_oportunidad_cambio_estado_to_edge` (`20260711120000`). **Solo INSERT**: marcar `has_been_seen` es un UPDATE y no debe re-notificar. Como `notificaciones` se llena por triggers de BD, esto cubre todo origen (frontend, edge functions, RPCs, MCP) sin tocar ningún caller. Requiere `app_global_config.supabase_functions_url` seteado en el ambiente — sin eso el trigger es un no-op silencioso.

**Edge function `send-push`** (`verify_jwt = false` en `config.toml` — pg_net manda la anon key, no un JWT de usuario). Chunks de 100 mensajes (límite de Expo), `channelId: 'default'` (debe coincidir con el `ANDROID_CHANNEL_ID` de la app o Android 13+ descarta el banner), título derivado de `tipo` (`origen` solo refina `asignada`: derivación vs ayudante), y `data: {notificacionId, citaId, atencionId, consumoId}` para el deep-link al tocar. Secret opcional `EXPO_ACCESS_TOKEN`.

**Retención: ninguna, se limpia sola.** Un ticket de Expo con `details.error === 'DeviceNotRegistered'` (app desinstalada) hace que `send-push` borre la fila; borrar el usuario cascadea. No hay cron.

**Notes:** sin `updated_at` ni trigger de touch — `last_seen_at` lo escribe el cliente en cada re-registro y no hay otro editor. **iOS remote push es imposible con Apple ID gratuito** (el entitlement `aps-environment` requiere cuenta paga); en ese caso la app no obtiene token y simplemente no aparecen filas — nada acá cambia el día que se pague. Suma a Tasks & Misc (16 → 17).


### app_event_log

> Sistema de logging agnóstico **activable por (organización, módulo)** para diagnosticar problemas en prod. Migraciones `20260818140000_app_event_log.sql` (2 tablas + RLS + trim) → fixes `20260818150000` (RLS con auth custom), `20260818160000` (gate por org ID + lectura de config), `20260818170000` (visibilidad para el admin del cliente). Doc completo: `docs/development/LOGGING_SYSTEM.md` + sección Logging System en `CLAUDE.md`. Emisor en `src/services/logging/` — fire-and-forget, nunca rompe la operación que loguea; apagado = cero queries (cache en memoria).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| module | text | ✗ | - |
| level | text | ✗ | `info` |
| code | text | ✓ | - |
| message | text | ✓ | - |
| context | jsonb | ✗ | `{}`::jsonb |
| entity_type | text | ✓ | - |
| entity_id | uuid | ✓ | - |
| user_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | (`entity_id`/`user_id` SIN FK — agnóstico) |

**Constraints:** CHECK `level IN ('info','warning','error')` |

**Indexes:** `idx_app_event_log_org_module_created` on `(organizacion_id, module, created_at DESC)` | `idx_app_event_log_module_created` on `(module, created_at DESC, id DESC)` (mig `20260820120000` — la pestaña cross-org "Errores" de Configuración → Logs consulta `WHERE module='errores'` SIN filtrar por org, y el índice org-first es inutilizable por leftmost-prefix; `id DESC` es el desempate del cursor keyset) | `idx_app_event_log_entity` parcial on `(organizacion_id, entity_type, entity_id) WHERE entity_type IS NOT NULL` | **sin GIN sobre `context` a propósito** (write-heavy) |

**Triggers:** `trg_trim_app_event_log` AFTER INSERT → `trim_app_event_log()`: tope FIFO de **5000 filas por (org, módulo)** — borra por lote el excedente más viejo.

**RLS:** ENABLED. INSERT `app_event_log_insert_own_org` — cualquier usuario autenticado, solo PARA SU org (vía `get_current_custom_user_id()`; ⚠️ la versión original con `auth.uid()` nunca matcheaba — este proyecto usa auth custom, fix `20260818150000`). SELECT/DELETE gateados por `puede_ver_app_logs()` (super_admin O admin_organizacion de la org interna VentaPlay, comparada por **ID fijo** `36924e79-…` — el gate por `nombre='VentaPlay'` se rompió con un rename, fix `20260818160000`). Además el admin del CLIENTE lee los eventos de SU propia org (`app_event_log_read_own_org` vía `es_admin_de_org(organizacion_id)`, mig `20260818170000` — pestaña Impresoras → Actividad). Rol `ventaplay_readonly` (psql debug) tiene SELECT `USING (true)`.

**Notes:** `module` hoy = `'impresoras'` (variante `logImpresion`); lo específico del dominio va en `context` jsonb. `entity_type`/`entity_id` apuntan a la fila origen (`atencion_platos`, `ingreso`, …) sin FK.

### app_logging_config

> Qué (org, módulo) tiene el logging ACTIVO. Estar activo = existe fila con `expires_at` futuro; desactivar = borrar o dejar vencer. Misma familia de migraciones que `app_event_log`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| module | text | ✗ | - |
| expires_at | timestamptz | ✗ | now() + interval '48 hours' |
| activated_by | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** UNIQUE `app_logging_config_org_module_unique` on `(organizacion_id, module)` — re-activar actualiza la fila, no duplica |

**Indexes:** `idx_app_logging_config_active` on `(organizacion_id, module, expires_at)` |

**RLS:** ENABLED. **SELECT permisivo `USING (true)`** — ⚠️ crítico: el EMISOR (el cajero/mozo cuyo front loguea) necesita leer la config para saber si su org está activa; con la policy original solo-admin el cache quedaba vacío y NUNCA se escribía ningún evento (fix `20260818160000`). Escritura: admin VentaPlay (`puede_ver_app_logs()`) sin tope, O admin del cliente para SU org con `expires_at <= now() + 48h + 5min` forzado en el `WITH CHECK` (mig `20260818170000` — el tope vive en la base, no se confía en el front).

**Notes:** helpers `puede_ver_app_logs()` y `es_admin_de_org(p_org uuid)` (ambos SECURITY DEFINER, auth custom). Suman a Tasks & Misc (11 → 13).

## API externa — idempotencia y webhooks

> Migraciones `20260716224612` (enum), `20260716224617` (idempotencia + rotate key) y `20260716230505` (webhooks). ⚠️ **El contrato de la API externa (endpoints, auth, payloads, reintentos) lo documenta el skill `.agents/skills/ventaplay-api-externa/`** — acá solo va el schema.

### api_idempotency_keys

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| idempotency_key | text | ✗ | - |
| endpoint | text | ✗ | - |
| request_hash | text | ✓ | - |
| response_status | int4 | ✗ | - |
| response_body | jsonb | ✗ | `{}`::jsonb |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE `api_idempotency_keys_org_key_unique` on `(organizacion_id, idempotency_key)` |

**Indexes:** `api_idempotency_keys_created_at_idx` on `(created_at)` |

**RLS:** ENABLED **con CERO policies** + `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT ALL TO service_role`. Es decir: solo alcanzable desde edge functions. El TTL (24 h) lo aplica el helper de la edge, **no** hay cron ni CHECK que lo imponga.

**Notes:** guarda la respuesta ya emitida para un `Idempotency-Key`, de modo que un reintento del cliente devuelva exactamente lo mismo en vez de duplicar la operación.

### api_webhook_endpoints

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| url | text | ✗ | - |
| secret | text | ✗ | - |
| eventos | ARRAY (text[]) | ✗ | `{}` |
| activo | bool | ✗ | true |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** CHECK `api_webhook_endpoints_url_http`: `url ~* '^https?://'` |

**Indexes:** `api_webhook_endpoints_org_activo_idx` on `(organizacion_id, activo)` |

**RLS:** ENABLED. Policy `api_webhook_endpoints_org_all` (FOR ALL, USING + WITH CHECK org-scoped). GRANTs CRUD a `anon, authenticated, service_role`.

**Notes:** el tope de **3 endpoints activos por org** lo aplica la edge, no la base. No tiene trigger de `updated_at`.

### api_webhook_deliveries

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| endpoint_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| event_type | text | ✗ | - |
| event_id | text | ✗ | - |
| payload | jsonb | ✗ | `{}`::jsonb |
| status | text | ✗ | `pending` |
| attempts | int4 | ✗ | 0 |
| next_attempt_at | timestamptz | ✗ | now() |
| last_status_code | int4 | ✓ | - |
| last_error | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** endpoint_id → `api_webhook_endpoints.id` (CASCADE) | organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** CHECK `status IN ('pending','claimed','delivered','failed','dead')` | UNIQUE `api_webhook_deliveries_endpoint_event_unique` on `(endpoint_id, event_type, event_id)` (**deduplicación**: un evento se entrega una vez por endpoint) |

**Indexes:** `api_webhook_deliveries_claim_idx` on `(status, next_attempt_at) WHERE status IN ('pending','failed')` (cola del drainer) | `api_webhook_deliveries_org_idx` on `(organizacion_id, created_at DESC)` |

**RLS:** ENABLED. Policy `api_webhook_deliveries_org_select` (**solo SELECT**, org-scoped). GRANT SELECT a `anon, authenticated, service_role` + ALL a `service_role`.

**Notes:** la drena la edge function `drain-webhook-deliveries` — **no hay cron definido en la migración**; el disparo es externo.

### `api_type_enum` — 27 valores

Base (desde `20251115001245`, que recreó el tipo): `availability`, `services`, `professionals`, `appointments`, `organizations`, `find_earliest_slot`, `opportunities`.
`20260716224612` agrega 17: `clients`, `qualify_lead`, `resolve_servicio`, `resolve_cliente`, `validate_uuids`, `payment_link`, `payment_status`, `whatsapp_template`, `email`, `cliente_contexto`, `tags`, `funnels`, `bloqueos`, `pack_availability`, `find_earliest_pack_slot`, `create_pack_appointment`.
`20260716230505` agrega 3: `cliente_interacciones`, `register_payment`, `webhooks`.
Único consumidor: `availability_api_logs.api_type` (DEFAULT `'availability'`). ⚠️ Pese al nombre del archivo `…_api_webhooks_and_interacciones_enum.sql`, **no existe** ningún tipo `interacciones_enum`.

### `rotate_organizacion_api_key() → jsonb`

Mig `20260716224617`. plpgsql SECURITY DEFINER, `search_path = public`. Rota `organizaciones.api_key` (20 chars, alfabeto sin caracteres ambiguos) para la org del llamante. Identidad del X-Session-Token; el rol debe ser `admin_organizacion` o `super_admin` (vía `user_roles`→`roles.name`), si no `UNAUTHORIZED`/`FORBIDDEN` con ERRCODE 42501. Devuelve `{success, organizacion_id, api_key}` — **es la única vez que la key nueva se ve**.
