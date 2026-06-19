# Services & Professionals

> 20 tables in this domain

### servicios

| Column | Type | Null | Default |
|--------|------|------|---------|
| precio | numeric | ✗ | - |
| duracion_minutos | int4 | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| nombre | text | ✗ | - |
| duracion_paciente | int4 | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| updated_at | timestamptz | ✗ | now() |
| activo | bool | ✗ | true |
| foto_url | text | ✓ | - |
| descripcion | text | ✗ | - |
| stock | jsonb | ✓ | - |
| private | bool | ✓ | false |
| nombre_unaccented | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| abono | int4 | ✓ | 0 |
| tipo | text | ✗ | `individual`::text |
| pack_config | jsonb | ✓ | - |
| comision_default | jsonb | ✓ | - |
| orden | int4 | ✓ | - |
| categoria_id | uuid | ✓ | - |
| ventana_minutos | int4 | ✗ | 0 |
| usar_precio_por_sucursal | bool | ✗ | false |

**FK →** organizacion_id → `organizaciones.id` | categoria_id → `servicio_categorias.id` (ON DELETE SET NULL) |

**Constraints:** CHECK(`tipo IN ('individual','pack')`) | CHECK(`ventana_minutos >= 0`) via `servicios_ventana_minutos_check` |

**Notes:**
- `tipo='pack'` bundles multiple services; `pack_config` jsonb holds the bundle shape (services, counts). Companion columns on `citas`: `pack_grupo_id`, `pack_servicio_id`.
- `comision_default` (migration `20260421120000_add_comision_default_to_servicios.sql`) stores the last commission value applied from the servicio-side "Comisión" tab. Shape: `{ tipo: 'porcentaje' | 'monto_fijo', valor: number, ultima_actualizacion: ISO timestamp }`. **UI-only** pre-fill for the form — does NOT participate in commission calculation for atenciones. Authoritative commission rules still live on `profesionales.comisiones_json.excepciones` (per-profesional) and `profesionales.comisiones_json.general` (fallback).
- `orden` (migration `20260428120000_add_orden_to_servicios_and_tags.sql`) — optional public-landing display rank. Sorted `ASC NULLS LAST` only when `organizaciones.landing_config.sections.services.config.orderServicios = true`. NULL = unranked, sorts last. Reordering UI in `/servicios` table (drag handle + up/down chevrons + "Quitar orden" — `OrdenColumnRenderer`). Sequential renumber 1..K on every move; unranked rows stay NULL. Partial index `idx_servicios_orden_org` on `(organizacion_id, orden) WHERE orden IS NOT NULL`. Internal CRM rendering ignores this field.
- `categoria_id` (migration `20260518120000_add_servicio_categorias.sql`) — single FK to `servicio_categorias.id`. NULL ⇒ "Sin categoría" bucket on the public landing accordion. `ON DELETE SET NULL`: deleting a categoría preserves the servicios but clears their FK. **Public-landing only consumer** in v1, gated by `organizaciones.landing_config.sections.services.config.useCategorias`. The CRM admin views (`/servicios` table cell quick-select, servicio detail form picker) write through this column directly via `useServicios.updateServicio`. Partial index `idx_servicios_categoria_id` on `(categoria_id) WHERE categoria_id IS NOT NULL`.
- Per-servicio cupo (concurrent-booking cap) lives on the `profesional_servicio` join table as `profesional_servicio.cupos`, NOT here. Migration `20260423154735_servicios_cupos.sql` briefly added `servicios.cupos` as a global cap; migration `20260424002919_cupos_per_asignacion.sql` moved it to the join table for per-profesional granularity and dropped the servicios column. See the `profesional_servicio` / `servicio_profesional` entry in this file for details.
- `ventana_minutos` (migrations `20260604120000_add_ventana_minutos_to_servicios.sql` + `20260605120000_proxima_hora_batch_ventana.sql`) — post-cita buffer in minutes. When a cita that includes this servicio ends at T, the profesional cannot accept ANY cita during `[T, T + ventana_minutos)`. Applies to Layer 1 only (profesional bloque) — Layer 2 (per-servicio cupo) is untouched. `cita.hora_fin` is NEVER modified; the ventana is phantom occupation visible only to `obtener_slots_con_incremento_v2`, `validar_capacidad_cita`, and `obtener_proxima_hora_por_servicio_batch`. Calendar render, atencion duration, billing, and outbound confirmations all read the real `hora_fin`. **Pack exception**: inside the same `pack_grupo_id` (same day), ventana on a non-last item is suppressed — a sibling EXISTS guard checks for `c_sib.hora_inicio >= c.hora_fin`; only the LAST pack item's ventana fires. **Pack-level ventana = silent no-op**: `cita.servicios[].id` stores SUB-servicio UUIDs, never the parent pack's, so the lookup never matches. The frontend (`ServicioInformacionInlineEdit`) hides the input when `tipo='pack'` and forces 0 on save. Midnight wrap clamped via `least(..., time '23:59:59')`. Default 0 → existing behavior byte-equivalent.
- `usar_precio_por_sucursal` (migration `20260707120001_add_precio_por_sucursal_servicios.sql`) — opt-in flag for per-sucursal pricing. `false` (default) → effective price is always `servicios.precio` (global, byte-equivalent to legacy). `true` → effective price resolved from `servicio_precios_sucursal` for the given sucursal, with **fallback to `servicios.precio`** when no row exists or `sucursal_id IS NULL`. **V1 scope: `tipo='individual'` only** — packs ignore the flag (UI forces false; `cita.servicios[].id` stores sub-servicio UUIDs, never the pack's). The ONLY source of truth for "what does this servicio cost at this sucursal" are the resolver RPCs `resolver_precio_servicio` / `resolver_precios_servicios` (below) — frontend display, cobro, edge functions, and MCP tools must all resolve through them so displayed price == charged price.

### servicio_precios_sucursal

> Migración `20260707120001_add_precio_por_sucursal_servicios.sql`. Precio de un servicio en una sucursal específica. Solo se consulta cuando `servicios.usar_precio_por_sucursal = true`; sin fila para esa sucursal → fallback a `servicios.precio`. Estructura espejo de `servicio_categorias`; postura de seguridad espejo de `stock_por_ubicacion` (**sin RLS, grants-only**).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| servicio_id | uuid | ✗ | - |
| sucursal_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| precio | numeric | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** servicio_id → `servicios.id` (CASCADE) | sucursal_id → `sucursales.id` (CASCADE) | organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** UNIQUE(`servicio_precios_sucursal_unique`) on `(servicio_id, sucursal_id)` | CHECK(`servicio_precios_sucursal_precio_check`) `precio >= 0` |

**Indexes:** `idx_servicio_precios_sucursal_sucursal` on `(sucursal_id)` | `idx_servicio_precios_sucursal_org` on `(organizacion_id)`. NO index on `servicio_id` solo — el UNIQUE `(servicio_id, sucursal_id)` ya cubre lookups por prefijo izquierdo.

**Triggers:** `update_servicio_precios_sucursal_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**Security:** **NO RLS** (deliberado — postura del proyecto: app-layer security, igual que `stock_por_ubicacion`). GRANTs CRUD a `anon, authenticated, service_role` (sin ellos el rol `anon` da 42501).

**Notes:** `precio numeric` sin escala para igualar `servicios.precio` (ver `20260330000003_widen_precio_column.sql`).

#### Resolver RPCs (única fuente de verdad del precio efectivo)

- **`resolver_precio_servicio(p_servicio_id uuid, p_sucursal_id uuid) → numeric`** — SQL, STABLE, SECURITY DEFINER, `search_path = public`. Lógica: si `usar_precio_por_sucursal` y `p_sucursal_id NOT NULL` → `COALESCE(precio sucursal, servicios.precio)`; si no → `servicios.precio`. Granted a `anon, authenticated, service_role`.
- **`resolver_precios_servicios(p_pairs jsonb) → TABLE(servicio_id uuid, sucursal_id uuid, precio numeric)`** — batch: array jsonb de `{ servicio_id, sucursal_id? }` (sucursal ausente/`''`/null → NULL → precio global). Delega en el resolver escalar para mantener la regla de fallback en UN solo lugar. Skipea elementos sin `servicio_id`. Mismos atributos y grants.

### profesional_servicio (aka servicio_profesional join table)

N:M join between `profesionales` and `servicios`. One row per assignment.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| profesional_id | uuid | ✗ | - |
| servicio_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| activo | bool | ✗ | true |
| cupos | int4 | ✗ | 1 |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** profesional_id → `profesionales.id` | servicio_id → `servicios.id` | organizacion_id → `organizaciones.id` |

**Constraints:** CHECK(`cupos >= 1`) via `profesional_servicio_cupos_check` |

**Notes:**
- `cupos` (migration `20260424002919_cupos_per_asignacion.sql`) — **max concurrent citas of this (profesional, servicio) assignment per time window**. Default 1 (non-parallelizable). Independent of the profesional's bloque cupo (`configuracion_json.horarios_disponibles.detalle_por_dia[day][bloque].cupos`). Enforced by `validar_capacidad_cita` + `obtener_slots_con_incremento_v2`. Each derivation on the profesional contributes 1 opaquely to this cupo check regardless of the consumo's servicio_id. Asymmetric: `consumos` insert does NOT re-validate cupos; only cita insert/update hits the trigger.
- If the requested servicio has no PS row for the profesional (or `activo=false`), the slot RPC and trigger treat it as "not offered" and hard-block with `Servicio no ofrecido por este profesional`.
### servicio_tags

| Column | Type | Null | Default |
|--------|------|------|---------|
| nombre | varchar | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| color | varchar | ✓ | `#6B7280`::character varying |
| orden | int4 | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`servicio_tags_nombre_organizacion_id_key`) on organizacion_id | UNIQUE(`servicio_tags_nombre_organizacion_id_key`) on nombre |

**Notes:**
- `orden` (migration `20260428120000_add_orden_to_servicios_and_tags.sql`) — optional public-landing tag-row display rank. Sorted `ASC NULLS LAST` only when `organizaciones.landing_config.sections.services.config.orderTags = true`. NULL = unranked, sorts last. Reordering UI inside `ServicioTagManager` ("Gestión de Tags" dialog) — drag handle + up/down chevrons + "Quitar orden". The literal "Todos" chip in `StepServicios` always sorts first regardless. Sequential renumber 1..K on every move; unranked stay NULL. Partial index `idx_servicio_tags_orden_org` on `(organizacion_id, orden) WHERE orden IS NOT NULL`.

### servicio_tag_asociaciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| servicio_id | uuid | ✗ | - |
| tag_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |

**FK →** tag_id → `servicio_tags.id` | servicio_id → `servicios.id` |

**Constraints:** UNIQUE(`servicio_tag_asociaciones_servicio_id_tag_id_key`) on servicio_id | UNIQUE(`servicio_tag_asociaciones_servicio_id_tag_id_key`) on tag_id |

### servicio_categorias

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| nombre | varchar(100) | ✗ | - |
| orden | int4 | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE(`servicio_categorias_org_nombre_unique`) on (organizacion_id, nombre) |

**Indexes:**
- `idx_servicio_categorias_org` on `(organizacion_id)`
- `idx_servicio_categorias_orden_org` partial on `(organizacion_id, orden) WHERE orden IS NOT NULL`

**RLS:** `servicio_categorias_all` — `USING (true) WITH CHECK (true)`. Mirrors the permissive pattern used by `servicios` and `servicio_tags` so the public landing (`supabasePublic` / anon) can read categorías directly without a bespoke policy. **Hardening note**: if any of these three tables tightens, harden all three together.

**Notes:**
- (Migration `20260518120000_add_servicio_categorias.sql`.) **Single-categoría** grouping layer above the existing many-to-many `servicio_tags`. `servicios.categoria_id` is the FK; there is **no** junction table (deliberate — the grouping is hierarchical, not flexible like tags).
- `nombre` + `orden` are the only payload fields. NO color, NO icon (deliberate v1 scope; matches the "Path A" decision in the implementation plan).
- `orden` follows the same `ASC NULLS LAST` semantics as `servicios.orden` and `servicio_tags.orden`. Reordering UI is the `ServicioCategoriaManager` modal (Settings menu in `/servicios` → "Categorías"), built on the same `useOrdenReorder` + `OrdenReorderProvider` plumbing as tags.
- **Public landing accordion** (`StepServicios` in the agendamiento modal): when `landing_config.sections.services.config.useCategorias = true`, servicios are bucketed by `categoria_id` and rendered inside Radix `Accordion` panels (`type="single" collapsible` — one open at a time, all closed by default). Servicios with `categoria_id IS NULL` or pointing to a deleted categoría fall into a synthetic "Sin categoría" panel rendered last.
- The canonical list of categorías for the accordion is fetched via a **dedicated** `landing-servicio-categorias` query in `useLandingData`, NOT via the embed on each servicio. Reason: PostgREST embeds via `categoria:servicio_categorias!categoria_id(...)` can null silently if the schema cache hasn't resolved the FK; a dedicated fetch is the robust source of truth. The `bucketByCat` logic in `StepServicios` rejects orphan FKs (categoria_id whose target doesn't exist in the canonical list) by re-routing them to "Sin categoría".
- **Profesionales-embedded servicios projection must include `categoria_id`** — the public scheduling step receives its `ProfesionalServicio[]` from `AccordionBookingContent.serviciosPublicosFiltrados` which builds from `profesional.servicios`, not from the org-wide `useLandingData.servicios`. Both `useLandingData.ts` (primary profesionales fetch) and `useLandingDataWithTags.ts` (legacy variant) explicitly enumerate `categoria_id` in the embedded `servicios(...)` selector, otherwise the bucket logic sees `undefined` and routes everything to "Sin categoría". Verified gotcha — fixed via two-line projection extension.
- `useServicioCategorias` hook (TanStack Query) wraps `servicioCategoriasService` (CRUD + `bulkUpdateCategoriaOrden`). Mutations invalidate `['servicios']`, `['landing-data']`, `['landing-servicios']` so the public landing picks up renames/orden changes.

### servicio_producto

| Column | Type | Null | Default |
|--------|------|------|---------|
| notas | text | ✓ | - |
| servicio_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| cantidad_requerida | int4 | ✗ | 1 |
| producto_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** servicio_id → `servicios.id` | producto_id → `productos_stock.id` |

**Constraints:** UNIQUE(`servicio_producto_unique`) on producto_id | UNIQUE(`servicio_producto_unique`) on servicio_id |

### profesionales

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| configuracion_json | jsonb | ✓ | - |
| comisiones_json | jsonb | ✓ | `{"tipo": "porcentaje", "valor": 0, "act |
| id | uuid | ✗ | gen_random_uuid() |
| sucursal_id | uuid | ✓ | - |
| nombre | text | ✗ | - |
| email | text | ✗ | - |
| telefono | text | ✗ | - |
| descripcion | text | ✓ | - |
| foto_url | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| nombre_unaccented | text | ✓ | - |
| activo | bool | ✗ | true |

**FK →** organizacion_id → `organizaciones.id` | sucursal_id → `sucursales.id` |

### usuario_profesionales

| Column | Type | Null | Default |
|--------|------|------|---------|
| profesional_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✗ | now() |

**FK →** usuario_id → `usuarios.id` | profesional_id → `profesionales.id` |

**Constraints:** UNIQUE(`usuario_profesionales_usuario_id_profesional_id_key`) on usuario_id | UNIQUE(`usuario_profesionales_usuario_id_profesional_id_key`) on profesional_id |

### categorias_profesionales

| Column | Type | Null | Default |
|--------|------|------|---------|
| color | varchar | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| activo | bool | ✓ | true |
| updated_at | timestamptz | ✓ | now() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| nombre | varchar | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`categorias_profesionales_organizacion_id_nombre_key`) on organizacion_id | UNIQUE(`categorias_profesionales_organizacion_id_nombre_key`) on nombre |

### profesional_bloqueos

| Column | Type | Null | Default |
|--------|------|------|---------|
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| created_by | uuid | ✓ | - |
| fecha_fin | timestamptz | ✗ | - |
| fecha_inicio | timestamptz | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| motivo | text | ✗ | - |
| cita_origen_id | uuid | ✓ | - |

**FK →** created_by → `usuarios.id` | organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` | cita_origen_id → `citas.id` |

### profesional_bloqueos_recurrentes

| Column | Type | Null | Default |
|--------|------|------|---------|
| hora_fin | time | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| created_by | uuid | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| dia_semana | USER-DEFINED | ✗ | - |
| hora_inicio | time | ✗ | - |
| motivo | text | ✗ | - |

**FK →** created_by → `usuarios.id` | organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` |

### profesional_bloqueos_recurrentes_overrides

| Column | Type | Null | Default |
|--------|------|------|---------|
| accion | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| created_by | uuid | ✓ | - |
| hora_fin | time | ✓ | - |
| hora_inicio | time | ✓ | - |
| fecha | date | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| bloqueo_recurrente_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** profesional_id → `profesionales.id` | bloqueo_recurrente_id → `profesional_bloqueos_recurrentes.id` | organizacion_id → `organizaciones.id` | created_by → `usuarios.id` |

### profesional_categorias

| Column | Type | Null | Default |
|--------|------|------|---------|
| profesional_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| categoria_id | uuid | ✗ | - |

**FK →** profesional_id → `profesionales.id` | categoria_id → `categorias_profesionales.id` |

**Constraints:** UNIQUE(`profesional_categorias_profesional_id_categoria_id_key`) on categoria_id | UNIQUE(`profesional_categorias_profesional_id_categoria_id_key`) on profesional_id |

### profesional_excepciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| fecha_inicio | timestamptz | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| fecha_fin | timestamptz | ✗ | - |
| cupos_disponibles | int4 | ✗ | 1 |
| created_by | uuid | ✓ | - |
| notas | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |

**FK →** created_by → `usuarios.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` |

### profesional_servicio

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| profesional_id | uuid | ✗ | - |
| servicio_id | uuid | ✗ | - |
| activo | bool | ✗ | true |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** profesional_id → `profesionales.id` | servicio_id → `servicios.id` |

**Constraints:** UNIQUE(`unique_profesional_servicio`) on profesional_id | UNIQUE(`unique_profesional_servicio`) on servicio_id |

### recursos_humanos

> ⚠️ Table not found in schema dump
### v_comisiones_profesionales

| Column | Type | Null | Default |
|--------|------|------|---------|
| num_excepciones | int4 | ✓ | - |
| profesional_id | uuid | ✓ | - |
| profesional_nombre | text | ✓ | - |
| comisiones_json | jsonb | ✓ | - |
| formato | text | ✓ | - |
| comision_activa | bool | ✓ | - |

### planillas

| Column | Type | Null | Default |
|--------|------|------|---------|
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| hora_fin | time | ✗ | - |
| hora_inicio | time | ✗ | - |
| dia_semana | USER-DEFINED | ✗ | - |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| cupo | int4 | ✗ | - |
| servicios_disponibles | ARRAY | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` |


### producto_servicio

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| producto_id | uuid | ✗ | - |
| servicio_id | uuid | ✗ | - |
| cantidad_incluida | int4 | ✗ | - |
| reglas | jsonb | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** producto_id → `productos.id` | servicio_id → `servicios.id` |

**Constraints:** UNIQUE(`producto_servicio_producto_id_servicio_id_key`) on producto_id, servicio_id |

