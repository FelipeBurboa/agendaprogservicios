# Appointments & Calendar

> 9 tables in this domain (6 core + 3 Google Calendar integration)

### citas

| Column | Type | Null | Default |
|--------|------|------|---------|
| zona_horaria | text | ✓ | `America/Santiago`::text |
| metodo_agendamiento | text | ✗ | `manual`::text |
| motivo_cancelacion | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| fecha_cita | date | ✗ | - |
| hora_inicio | time | ✗ | - |
| hora_fin | time | ✗ | - |
| servicios | jsonb | ✗ | `[]`::jsonb |
| sucursal_id | uuid | ✓ | - |
| agendado_por | uuid | ✓ | - |
| agendado_en | timestamptz | ✗ | now() |
| cita_original_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| vendedor_id | uuid | ✓ | - |
| estado | text | ✗ | `confirmada`::text |
| notas_internas | text | ✓ | - |
| observaciones | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| cliente_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| pack_grupo_id | uuid | ✓ | - |
| pack_servicio_id | uuid | ✓ | - |
| google_meet_url | text | ✓ | - |

**FK →** sucursal_id → `sucursales.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` | cliente_id → `clientes.id` | cita_original_id → `citas.id` | vendedor_id → `usuarios.id` |

**Notes:** `pack_grupo_id` groups all citas generated from a single pack sale (logical grouping, no FK). `pack_servicio_id` → `servicios.id` (the parent pack service). See `servicios.tipo='pack'` + `pack_config`. `google_meet_url` is populated by the `google-calendar-sync` Edge Function when the professional has Google Calendar connected AND `organizaciones.crear_google_meet_citas = true`; NULL otherwise. Consumed by the "Reunión" tab in `CitaDetalleModal` and exposed to WhatsApp automations as the `cita.link_meet` variable in `trigger-automatizaciones`.

### agenda_disponibilidad

| Column | Type | Null | Default |
|--------|------|------|---------|
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| profesional_id | uuid | ✗ | - |
| servicio_id | uuid | ✗ | - |
| fecha | date | ✗ | - |
| hora_inicio | time | ✗ | - |
| hora_fin | time | ✗ | - |
| cupos_totales | int4 | ✗ | 1 |
| cupos_ocupados | int4 | ✗ | 0 |
| activo | bool | ✗ | true |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** profesional_id → `profesionales.id` | servicio_id → `servicios.id` |

**Constraints:** UNIQUE(`unique_agenda_slot`) on servicio_id | UNIQUE(`unique_agenda_slot`) on fecha | UNIQUE(`unique_agenda_slot`) on hora_inicio | UNIQUE(`unique_agenda_slot`) on profesional_id |

### configuraciones_agenda

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| clave | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✓ | now() |
| valor | jsonb | ✗ | - |
| updated_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`unique_organizacion_clave`) on clave | UNIQUE(`unique_organizacion_clave`) on organizacion_id |

### excepcion_servicios

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| servicio_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| excepcion_id | uuid | ✗ | - |

**FK →** excepcion_id → `profesional_excepciones.id` | servicio_id → `servicios.id` |

**Constraints:** UNIQUE(`excepcion_servicios_excepcion_id_servicio_id_key`) on servicio_id | UNIQUE(`excepcion_servicios_excepcion_id_servicio_id_key`) on excepcion_id |

### reglas_agenda

| Column | Type | Null | Default |
|--------|------|------|---------|
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| agenda_habilitada | bool | ✗ | true |
| fecha_apertura | timestamptz | ✓ | - |
| mantener_dias_abierta | bool | ✗ | false |
| dias_mantener | int4 | ✓ | - |
| horas_previas_cita | int4 | ✗ | 3 |
| horas_previas_es_solo_web | bool | ✗ | false |
| admite_bloques_paralelos | bool | ✗ | false |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`reglas_agenda_profesional_id_key`) on profesional_id |

### organizacion_bloqueos

Org-wide feriados (holidays) that block booking for **every** profesional in the organization, including profesionales added AFTER the bloqueo is created. Distinct from per-profesional `profesional_bloqueos` (one-off leave) and `profesional_bloqueos_recurrentes` (weekly pauses). Created and managed only by `admin_organizacion` users (RLS-enforced); read by all same-org users so the calendar overlay is visible to everyone.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| motivo | text | ✗ | - |
| fecha_inicio | timestamptz | ✗ | - |
| fecha_fin | timestamptz | ✗ | - |
| created_by | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| profesionales_excluidos | uuid[] | ✗ | `{}`::uuid[] |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | created_by → `usuarios.id` (SET NULL) |

**Constraints:** CHECK `char_length(trim(motivo)) >= 3` | CHECK `fecha_fin > fecha_inicio` |

`profesionales_excluidos` (mig `20260610120000_organizacion_bloqueos_profesionales_excluidos.sql`) — UUIDs of professionals EXCLUDED from this org-wide feriado: their agenda remains available during the bloqueo's date range while every other profesional of the org stays blocked. Default `'{}'` (empty) = the feriado applies to ALL profesionales (preserves prior behavior for every existing row). Read server-side by `obtener_slots_con_incremento_v2`, `validar_capacidad_cita` (mig `20260610120000`) AND `obtener_proxima_hora_por_servicio_batch` (mig `20260610130000` — earlier rewrites of the batch RPC predated `organizacion_bloqueos` and didn't honor feriados at all, so the "próxima hora" chip in SelectorProfesionalModal could suggest slots on feriados; this is a UI-consistency fix, not a double-booking risk since the booking still got rejected by `validar_capacidad_cita`).

**Indexes:** `idx_organizacion_bloqueos_org_rango` on `(organizacion_id, fecha_inicio, fecha_fin)` |

**RLS:** SELECT for any same-org user (`get_current_user_organization()`) or `is_super_admin()`. INSERT/UPDATE/DELETE only when the current user's `usuarios.rol = 'admin_organizacion'` and `organizacion_id` matches (or super admin).

**Server-side enforcement:** read by `obtener_slots_con_incremento_v2` (slots return `slot_disponible=false` with motivo `Bloqueado por feriado organizacional: ...`) and by `validar_capacidad_cita` (cita insert/update rejected with motivo `El horario solicitado coincide con un feriado organizacional: ...`). Mig `20260427120001_obtener_slots_org_bloqueos.sql`.

**TZ semantics:** `fecha_inicio`/`fecha_fin` are `timestamptz`. RPCs convert the slot's `(slot_fecha + slot_hora_inicio)` (timestamp without tz) to timestamptz via `at time zone 'America/Santiago'` before comparing — consistent with the project's Chile-timezone convention.

**Frontend merge:** `useBloqueosCalendario` and `useBloqueosCalendarioSemanal` call `useBloqueosOrganizacionRange` and inject one synthetic `Bloqueo` row per (org_bloqueo, profesional_id) pair with `es_organizacional=true`. The existing `BloqueoOverlay` / `BloqueoOverlaySemanal` render those rows in red hatched style with a "Feriado: ..." label and hide the per-row delete button — feriados are deleted only from the admin section in `ConfiguracionesBloques`.

Added 2026-04-27 (mig `20260427120000_organizacion_bloqueos.sql`).

## Slot & Capacity RPCs

### obtener_derivaciones_profesional_rango(p_profesional_id uuid, p_fecha_inicio date, p_fecha_fin date)

Returns `(cita_id, fecha_cita, hora_inicio, hora_fin)` for each cita in the range where:
- `citas.profesional_id <> p_profesional_id` (another pro is primary), AND
- `atenciones.profesional_id = p_profesional_id` OR a `consumos` row of that atencion has `profesional_id = p_profesional_id AND servicio_id IS NOT NULL AND producto_id IS NULL` (servicio consumption attributed to P).

`SECURITY DEFINER`, granted to `anon|authenticated|service_role`. Added 2026-04-22.

### obtener_slots_con_incremento_v2(p_profesional_id, p_fecha_inicio, p_fecha_fin, p_servicio_ids, p_incremento_minutos=30, p_duracion_minutos=null, p_only_first_available=false)

Returns per-slot `(slot_fecha, slot_hora_inicio, slot_hora_fin, slot_disponible, slot_cupos_disponibles, slot_cupo_total, slot_motivo)`. Since 2026-04-22 its `ocupaciones_rango` CTE is the `UNION ALL` of `citas_rango` (primary citas) + `derivaciones_rango` (from `obtener_derivaciones_profesional_rango`), so derivaciones count against the target professional's cupos.

**`p_only_first_available` (added in mig `20260424063319_cupos_earliest_mode.sql`):** when true, the function short-circuits and returns **at most one row** — the earliest slot where `slot_disponible = true`. Existing callers default to false, so behaviour is backward compatible. Used by the batch RPC below.

**Org-wide feriados (mig `20260427120001_obtener_slots_org_bloqueos.sql`):** new `bloqueos_organizacion` CTE + lateral join checks `organizacion_bloqueos` for the profesional's org. When a slot overlaps a feriado, `slot_disponible=false` and `slot_motivo` is `Bloqueado por feriado organizacional: <motivo>`. Comparison uses `at time zone 'America/Santiago'` to convert slot date+time to timestamptz.

**Layer-2 cupo check:** since the `cupos` move from `servicios` → `profesional_servicio` (mig `20260424002919_cupos_per_asignacion.sql`), the slot/capacity RPCs cross-reference `profesional_servicio.cupos` for the (profesional, servicio) pair. See [services-professionals.md](services-professionals.md) for the column definition.

**Supporting indexes (mig `20260424063318_cupos_perf_indexes.sql`):**
- `idx_citas_servicios_gin` — GIN on `citas.servicios` array, used to filter citas that include any of the requested `p_servicio_ids`.
- `idx_citas_profesional_servicio_includes` — composite covering index for the `(profesional_id, fecha_cita)` scan with `servicios` included.
- `idx_consumos_profesional_atencion` — speeds up the derivation-side lookup in `obtener_derivaciones_profesional_rango`.

**`servicios.ventana_minutos` ventana extension (mig `20260604120000_add_ventana_minutos_to_servicios.sql`):** new `citas_rango_extendidas` CTE between `citas_rango` and `ocupaciones_rango`. For each cita, computes `hora_fin_eff = least(hora_fin + max(ventana_minutos) * interval '1 minute', time '23:59:59')` by looking up `ventana_minutos` from `servicios` for every UUID in the cita's `servicios` JSONB. Pack-non-last items are SUPPRESSED via a sibling EXISTS check (`c_sib.pack_grupo_id = cr.pack_grupo_id AND c_sib.hora_inicio >= cr.hora_fin AND c_sib.fecha_cita = cr.fecha_cita`) — only the LAST pack item's ventana fires. `ocupaciones_rango` then reads `hora_fin_eff as hora_fin`, so Layer 1 (bloque cupo) treats the ventana tail as occupied. Layer 2 (`constraints_por_slot`) continues to join the raw `citas_rango` — ventana is profesional-level only. Derivaciones pass through unchanged (no servicios JSONB → no ventana).

### obtener_proxima_hora_por_servicio_batch(p_profesional_id uuid, p_servicio_ids uuid[], p_fecha_inicio date, p_fecha_fin date, p_incremento_minutos int=15, p_duracion_default int=null)

Returns `(servicio_id, slot_fecha, slot_hora_inicio, slot_hora_fin, slot_disponible, slot_motivo)` — exactly **one row per requested servicio_id**, order preserved. Loops server-side calling `obtener_slots_con_incremento_v2` with `p_only_first_available=true` per servicio. When no disponible slot exists for a servicio, the row has `slot_disponible = false` and NULL date/time fields. `SECURITY DEFINER`, granted to `anon|authenticated|service_role`.

**Why:** `SelectorProfesionalModal` previously ran one `obtener_slots_con_incremento_v2` call per (profesional, servicio) pair. With N profesionales × S servicios this saturated the DB with parallel POSTs and hit the statement timeout. Migration `20260424063320_proxima_hora_batch.sql` collapses each profesional's S calls into one server-side loop — the front-end now makes N calls total.

**Ventana extension (mig `20260605120000_proxima_hora_batch_ventana.sql`):** the batch RPC carries its own `citas_rango` CTE (it does NOT delegate to v2) and was originally written before ventana shipped. Round 1 of the ventana rollout missed it, so the Selector Profesional modal kept showing pre-ventana próxima hora while `ServicioCard` (which hits v2 directly) correctly respected ventana. The follow-up migration rewires the batch RPC with the same `citas_rango_extendidas` CTE pattern as v2 (extends each cita's `hora_fin` by `max(ventana_minutos)`, pack-non-last suppression via sibling EXISTS). Layer 2 `cita_side_constraints` continues to join the raw `citas_rango`. Signature unchanged.

### validar_capacidad_cita(p_profesional_id, p_fecha_cita, p_hora_inicio, p_hora_fin, p_exclude_cita_id=null, p_servicios=null)

Returns `(valida, motivo, ocupacion_max, cupo_min)`. Since 2026-04-22, per-minute occupancy sums citas + derivaciones, with `p_exclude_cita_id` applied on both branches.

**`p_servicios jsonb` (mig `20260424002918_servicios_cupos.sql`, kept after the cupos move to `profesional_servicio` in `_002919`):** optional payload describing the servicios for the cita being validated. When provided, the function additionally enforces the per-(profesional, servicio) cupo from `profesional_servicio.cupos`. Default NULL = backward compatible (only legacy capacity check runs).

**Org-wide feriados (mig `20260427120001_obtener_slots_org_bloqueos.sql`):** also queries `organizacion_bloqueos` for the profesional's org and rejects citas overlapping any feriado with motivo `El horario solicitado coincide con un feriado organizacional: <motivo>`. Date+time → timestamptz comparison via `at time zone 'America/Santiago'`.

**Ventana tail in Layer 1 (mig `20260604120000_add_ventana_minutos_to_servicios.sql`):** the `ocupacion` CTE's citas count subquery now matches each prior cita when `c.hora_fin > minuto` (real overlap) **OR** `minuto < c.hora_fin + max(servicios.ventana_minutos)` (ventana tail). Pack-non-last items are suppressed via the same sibling EXISTS guard as the slot RPC. The NEW cita's own ventana doesn't fire against itself — only future citas pay for it. Derivaciones count subquery unchanged. Layer 2 (`constraints` CTE) untouched.

**Trigger:** `trigger_validar_capacidad_cita` wraps this function and is bound `BEFORE INSERT OR UPDATE OF profesional_id, fecha_cita, hora_inicio, hora_fin, estado ON citas FOR EACH ROW` (mig `20260308172649_cupos_citas.sql:429`). Fires regardless of role — service_role, anon, authenticated all hit it. `metodo_agendamiento='importacion'` short-circuits the trigger for bulk imports.

**Asymmetry:** inserting a `consumos` row (the derivation side) has no capacity trigger — only cita create/update hits this validator.

---

## Google Calendar Integration (Phase 1: VentaPlay → Google, unidirectional)

Added in mig `20260526120002_google_calendar_integration.sql`. Three tables + one VIEW + RLS + `set_updated_at_gcal()` trigger. The integration syncs cita creates/updates/cancels to the professional's personal Google Calendar (one-way for now). Phase 2 (bidirectional) fields are pre-allocated nullable — no schema migration needed when Phase 2 ships. Edge functions live under `supabase/functions/google-calendar-sync/`, `google-oauth-init/`, `google-oauth-callback/`, etc.

### google_calendar_connections

One row per profesional that has linked their Google account. Tokens live here in plaintext (Phase 1 posture) and are accessed only via service_role through edge functions.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| google_email | text | ✗ | - |
| google_user_id | text | ✓ | - |
| calendar_id | text | ✗ | `primary` |
| access_token | text | ✗ | - |
| refresh_token | text | ✗ | - |
| access_token_expires_at | timestamptz | ✗ | - |
| scopes_granted | text[] | ✗ | - |
| status | text | ✗ | `active` |
| last_error | text | ✓ | - |
| last_error_at | timestamptz | ✓ | - |
| sync_token | text | ✓ | - |
| watch_channel_id | text | ✓ | - |
| watch_resource_id | text | ✓ | - |
| watch_expiration | timestamptz | ✓ | - |
| bidirectional_enabled | bool | ✗ | false |
| default_reminders_minutes | int4[] | ✗ | `{60, 1440}`::int4[] |
| event_color_id | text | ✓ | - |
| include_client_email | bool | ✗ | false |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| last_sync_at | timestamptz | ✓ | - |

**FK →** profesional_id → `profesionales.id` (CASCADE, UNIQUE — one connection per profesional) | organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** UNIQUE on `profesional_id` | CHECK(`status`) IN (`active`, `token_revocado`, `token_expirado`, `error`, `disconnected`) |

**Indexes:** `idx_gcal_conn_org` on `organizacion_id` | partial `idx_gcal_conn_status` on `status` WHERE `status != 'active'` (for surfacing problem connections in admin UI) | partial `idx_gcal_conn_watch_exp` on `watch_expiration` WHERE `watch_channel_id IS NOT NULL` (Phase 2 — for the watch-renewal cron).

**Phase 2 fields (nullable, unused in Phase 1):** `sync_token` for incremental `events.list` calls, `watch_channel_id` + `watch_resource_id` + `watch_expiration` for Google's push notification channels, `bidirectional_enabled` as the master switch when the inbound webhook ships.

**Per-connection settings (Phase 1 active):** `default_reminders_minutes` (override Google's default — VentaPlay defaults to `{60, 1440}` = 1h + 1 day before), `event_color_id` (`'1'..'11'`, NULL = Google default), `include_client_email` (when true, the client is invited as a Google attendee).

### google_calendar_event_map

Cita ↔ Google event mapping. One row per cita that has been pushed to Google. The CASCADE on `cita_id` means a deleted cita silently orphans Google events (no automatic remote delete) — by design, since cita deletion is rare and the edge function explicitly handles cita-cancel via the `delete` operation BEFORE deleting the local row.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| cita_id | uuid | ✗ | - |
| connection_id | uuid | ✗ | - |
| google_event_id | text | ✗ | - |
| google_calendar_id | text | ✗ | `primary` |
| etag | text | ✓ | - |
| last_known_updated | timestamptz | ✓ | - |
| remote_modified_by | text | ✓ | - |
| status | text | ✗ | `synced` |
| last_pushed_at | timestamptz | ✗ | now() |
| retry_count | int4 | ✗ | 0 |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** cita_id → `citas.id` (CASCADE, UNIQUE — one Google event per cita) | connection_id → `google_calendar_connections.id` (CASCADE) |

**Constraints:** UNIQUE on `cita_id` | UNIQUE(`connection_id`, `google_event_id`) | CHECK(`status`) IN (`synced`, `pending`, `failed`, `deleted`) |

**Indexes:** `idx_gcal_map_connection` on `connection_id` | partial `idx_gcal_map_status_retry` on `(status, retry_count)` WHERE `status IN ('pending','failed')` (drives the retry queue cron).

**Phase 2 conflict-resolution fields (nullable):** `etag` (Google's optimistic-concurrency token, used to reject inbound changes that would overwrite local updates), `last_known_updated` (last `updated` timestamp from Google's event payload), `remote_modified_by` (email of who last edited the Google event when not VentaPlay — supports "Maria edited this in her phone" UX).

### google_calendar_sync_log

Append-only audit. One row per operation against Google's API. Used by the admin UI to show "últimos 10 syncs" per connection and by ops to debug failed integrations.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | bigserial | ✗ | - |
| connection_id | uuid | ✓ | - |
| cita_id | uuid | ✓ | - |
| google_event_id | text | ✓ | - |
| direction | text | ✗ | - |
| operation | text | ✗ | - |
| result | text | ✗ | - |
| http_status | int4 | ✓ | - |
| google_error_code | text | ✓ | - |
| error_message | text | ✓ | - |
| request_payload | jsonb | ✓ | - |
| response_payload | jsonb | ✓ | - |
| duration_ms | int4 | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** connection_id → `google_calendar_connections.id` (SET NULL — preserves audit when a connection is deleted) | cita_id → `citas.id` (SET NULL — same reason) |

**Constraints:** CHECK(`direction`) IN (`outbound`, `inbound`) | CHECK(`operation`) IN (`create`, `update`, `delete`, `refresh_token`, `watch_renew`, `full_sync`, `disconnect`) | CHECK(`result`) IN (`success`, `error`, `skipped`, `retry_scheduled`) |

**Indexes:** `idx_gcal_log_cita` on `cita_id` | `idx_gcal_log_conn_created` on `(connection_id, created_at DESC)` (powers "últimos 10 syncs" UI in O(log n)) | partial `idx_gcal_log_errors` on `created_at DESC` WHERE `result = 'error'` (powers ops dashboards).

**Phase 1 only emits `direction='outbound'`.** Phase 2 webhook will write `direction='inbound'` rows when Google notifies us of remote changes.

### RLS posture (Phase 1)

All three tables: RLS enabled with `FOR SELECT USING (organizacion_id = get_current_custom_user_organization())` (event_map and sync_log go through connection_id). Mirrors the protection level of `configuracion_whatsapp_business.meta_token` — tokens stay scoped to the org. **No INSERT/UPDATE/DELETE policies** — all writes go through edge functions with service_role.

### `google_calendar_connections_public` VIEW

Token-stripped projection of `google_calendar_connections` for frontend consumption. Exposes everything **except** `access_token`, `refresh_token`, `google_user_id`, `last_error` (the error message can leak token state).

**SECURITY INVOKER = FALSE (default)** — VIEW runs as owner (postgres) and bypasses RLS. **Reason**: the project uses a custom-auth GUC (`set_current_user_id` → `app.current_user_id`) that resets between requests due to Supabase connection pooling. During post-reload rehydration there's a race where the query can fire before the GUC is set on its connection → `get_current_custom_user_organization()` returns the zero UUID → RLS blocks the read. The VIEW solves this by running as owner. Trade-off: authenticated users from any org can read metadata of connections from other orgs (no tokens, just `google_email` + `status` + settings). Risk accepted because the VIEW doesn't expose tokens or client data. Granted SELECT to `anon, authenticated`.

### `set_updated_at_gcal()` trigger

Standard updated_at trigger bound to all 3 gcal tables. Identical to the rest of the codebase — fires `BEFORE UPDATE ... FOR EACH ROW` and sets `NEW.updated_at = now()`.

