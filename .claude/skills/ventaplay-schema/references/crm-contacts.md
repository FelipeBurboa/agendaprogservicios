# CRM & Contacts

> 18 tables in this domain

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
| estado_funnel_actual_id | uuid | ✓ | - |
| tag_ids | ARRAY (uuid[]) | ✗ | `{}` |
| ultima_atencion_efectiva | date | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | contacto_id → `contactos.id` | estado_funnel_actual_id → `estados_funnel.id` (ON DELETE SET NULL) |

**Indexes:** `clientes_bounced_lower_email_idx` on `lower(btrim(email))` WHERE `bounced = true` — partial index supporting cross-org bounce propagation on normalized email. Added in `20260419040000_cliente_bounced_sync_trigger.sql`. | `idx_clientes_estado_actual_org` on `(organizacion_id, estado_funnel_actual_id)` | `idx_clientes_tag_ids_gin` **GIN** on `(tag_ids)` | `idx_clientes_ultima_atencion_efectiva` on `(organizacion_id, ultima_atencion_efectiva)`.

**⚠️ Columnas DENORMALIZADAS (migs `20260617180622`, `20260617191204`, `20260624222856`) — nunca escribirlas a mano.** Existen para que el listado `/clientes` filtre/ordene sin N+1 ni joins caros; **la fuente de verdad sigue siendo la tabla origen** y un trigger las recalcula:

| Columna | Fuente de verdad | Trigger que la mantiene |
|---|---|---|
| `estado_funnel_actual_id` | `oportunidades` (la de `fecha_ultimo_cambio` más reciente del cliente) | `trg_sync_cliente_estado_actual` AFTER INSERT/DELETE/UPDATE OF `estado_id, fecha_ultimo_cambio, cliente_id` ON `oportunidades` → `sync_cliente_estado_actual()` → `recompute_cliente_estado_actual(uuid)`. Al reasignar una oportunidad de cliente recalcula **ambos** (OLD y NEW). Misma semántica que `get_cliente_estado_funnel_batch` |
| `tag_ids uuid[]` | `cliente_tag_asociaciones` | `trg_sync_cliente_tag_ids` AFTER INSERT/DELETE/UPDATE OF `tag_id, cliente_id` → `sync_cliente_tag_ids()` → `recompute_cliente_tag_ids(uuid)` |
| `ultima_atencion_efectiva date` | `MAX((atenciones.fecha_inicio AT TIME ZONE 'America/Santiago')::date)` con `estado IN ('finalizada','en_curso','reabierto')` | `trg_sync_cliente_ultima_atencion` AFTER INSERT/DELETE/UPDATE OF `fecha_inicio, estado, cliente_id` ON `atenciones` → `sync_cliente_ultima_atencion()` → `recalc_cliente_ultima_atencion(uuid)` |

Todas las funciones son SECURITY DEFINER; las tres migraciones hicieron backfill al aplicarse.

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
- `chk_tipo_mensaje` — `tipo_mensaje` must be one of: texto, audio, imagen, documento, video, ubicacion, botones, lista, cta, interactivo, sticker, reaction (`reaction` rows store `[REACTION:<emoji>|<target_wamid>]` in `contacto_mensaje`; emoji empty = reaction removed; they are excluded from all flujo sweeps and never trigger flows)
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

> ⚠️ Table not found in schema dump. **Superseded** — el modelo de puntos vigente es el Club de Fidelización (`club_puntos_movimientos`, abajo).

## Club de Fidelización (puntos por compra POS)

> Migraciones `20260925150000` (3 tablas + `ensure_club_claim`), `20260925150001` (acreditación por código) y `20261102120000` (elegibilidad + payload POS). Gateado por `organizaciones.usa_club_fidelizacion`. Flujo: un cobro POS genera un **claim** con código `VP-XXXX` impreso en el voucher → el cliente lo manda por WhatsApp → se acredita y se abona el movimiento de puntos. Las 3 tablas tienen **RLS ENABLED** org-scoped (`is_super_admin() OR organizacion_id = get_current_custom_user_organization()`).

### club_fidelizacion_config

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | — (**PK**) |
| modo | text | ✗ | `por_monto` |
| monto_por_punto | numeric | ✗ | 1000 |
| porcentaje | numeric | ✗ | 1 |
| whatsapp_destino | text | ✓ | - |
| mensaje_template | text | ✗ | `Hola quiero acumular puntos de mi compra {{codigo}}` |
| activo | bool | ✗ | true |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) — es también la PK: **una fila por org**.

**Constraints:** CHECK `modo IN ('por_monto','porcentaje')` | CHECK `monto_por_punto > 0` | CHECK `porcentaje >= 0` |

**RLS:** policies `_select` + `_write` (FOR ALL). GRANTs SELECT/INSERT/UPDATE/DELETE a `anon, authenticated`.

### club_claims

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| cliente_id | uuid | ✓ | - |
| ingreso_id | uuid | ✗ | - |
| codigo | text | ✗ | - |
| monto_snapshot | numeric | ✗ | - |
| puntos_calculados | int4 | ✗ | - |
| estado | text | ✗ | `pending` |
| claimed_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | cliente_id → `clientes.id` (CASCADE) | ingreso_id → `ingresos.id` (CASCADE) |

**Constraints:** UNIQUE `club_claims_ingreso_unique` on `(ingreso_id)` (**idempotencia**: un cobro = un claim) | UNIQUE `club_claims_org_codigo_unique` on `(organizacion_id, codigo)` | CHECK `monto_snapshot >= 0` | CHECK `puntos_calculados >= 0` | CHECK `estado IN ('pending','claimed','expired','void')` |

**Indexes:** `idx_club_claims_org_cliente` on `(organizacion_id, cliente_id)` | `idx_club_claims_org_estado` on `(organizacion_id, estado)` |

**RLS:** policies `_select` + `_insert` (no UPDATE/DELETE por policy — la acreditación va por RPC SECDEF). GRANTs SELECT + INSERT a `anon, authenticated`.

**Notes:** `cliente_id` nació NOT NULL y se **relajó a nullable** en `20261102120000` — el claim se emite al cobrar aunque el POS no sepa quién es el cliente; el dueño se resuelve al acreditar. `monto_snapshot`/`puntos_calculados` congelan el cálculo al momento del cobro (cambiar la config no reescribe claims viejos).

### club_puntos_movimientos

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| cliente_id | uuid | ✗ | - |
| delta | int4 | ✗ | - |
| tipo | text | ✗ | - |
| claim_id | uuid | ✓ | - |
| motivo | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | cliente_id → `clientes.id` (CASCADE) | claim_id → `club_claims.id` (ON DELETE SET NULL) |

**Constraints:** CHECK `tipo IN ('credito_compra','ajuste','canje','reverso')` |

**Indexes:** `idx_club_puntos_mov_org_cliente` on `(organizacion_id, cliente_id, created_at DESC)` |

**RLS:** solo policy `_select`; GRANT **SELECT** a `anon, authenticated` — es un libro mayor, se escribe únicamente desde las RPCs. El saldo de puntos de un cliente = `SUM(delta)`; no hay columna de saldo.

### RPCs del Club

- **`ensure_club_claim(p_organizacion_id uuid, p_cliente_id uuid DEFAULT NULL, p_ingreso_id uuid DEFAULT NULL) → club_claims`** (SECDEF; firma final de `20261102120000`) — crea (o devuelve, idempotente por `ingreso_id`) el claim de un cobro. Gates: `organizaciones.usa_club_fidelizacion = true` (error `club_org_inactiva`); ingreso `tipo='ingreso'` con `pos_device_id` no nulo y **`pos_status='completed'`**; debe traer payload POS (`pos_transaction_json` o `pos_response_json` no nulo → error `ingreso_sin_payload_pos`); permite llamador `service_role`. Cliente opcional (cae a `atenciones.cliente_id`). Código `VP-` + 4 chars, 8 reintentos.
- **`acreditar_club_claim_por_codigo(p_organizacion_id uuid, p_codigo text, p_cliente_id uuid) → jsonb`** — valida `^VP-[A-Z0-9]{4}$`, `SELECT … FOR UPDATE`, deja el claim `claimed` + `claimed_at`, **reasigna `cliente_id`** al que reclama, e inserta el `club_puntos_movimientos` (`tipo='credito_compra'`). Devuelve `{status: ok | not_found | already_claimed}`. GRANT a `anon, authenticated, service_role`.
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

## RPCs de listado y filtros de `/clientes`

| RPC | Firma | Notas |
|---|---|---|
| `get_cliente_estado_funnel_batch` | `(p_cliente_ids uuid[], p_organizacion_id uuid) → TABLE(cliente_id, estado_id, estado_nombre, estado_color, funnel_id, funnel_nombre, fecha_ultimo_cambio)` | migs `20260505233608` y `20260513130000` (re-aplicación byte-idéntica). `DISTINCT ON (cliente_id) ORDER BY fecha_ultimo_cambio DESC NULLS LAST` — misma semántica que la columna denormalizada `clientes.estado_funnel_actual_id`. sql STABLE, SECURITY INVOKER |
| `get_clientes_ticket_base` | `(p_org_id uuid) → TABLE(cliente_id, total numeric, n_atenciones bigint, ticket numeric)` | mig `20260624214628`. Base del filtro por ticket promedio |
| `get_ticket_stats` | `(p_org_id uuid) → TABLE(promedio numeric, p_min numeric, p_max numeric, n_clientes bigint)` | p5/p95 vía `percentile_cont` — alimenta los extremos del slider |
| `get_clientes_por_ticket` | `(p_org_id uuid, p_min numeric DEFAULT NULL, p_max numeric DEFAULT NULL) → TABLE(cliente_id uuid)` | |
| `get_clientes_barra_or` | `(p_org_id uuid, p_estado_ids uuid[] DEFAULT '{}', p_tag_ids uuid[] DEFAULT '{}', p_fecha_desde date DEFAULT NULL, p_fecha_hasta date DEFAULT NULL, p_fecha_modo text DEFAULT 'cualquiera', p_servicio_ids uuid[] DEFAULT '{}', p_producto_ids uuid[] DEFAULT '{}', p_tz text DEFAULT 'America/Santiago', p_ticket_min numeric DEFAULT NULL, p_ticket_max numeric DEFAULT NULL) → TABLE(cliente_id uuid)` | **11 params**. `20260624214628` hizo DROP+CREATE agregando `p_ticket_min`/`p_ticket_max` al final (cambio de firma → callers viejos de 9 args fallan). `p_fecha_modo ∈ cualquiera \| ultima \| primera` (la rama `primera` viene de `20260803130000`). Raise `'p_org_id es requerido'` (22023) |

Todas SECURITY DEFINER, `SET search_path = public`, granted a `anon, authenticated, service_role`. La versión previa de 9 params de `get_clientes_barra_or` viene de `20260624210738`.

**Tagueador por teléfono (API externa de etiquetado):** familia de RPCs que matchean teléfonos contra `contactos` usando el mismo predicado `regexp_replace(contacto_numero, '\D', '', 'g')` (digit-keys, no formato) — `20260506194500` (versión inicial) → `20260513130200` (alineación del predicado) → `20260514120000` (variantes WhatsApp/cliente) → `20260514130000` (filtro `since`) → `20260727120000` (`tagueador_match_phones_by_keys`, la única que devuelve el match **por índice** de teléfono de entrada, para reportar cuáles no se encontraron; cap 20.000 teléfonos, SECURITY INVOKER + filtro por org).

