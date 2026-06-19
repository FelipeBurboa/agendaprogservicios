# CRM & Contacts

> 15 tables in this domain

### contactos

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| usa_mcp | bool | ✗ | true |
| changed_to_manual_date | timestamptz | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| manual_change_source | text | ✓ | - |
| name_unaccented | text | ✓ | - |
| name | text | ✓ | - |
| estado_flujo | text | ✓ | `nuevo`::text |
| tipo_de_fuente | text | ✗ | - |
| contacto_numero | text | ✗ | - |
| phone_number_id | text | ✗ | - |
| a_cargo | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| usa_flujo | bool | ✗ | true |

**FK →** organizacion_id → `organizaciones.id` | a_cargo → `usuarios.id` |

**Constraints:** UNIQUE(`unique_contacto_por_organizacion`) on contacto_numero | UNIQUE(`unique_contacto_por_organizacion`) on organizacion_id |

### clientes

| Column | Type | Null | Default |
|--------|------|------|---------|
| email | text | ✓ | - |
| genero | varchar | ✓ | - |
| pais | varchar | ✓ | - |
| region | varchar | ✓ | - |
| ciudad | varchar | ✓ | - |
| perfil | text | ✓ | - |
| rut | text | ✓ | - |
| direccion | text | ✓ | - |
| observacion | text | ✓ | - |
| calificacion_estado | text | ✓ | - |
| fecha_ultima_interaccion | timestamptz | ✓ | - |
| campos_personalizados | jsonb | ✓ | `{}`::jsonb |
| id | uuid | ✗ | gen_random_uuid() |
| calificacion_fecha | timestamptz | ✓ | - |
| calificacion_datos | jsonb | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| contacto_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| fecha_nacimiento | date | ✓ | - |
| email_verificado_light | bool | ✓ | - |
| email_verificado_light_detalle | jsonb | ✓ | - |
| email_verificado_light_fecha | timestamptz | ✓ | - |
| email_verificado_pro | bool | ✓ | - |
| email_verificado_pro_fecha | timestamptz | ✓ | - |
| bounced | bool | ✗ | false |
| suscrito_email | bool | ✗ | true |

**FK →** organizacion_id → `organizaciones.id` | contacto_id → `contactos.id` | contacto_id → `contactos.id` |

**Indexes:** `clientes_bounced_lower_email_idx` on `lower(btrim(email))` WHERE `bounced = true` — partial index supporting cross-org bounce propagation on normalized email. Added in `20260419040000_cliente_bounced_sync_trigger.sql`.

**Triggers:**
- `cliente_bounced_sync` (BEFORE INSERT OR UPDATE OF email) → `sync_cliente_bounced_from_email()`. On insert or email change: if ANY other `clientes` row across orgs shares the same normalized email (`lower(btrim(email))`) and has `bounced=true`, the NEW row inherits `bounced=true`. On email change (row already `bounced=true`): resets `bounced=false` if the new email is not flagged anywhere. Purpose: keep the bounced flag consistent across orgs so a single Resend bounce stops future sends everywhere. Added in `20260419040000_cliente_bounced_sync_trigger.sql`.

**Bulk-update RPCs (on `clientes`):**
- `bulk_flag_bounced(email_list text[]) RETURNS integer` — SECURITY DEFINER, no auth gate (UI-gated). Idempotent bulk-flag `bounced=true` on matching `lower(btrim(email))`. Returns count of rows updated. Migrations `20260418020000_bulk_flag_bounced_rpc.sql` + `20260418030000_bulk_flag_bounced_drop_auth_check.sql` (removed the `email_kill_switch_admin_only_update` gate).
- `bulk_flag_email_verificado_pro(email_list text[]) RETURNS integer` — SECURITY DEFINER. Sets `email_verificado_pro=true` + `email_verificado_pro_fecha=now()` for matching emails. Migration `20260419050000_bulk_flag_email_verificado_pro.sql`.

**Scheduled jobs (pg_cron):**
- `flag-invalid-emails-as-bounced` — daily at 05:00 UTC. Auto-flags typosquat / malformed `clientes.email` values as `bounced=true` (prevents Resend send attempts that would bounce). Migration `20260418010000_cron_flag_invalid_emails.sql`.

### cliente_tags

| Column | Type | Null | Default |
|--------|------|------|---------|
| tipo | varchar | ✗ | - |
| color | varchar | ✓ | `#6B7280`::character varying |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| nombre | varchar | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`cliente_tags_nombre_tipo_organizacion_id_key`) on nombre | UNIQUE(`cliente_tags_nombre_tipo_organizacion_id_key`) on tipo | UNIQUE(`cliente_tags_nombre_tipo_organizacion_id_key`) on organizacion_id |

### cliente_tag_asociaciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✓ | now() |
| tag_id | uuid | ✗ | - |
| cliente_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** tag_id → `cliente_tags.id` | cliente_id → `clientes.id` |

**Constraints:** UNIQUE(`cliente_tag_asociaciones_cliente_id_tag_id_key`) on tag_id | UNIQUE(`cliente_tag_asociaciones_cliente_id_tag_id_key`) on cliente_id |

**RPCs:**
- `public_attach_cliente_tag(p_cliente_id uuid, p_tag_id uuid) RETURNS void` — SECURITY DEFINER, `search_path = public`. Lets the **public form/agendamiento widget** (rol `anon` via `supabasePublic`) attach a `cliente_tag` to a freshly-created cliente, bypassing the `cliente_tag_asociaciones` RLS that blocks anon writes. Validates cross-org (`clientes.organizacion_id` must equal `cliente_tags.organizacion_id` — RAISEs if they differ, blocking cross-org tag injection) and is idempotent (`INSERT … ON CONFLICT (cliente_id, tag_id) DO NOTHING`). Granted to `anon, authenticated, service_role`. Exact mirror of `public_attach_oportunidad_tag` (`20260412224552`). Migration `20260617120000_public_attach_cliente_tag.sql`.

### cliente_empresa

| Column | Type | Null | Default |
|--------|------|------|---------|
| cliente_id | uuid | ✗ | - |
| empresa_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** empresa_id → `empresas.id` | cliente_id → `clientes.id` |

**Constraints:** UNIQUE(`cliente_empresa_cliente_id_empresa_id_key`) on cliente_id | UNIQUE(`cliente_empresa_cliente_id_empresa_id_key`) on empresa_id |

### cliente_interacciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| cliente_id | uuid | ✗ | - |
| created_at | timestamp | ✓ | now() |
| metadata | jsonb | ✓ | `{}`::jsonb |
| id | uuid | ✗ | gen_random_uuid() |
| usuario_id | uuid | ✓ | - |
| resultado | text | ✓ | - |
| tipo | varchar | ✗ | - |
| descripcion | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| updated_at | timestamp | ✓ | now() |
| fecha | timestamp | ✗ | now() |

**FK →** cliente_id → `clientes.id` | organizacion_id → `organizaciones.id` | usuario_id → `usuarios.id` |

### empresas

| Column | Type | Null | Default |
|--------|------|------|---------|
| email | varchar | ✓ | - |
| nombre | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| telefono | varchar | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| rut | text | ✓ | - |
| region | varchar | ✓ | - |
| direccion | text | ✓ | - |
| ciudad | varchar | ✓ | - |
| pais | varchar | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

### empresa_tags

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| tipo | varchar | ✗ | - |
| color | varchar | ✓ | `#6B7280`::character varying |
| updated_at | timestamptz | ✓ | now() |
| created_at | timestamptz | ✓ | now() |
| organizacion_id | uuid | ✗ | - |
| nombre | varchar | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`empresa_tags_nombre_tipo_organizacion_id_key`) on nombre | UNIQUE(`empresa_tags_nombre_tipo_organizacion_id_key`) on organizacion_id | UNIQUE(`empresa_tags_nombre_tipo_organizacion_id_key`) on tipo |

### empresa_tag_asociaciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| tag_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| empresa_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** empresa_id → `empresas.id` | tag_id → `empresa_tags.id` |

**Constraints:** UNIQUE(`empresa_tag_asociaciones_empresa_id_tag_id_key`) on tag_id | UNIQUE(`empresa_tag_asociaciones_empresa_id_tag_id_key`) on empresa_id |

### contacto_mensajes

| Column | Type | Null | Default |
|--------|------|------|---------|
| whatsapp_message_id | text | ✓ | - |
| enviado_por | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| debug_metadata | jsonb | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| tool_calls | jsonb | ✓ | - |
| contacto_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_mensaje | text | ✓ | - |
| contacto_mensaje | text | ✓ | - |
| tipo_mensaje | text | ✓ | `texto`::text |
| created_at | timestamptz | ✗ | now() |

**FK →** contacto_id → `contactos.id`

**Constraints:**
- `check_solo_un_mensaje` — exactly ONE of `contacto_mensaje` or `organizacion_mensaje` must be non-null (incoming OR outgoing, never both)
- `chk_tipo_mensaje` — `tipo_mensaje` must be one of: texto, audio, imagen, documento, video, ubicacion, botones, lista, cta, interactivo
- **PARTIAL UNIQUE INDEX `contacto_mensajes_whatsapp_message_id_org_unique`** on `(whatsapp_message_id, organizacion_id)` WHERE `whatsapp_message_id IS NOT NULL` — prevents duplicate webhook deliveries from creating duplicate incoming message rows. Outgoing messages have `whatsapp_message_id = NULL` so they're excluded from the constraint.

**⚠️ Webhook insert pattern:** Always handle PostgreSQL error code `23505` (unique_violation) when inserting incoming WhatsApp messages — this indicates a duplicate webhook delivery and should be silently skipped, not treated as an error. See `whatsapp-webhook-verify/index.ts` for the canonical pattern.

### contacto_respuesta

| Column | Type | Null | Default |
|--------|------|------|---------|
| updated_at | timestamptz | ✗ | now() |
| codigo | text | ✗ | - |
| id | int8 | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| contacto_id | uuid | ✗ | - |
| respuesta_id | uuid | ✓ | - |
| typeform_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | typeform_id → `typeform.id` | respuesta_id → `typeform_response.id` | contacto_id → `contactos.id` |

**Constraints:** UNIQUE(`contacto_respuesta_codigo_key`) on codigo |

### notas

| Column | Type | Null | Default |
|--------|------|------|---------|
| usuario_id | uuid | ✗ | - |
| fecha_creacion | timestamptz | ✗ | now() |
| oportunidad_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| contenido | text | ✗ | - |

**FK →** oportunidad_id → `oportunidades.id` | usuario_id → `usuarios.id` |

### fichas_medicas

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| atencion_id | uuid | ✗ | - |
| version | int4 | ✗ | 1 |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| contenido | jsonb | ✗ | `{}`::jsonb |
| profesional_id | uuid | ✗ | - |

**FK →** profesional_id → `profesionales.id` | atencion_id → `atenciones.id` |

**Constraints:** UNIQUE(`uq_ficha_por_atencion`) on atencion_id |

### puntos_cliente

> ⚠️ Table not found in schema dump
### canjes

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| porcentaje | numeric | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| monto | numeric | ✗ | - |
| codigo | text | ✗ | - |
| tipo_descuento | text | ✗ | `monto`::text |
| ingreso_id | uuid | ✓ | - |
| atencion_id | uuid | ✗ | - |

**FK →** ingreso_id → `ingresos.id` | atencion_id → `atenciones.id` | organizacion_id → `organizaciones.id` |

