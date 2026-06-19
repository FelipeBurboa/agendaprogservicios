# Campaigns & Surveys

> 10 tables in this domain

### campanas

| Column | Type | Null | Default |
|--------|------|------|---------|
| intervalo_dias | int4 | ✓ | - |
| proxima_ejecucion | timestamptz | ✓ | - |
| ultima_ejecucion | timestamptz | ✓ | - |
| variables_guardadas | jsonb | ✓ | - |
| ejecuciones_completadas | int4 | ✓ | 0 |
| max_ejecuciones | int4 | ✓ | - |
| descripcion | text | ✗ | - |
| nombre | text | ✗ | - |
| id | int8 | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| activo | bool | ✗ | true |
| created_by | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| canal | text | ✗ | `whatsapp`::text |
| whatsapp_plantillas_meta_id | uuid | ✓ | - |
| email_template_id | uuid | ✓ | - |
| es_programada | bool | ✓ | false |
| fecha_inicio | timestamptz | ✓ | - |
| last_calculated_reach | int4 | ✓ | - |
| fecha_atencion_desde | timestamptz | ✓ | - |
| fecha_atencion_hasta | timestamptz | ✓ | - |

**FK →** whatsapp_plantillas_meta_id → `whatsapp_plantillas_meta.id` | email_template_id → `email_templates.id` (ON DELETE SET NULL) | organizacion_id → `organizaciones.id` | created_by → `usuarios.id` |

**Constraints:** CHECK `canal IN ('whatsapp', 'email')` |

**Indexes:** `idx_campanas_canal` on canal |

**Notes:**
- `canal` discriminates WhatsApp campaigns (the original channel) from Email campaigns. Only one template FK is populated at a time: when `canal='whatsapp'`, `whatsapp_plantillas_meta_id` is set and `email_template_id` is null; when `canal='email'`, `email_template_id` is set and `whatsapp_plantillas_meta_id` is null.
- `variables_guardadas` is polymorphic by channel: for WhatsApp it holds the `{header,body} × {manual,automatic}` shape used by `CampanaVariablesModal`. For Email it holds a flat `{ variable_sources, manualVars }` shape matching `SendEmailModalOrg`'s per-recipient mapping — see `EmailCampanaVariablesModal`.
- Email campaigns route through `prepare-campana-send` + `send-campana-batch` edge functions, which detect the channel via this column and branch their internal logic. Email batch eventually delegates to the `send-email` edge function's batch path.
- `last_calculated_reach` is updated by `prepare-campana-send` with the count of eligible clientes resolved at prepare time.
- **`fecha_atencion_desde` / `fecha_atencion_hasta` / `tipo_filtro_atencion` are DEPRECATED post-targeting-v3.** Reads moved to `campanas_criterios` (categoria='fecha_atencion') as of migration `20260520120000_campanas_criterios_v3.sql`. Columns remain populated by backfill but new writes go through `replace_campana_criterios` RPC. A future migration will drop them.

### campanas_duplicate

| Column | Type | Null | Default |
|--------|------|------|---------|
| activo | bool | ✗ | true |
| whatsapp_plantillas_meta_id | uuid | ✓ | - |
| descripcion | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| nombre | text | ✗ | - |
| created_by | uuid | ✗ | - |
| id | int8 | ✗ | - |

**FK →** whatsapp_plantillas_meta_id → `whatsapp_plantillas_meta.id` | organizacion_id → `organizaciones.id` | created_by → `usuarios.id` |

### campana_estado

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| reach | int8 | ✓ | - |
| ended_at | timestamptz | ✓ | - |
| campana_id | int8 | ✗ | - |
| started_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| id | int8 | ✗ | - |
| metadata | jsonb | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | campana_id → `campanas.id` |

### campana_envios

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | int8 | ✗ | IDENTITY |
| created_at | timestamptz | ✗ | now() |
| campana_estado_id | int8 | ✓ | - |
| campana_id | int8 | ✗ | - |
| cliente_id | uuid | ✗ | - |
| contacto_numero | text | ✗ | - |
| success | bool | ✗ | false |
| error | text | ✓ | - |
| message_id | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| status | text | ✗ | `pending`::text |
| sent_at | timestamptz | ✓ | - |

**FK →** campana_estado_id → `campana_estado.id` | campana_id → `campanas.id` | organizacion_id → `organizaciones.id` |

**Constraints:** CHECK(`status IN ('pending','sending','sent','failed')`) | UNIQUE(`idx_campana_envios_unique_client`) on campana_id, cliente_id, campana_estado_id |

**Indexes:**
- `idx_campana_envios_estado_status` — composite on `(campana_estado_id, status)`. Added in `20260414130000_campana_delivery_aggregates.sql` to make the FILTER aggregates inside `campana_delivery_counts` index-scan. Use this shape when filtering envios of one execution by status.
- `idx_campana_envios_estado_created` — composite on `(campana_estado_id, created_at)`. Supports the paginated `ORDER BY created_at ASC` scan used by `CampanaDeliveryDisplay` when paging through an execution's envios.

**Notes:**
- `contacto_numero` is **polymorphic by parent campaign channel**. For `campanas.canal='whatsapp'` rows it carries the recipient's phone number; for `canal='email'` rows it carries the recipient's email address. The column stays `text` — no schema split — so existing reporting queries keep working. `prepare-campana-send` decides which value to insert based on the campaign's channel.
- `message_id` semantics also differ per channel. WhatsApp rows store the Resend-for-WhatsApp provider message id per send. Email rows store the `batch_id` of the send-email batch call (every row inside a single `send-campana-batch` invocation shares the same `batch_id`, since send-email processes all recipients in one fire-and-forget request). Reconcile delivery/bounce/open via `email_logs.template_data->>batch_id = campana_envios.message_id AND email_logs.to_email = campana_envios.contacto_numero`.
- `status='sent'` means "handed off to provider successfully". For email, per-recipient delivery / bounce / open tracking lives in `email_logs` + `email_events`, backfilled by `resend-webhook`.
- `campana_estado.metadata` carries channel-specific template + variable info. For WhatsApp: `{ canal, variables, templateName, templateLanguage, templateComponents }`. For email: `{ canal: 'email', variables: { variable_sources, manualVars }, emailTemplateId, subject, html, plain, emailTemplateType, ... }`.

### campanas_criterios

> ⭐ Targeting v3 — replaces `campanas_targets` + `campanas.fecha_atencion_*` legacy model

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | int8 | ✗ | IDENTITY |
| id_campana | int8 | ✗ | - |
| tipo | text | ✗ | - |
| posicion | int4 | ✗ | - |
| categoria | text | ✗ | - |
| valor_id | uuid | ✓ | - |
| valor_jsonb | jsonb | ✓ | - |
| operador_siguiente | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** id_campana → `campanas.id` (ON DELETE CASCADE) |

**Constraints:**
- CHECK `tipo IN ('enviar','sacar')` — section discriminator: `enviar` = include in audience, `sacar` = exclude.
- CHECK `posicion >= 0` — 0-based ordering within section.
- CHECK `categoria IN ('tag','funnel','fecha_atencion','sucursal','servicio_realizado')` — extensible: add new categories by altering CHECK + frontend/edge resolution logic. `'sucursal'` added in `20260614120000_campanas_criterio_sucursal.sql`; `'servicio_realizado'` added in `20260622120000_campanas_criterio_servicio.sql`.
- CHECK `operador_siguiente IN ('Y','O')` — connects criterio to position+1. NULL only on last criterio of each section.
- CHECK `campanas_criterios_valor_check`: `(categoria IN ('tag','funnel','sucursal') AND valor_id NOT NULL AND valor_jsonb NULL) OR (categoria IN ('fecha_atencion','servicio_realizado') AND valor_id NULL AND valor_jsonb NOT NULL)`. `sucursal` joined the referential-id branch alongside tag/funnel; `servicio_realizado` joined the jsonb branch alongside fecha_atencion (`20260622120000`).
- UNIQUE `(id_campana, tipo, posicion)` — prevents duplicate ordering.

**Indexes:**
- `idx_campanas_criterios_campana_tipo_pos` on `(id_campana, tipo, posicion)` — primary lookup pattern (read all criterios of one campana ordered).
- `idx_campanas_criterios_valor_id` on `valor_id` (partial WHERE NOT NULL) — inverse lookup "which campañas use this tag/estado".

**RLS:** None. Coherent with parent `campanas` (no RLS) and `clientes`/`contactos` patterns. Cross-org defense lives in:
1. App layer filtering via `id_campana` resolved from auth context.
2. RPC `replace_campana_criterios` validates `p_organizacion = campanas.organizacion_id` before touching rows.
3. `useCampanaTargetPreview.resolverCriterio` adds an `inner join cliente_tags` on `organizacion_id` for tag criterios (defends against orphan tag_ids from another org).

**Notes:**
- **Dynamic targeting model**: replaces the old fixed-3-filters (tags + estados + fecha_atencion combined with forced OR) with N criteria connected by user-modifiable `Y`/`O` operators evaluated **left-to-right** (no parens, no precedence). Each operator acts on the accumulated set: `Y` = intersection, `O` = union.
- **Two sections per campaña**: `enviar` (include — must have ≥1 criterio) and `sacar` (exclude — optional). Final audience = `enviar set MINUS sacar set`.
- **`valor_jsonb` shape for `categoria='fecha_atencion'`**: `{desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD', modo: 'cualquiera'|'ultima', sucursal_id?: uuid | null}`. **Critical**: dates must be `YYYY-MM-DD` strings, NOT ISO timestamps with timezone — the `<Input type="date">` builder breaks if values are `2026-01-01T00:00:00+00:00`. The migration backfill casts `campanas.fecha_atencion_*` (timestamptz) to `::date` before serializing. Defense `criteriosBdToInput.normalizarFechaJsonb` truncates to first 10 chars at read time as belt-and-suspenders. The optional `sucursal_id` was added in `20260614120000_campanas_criterio_sucursal.sql`: when set, the fecha filter is restricted to atenciones in that sucursal (resolution via `COALESCE(citas.sucursal_id, profesionales.sucursal_id)`). When null/undefined, considers all sucursales (retrocompat with pre-feature campañas).
- **Category `'sucursal'`** (added `20260614120000_campanas_criterio_sucursal.sql`): independent criterio that resolves to clientes with ≥1 atención efectiva in the specified sucursal (historic resolution via `COALESCE(citas.sucursal_id, profesionales.sucursal_id)`, aligned with `get_ingresos_con_datos_v2`). `valor_id` points to `sucursales.id` (no FK constraint — same polymorphic pattern as `tag`/`funnel`). Frontend hides the option entirely when the org has zero `sucursales` rows.
- **Category `'servicio_realizado'`** (added `20260622120000_campanas_criterio_servicio.sql`): resolves to clientes who got a specific servicio done **in the same atención** — NOT the misleading cartesian "any atención in range" × "ever did the servicio". `valor_jsonb` shape: `{servicio_id: uuid, desde?: 'YYYY-MM-DD', hasta?: 'YYYY-MM-DD', sucursal_id?: uuid}` — fecha and sucursal are OPTIONAL filters layered on the atención that is already forced to contain the servicio (via `INNER JOIN consumos`). Three cases with one category: no date = "ever did X"; with date = "did X between Y and Z" (main case); with date + sucursal = "did X at sucursal Q between Y and Z". Resolved by the `get_clientes_por_servicio` RPC (below). Like `fecha_atencion`, it stores everything in `valor_jsonb` (no `valor_id`), so it is NOT a polymorphic embed in `useCampanaTargets`.
- **`operador_siguiente` semantics**: NULL on last criterio (no successor). Non-last with NULL is treated as `O` defensively but indicates inconsistent state (logged warning).
- **Order matters**: `A Y B O C` ≠ `C O A Y B`. Reorder via UI drag/drop persists new `posicion` values.
- **Backfill behavior** (migration `20260520120000_campanas_criterios_v3.sql`): for each existing campaña without criterios, converts `campanas_targets` rows + `campanas.fecha_atencion_*` to N criterios in section `enviar` connected by `O` (preserves the legacy OR semantics). Idempotent via `WHERE NOT EXISTS`.
- **All write paths flow through the `replace_campana_criterios` RPC** (atomic delete+insert). No direct INSERT/UPDATE from the frontend or edge functions.
- **Orphan handling**: `valor_id` has no FK to `cliente_tags` / `estados_funnel` / `sucursales` (polymorphic). If the referenced row is deleted, the criterio becomes orphan — the builder marks it with a red chip + AlertTriangle, and `CampanaFormModal` blocks submit pre-save. Orphans of `sucursal_id` embedded in fecha_atencion's `valor_jsonb` are also validated.
- Canonical readers: `useCampanaDetail` (full criteria for form), `useCampanaTargets` (legacy-shape adapter for `CampanaDetailTabs`, traverses tag/funnel/sucursal via polymorphic embed `cliente_tags!valor_id` / `estados_funnel!valor_id` / `sucursales!valor_id`), `useCampanas` / `useCampanasFiltrados` (counts only, batched), `useCampanaTargetPreview` (resolves to client_ids), `prepare-campana-send`, `send-campana-whatsapp/targeting-service`.

### campanas_targets

> ⚠️ **DEPRECATED** as of targeting-v3 (`20260520120000_campanas_criterios_v3.sql`). No code reads or writes this table anymore. Backfill copied data into `campanas_criterios`. Rows remain for rollback safety. A future migration will drop the table.

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| id_estado | uuid | ✓ | - |
| id_campana | int8 | ✗ | - |
| id | int8 | ✗ | - |
| id_tag | uuid | ✓ | - |

**FK →** id_campana → `campanas.id` (ON DELETE CASCADE) | id_estado → `estados_funnel.id` (ON DELETE SET NULL) | id_tag → `cliente_tags.id` (ON DELETE SET NULL) |

### RPCs

#### `campana_delivery_counts(p_execution_id bigint, p_organizacion_id uuid, p_canal text default 'whatsapp') → jsonb`

Single-round-trip aggregate query for the campaign Delivery tab. Returns:

```jsonc
{
  "envios": { "total": n, "sent": n, "failed": n, "pending": n, "sending": n },
  "email":  { "delivered": n, "opened": n, "clicked": n, "bounced": n, "complained": n }
  // "email" is populated only when p_canal='email'; otherwise it's {}
}
```

- `STABLE` plpgsql, respects RLS (not `SECURITY DEFINER`).
- One scan of `campana_envios` via FILTER aggregates for the envio counts, plus (for email) a second scan of `email_logs` joined by `ANY(batch_ids)` collected from `campana_envios.message_id` where `message_id IS NOT NULL`.
- Replaces N client-side count queries. Use this RPC instead of issuing one `.select('*',{count:'exact',head:true})` per status. Canonical caller: `src/components/campanas/detail/CampanaDeliveryDisplay.tsx`.
- Added in `20260414130000_campana_delivery_aggregates.sql` alongside the supporting indexes on `campana_envios` and `email_logs`.
- Granted to `authenticated, anon`.

#### `mark_bounced_envios_as_failed(p_execution_id bigint) → integer`

Bulk-flags pending `campana_envios` rows of one campaign execution (`campana_estado_id = p_execution_id`) as `status='failed'` when the recipient cannot be mailed. Returns count of rows flipped.

A row is marked failed when ANY of:
- joined `clientes.bounced = true`
- `contacto_numero IS NULL` or blank
- `contacto_numero` differs from the current `clientes.email` (stale email snapshot taken at send-queue time)
- `cliente_id` points to a now-missing cliente (orphan)

**Signature history:** first shipped as `(uuid)` in `20260419000000_mark_bounced_envios_rpc.sql` but was replaced by the `bigint` overload in `20260419010000_mark_bounced_envios_fix_bigint.sql` (matching `campana_estado.id` / `campana_envios.campana_estado_id`). The uuid variant is dropped — always use `bigint`. Subsequent migrations `20260419020000`/`20260419030000` extended the WHERE clause to also cover stale and orphan rows.

SECURITY DEFINER. Typical caller: the email-resend UI's "mark failed" bulk action before retrying a campaign execution.

#### `get_clientes_por_atencion(p_org_id uuid, p_desde date, p_hasta date, p_modo text default 'cualquiera', p_tz text default 'America/Santiago', p_sucursal_id uuid default null) → table(cliente_id uuid)`

Resolves cliente_ids for campaign criteria of `categoria='fecha_atencion'`. Two evaluation modes via `p_modo`:
- `'cualquiera'`: clientes with ≥1 effective atención in `[p_desde, p_hasta]`.
- `'ultima'`: clientes whose **most recent** effective atención falls in `[p_desde, p_hasta]` (= "they haven't returned since"). Useful for win-back campaigns.

The optional `p_sucursal_id` was added in `20260614120000_campanas_criterio_sucursal.sql`:
- When `NULL` (default): no sucursal filter — considers all sucursales (retrocompat with pre-feature campañas).
- When set: restricts the search to atenciones in that sucursal, resolved via `COALESCE(citas.sucursal_id, profesionales.sucursal_id)` to honor the historic sucursal of the visit (aligned with `get_ingresos_con_datos_v2`). For mode `'ultima'`, the "last visit" is computed per `(cliente, sucursal)` — not the global last — so a cliente whose global last was elsewhere but their last visit to sucursal X falls in range is still included.

Only effective atenciones are counted (`estado IN ('finalizada', 'en_curso', 'reabierto')` — cancelled atenciones never contribute). `(fecha_inicio AT TIME ZONE p_tz)::date` is used for the date comparison to respect Chile timezone (DST-aware).

Validates `p_org_id`, `p_desde`, `p_hasta` are NOT NULL and `p_modo IN ('cualquiera','ultima')` with explicit RAISE EXCEPTION (ERRCODE 22023). Fails loud instead of silent.

`SECURITY DEFINER` (filters explicitly by `organizacion_id` as the barrier instead of relying on RLS). `STABLE`. `SET search_path = public`. Granted to `authenticated`, `anon`, `service_role`.

Canonical callers: `useCampanaTargetPreview` (frontend preview), `prepare-campana-send/index.ts` (Phase 1 of manual send), `send-campana-whatsapp/targeting-service.ts` (legacy path for scheduled WhatsApp campaigns).

#### `get_clientes_por_sucursal(p_org_id uuid, p_sucursal_id uuid) → table(cliente_id uuid)`

Added in `20260614120000_campanas_criterio_sucursal.sql`. Resolves cliente_ids for criteria of `categoria='sucursal'` — independent sucursal criterio, no date filter. Returns all clientes with ≥1 effective atención in the given sucursal (resolved via `COALESCE(citas.sucursal_id, profesionales.sucursal_id)`, same historic-resolution pattern).

Only effective atenciones count. Validates both parameters NOT NULL with explicit `RAISE EXCEPTION` (ERRCODE 22023).

`SECURITY DEFINER`, `STABLE`, `SET search_path = public`. Granted to `authenticated`, `anon`, `service_role`.

Canonical callers: `useCampanaTargetPreview.resolverCriterio` (branch for `categoria==='sucursal'`), `prepare-campana-send/index.ts`, `send-campana-whatsapp/targeting-service.ts`. All three callers paginate via `.range(from, to)` to bypass PostgREST's `max_rows=1000` cap.

#### `get_clientes_por_servicio(p_org_id uuid, p_servicio_id uuid, p_desde date default null, p_hasta date default null, p_tz text default 'America/Santiago', p_sucursal_id uuid default null) → table(cliente_id uuid)`

Added in `20260622120000_campanas_criterio_servicio.sql`. Resolves cliente_ids for criteria of `categoria='servicio_realizado'`. A cliente enters iff they have ≥1 effective atención **where, in that same atención, the servicio was done** — enforced by `INNER JOIN consumos ON consumos.atencion_id = a.id` filtered to `cons.servicio_id = p_servicio_id`. This INNER JOIN is the whole point: it prevents the misleading cartesian product where a cliente who came for a *different* servicio in the range AND once-upon-a-time did the target servicio would falsely qualify.

Optional filters, both layered on that **same** atención row:
- **Fecha** (`p_desde`/`p_hasta`): must come **both or neither** — a single side is ambiguous and raises `22023`. Also validates `p_desde <= p_hasta`. When both NULL → "did the servicio at any time".
- **Sucursal** (`p_sucursal_id`): when set, restricts to atenciones in that sucursal via `COALESCE(citas.sucursal_id, profesionales.sucursal_id)` (historic resolution, same pattern as `get_clientes_por_atencion` / `get_clientes_por_sucursal`). When NULL → any sucursal.

Only effective atenciones count (`estado IN ('finalizada','en_curso','reabierto')` — cancelled never contribute). `(fecha_inicio AT TIME ZONE p_tz)::date` for TZ-correct day boundaries (Chile, DST-aware). `DISTINCT cliente_id` because `consumos` can multiply rows (a cliente with several qualifying atenciones).

`p_org_id` + `p_servicio_id` are mandatory (explicit `RAISE EXCEPTION` 22023 if NULL). `SECURITY DEFINER` (filters explicitly by `organizacion_id` as the barrier instead of relying on RLS). `STABLE`. `SET search_path = public`. Granted to `authenticated`, `anon`, `service_role`. The migration ends with `NOTIFY pgrst, 'reload schema'` so PostgREST publishes the RPC immediately.

Canonical callers: `useCampanaTargetPreview.resolverCriterio` (branch for `categoria==='servicio_realizado'`), `prepare-campana-send/index.ts`, `send-campana-whatsapp/targeting-service.ts`.

#### `replace_campana_criterios(p_id_campana bigint, p_organizacion uuid, p_criterios jsonb) → void`

Atomic synchronization of all criterios v3 of a campaña: `DELETE` all existing rows for the campaña, then `INSERT` the supplied array — all wrapped in a single plpgsql transaction. If any step fails (CHECK violation, UNIQUE collision, connection drop), the delete is rolled back automatically.

**Why it exists**: the original frontend pattern was `delete()` + `insert()` as separate Supabase requests. If the insert failed mid-flight, the delete was already committed and the campaign silently ended up with **zero criterios** — meaning the next send resolved 0 destinatarios with no error visible to the user. This RPC eliminates that window.

**Input shape** (`p_criterios` jsonb array, each element):
```jsonc
{
  "tipo": "enviar" | "sacar",
  "posicion": 0,                                                // int, 0-based within section
  "categoria": "tag" | "funnel" | "fecha_atencion" | "sucursal" | "servicio_realizado",
  "valor_id": "uuid-string" | null,                             // for tag/funnel/sucursal
  "valor_jsonb": {desde,hasta,modo,sucursal_id?}                // fecha_atencion (YYYY-MM-DD strings!)
              | {servicio_id,desde?,hasta?,sucursal_id?}        // servicio_realizado
              | null,
  "operador_siguiente": "Y" | "O" | null                        // null only on last of each section
}
```

**Errors raised** (uses `RAISE EXCEPTION` with explicit `ERRCODE`):
- `'campana_no_encontrada'` (P0002) — `p_id_campana` does not exist in `campanas`.
- `'campana_no_pertenece_a_organizacion'` (42501) — `p_organizacion <> campanas.organizacion_id` (cross-org guard, since the project does not use Supabase native auth and RLS would otherwise be bypassed by anon key).
- `'criterios_invalidos'` (22023) — `p_criterios` is not a jsonb array (NULL or wrong type).
- Any CHECK constraint violation on `campanas_criterios` propagates as the standard Postgres error.

**Behavior detail**:
- Empty `p_criterios` array is **valid** — semantically means "clear all criterios for this campaña". The DELETE runs and no INSERTs follow. Useful for resetting a draft.
- `valor_jsonb` is preserved as-is — the RPC does not normalize date formats. Callers must send `YYYY-MM-DD` strings (the migration backfill casts `::date` before insert; the frontend's `<Input type="date">` produces this format natively).
- `operador_siguiente` is preserved as-is. Frontend `normalizarCriterios` ensures only the last criterio of each section has NULL (others get `O` as default).

**Permissions**: SECURITY INVOKER. `GRANT EXECUTE` to `authenticated`, `anon`, `service_role`. The internal `p_organizacion` validation provides cross-org defense in lieu of RLS — but in this project's custom-auth setup the validation only catches frontend-vs-frontend bugs (a malicious anon-key holder can pass any `p_organizacion` matching the campaña's actual org). Defense in depth lives in app-layer filtering, not in this RPC.

**Canonical caller**: `syncCriteriosV3` helper in `src/hooks/useCampanas.ts`, invoked after every campaña create/update mutation. Edge functions never call this RPC — they only read `campanas_criterios`.

Added in migration `20260520120000_campanas_criterios_v3.sql` alongside the table itself. `NOTIFY pgrst, 'reload schema'` is issued at the end of the migration so PostgREST publishes the new RPC immediately.

### respuestas

> ⚠️ Table not found in schema dump
### respuesta_estadisticas

> ⚠️ Table not found in schema dump
### typeform

| Column | Type | Null | Default |
|--------|------|------|---------|
| status | text | ✗ | `draft`::text |
| last_synced_at | timestamp | ✓ | - |
| updated_at | timestamp | ✗ | now() |
| created_at | timestamp | ✗ | now() |
| published_at | timestamp | ✓ | - |
| response_count | int4 | ✗ | 0 |
| hidden | jsonb | ✓ | - |
| variables | jsonb | ✓ | - |
| thankyou_screens | jsonb | ✓ | - |
| welcome_screens | jsonb | ✓ | - |
| logic | jsonb | ✓ | - |
| fields | jsonb | ✓ | - |
| settings | jsonb | ✓ | - |
| usuario_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| type | text | ✓ | `quiz`::text |
| description | text | ✓ | - |
| title | text | ✗ | - |
| typeform_id | text | ✗ | - |

**FK →** usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`typeform_typeform_id_key`) on typeform_id |

### typeform_response

| Column | Type | Null | Default |
|--------|------|------|---------|
| submitted_at | timestamp | ✗ | - |
| typeform_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| variables | jsonb | ✓ | - |
| created_at | timestamp | ✗ | now() |
| calculated | jsonb | ✓ | - |
| metadata | jsonb | ✓ | - |
| response_id | text | ✗ | - |
| hidden | jsonb | ✓ | - |
| answers | jsonb | ✗ | - |

**FK →** typeform_id → `typeform.id` |

**Constraints:** UNIQUE(`typeform_response_response_id_key`) on response_id |

