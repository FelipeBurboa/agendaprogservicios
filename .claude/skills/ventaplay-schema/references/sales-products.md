# Sales & Products

> 9 tables in this domain

### productos

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| reglas | jsonb | ✓ | - |
| fecha_expiracion | timestamptz | ✓ | - |
| dia_fijo | int4 | ✓ | - |
| tipo_precio | USER-DEFINED | ✗ | - |
| precio | numeric | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| organizacion_destino_id | uuid | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| nombre | text | ✗ | - |
| descripcion | text | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_destino_id → `organizaciones.id` | organizacion_id → `organizaciones.id` |

### productos_stock

| Column | Type | Null | Default |
|--------|------|------|---------|
| dimension_largo | numeric | ✓ | - |
| dimension_alto | numeric | ✓ | - |
| cantidad_disponible | int4 | ✗ | 0 |
| precio_descuento | numeric | ✓ | - |
| precio_venta | numeric | ✗ | - |
| activo | bool | ✓ | true |
| destacado | bool | ✓ | false |
| precio_costo | numeric | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| subcategoria_id | uuid | ✓ | - |
| proveedor_id | uuid | ✓ | - |
| precio_venta_interna | numeric | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| nombre | text | ✗ | - |
| descripcion | text | ✓ | - |
| sku | text | ✗ | - |
| barcode | text | ✓ | - |
| subcategoria | text | ✓ | - |
| tags | ARRAY | ✓ | `{}`::text[] |
| unidad_medida | varchar | ✓ | `unidad`::character varying |
| foto_principal_url | text | ✓ | - |
| fotos_adicionales | ARRAY | ✓ | `{}`::text[] |
| estado_stock | varchar | ✓ | - |
| categoria_id | uuid | ✓ | - |
| cantidad_maxima | int4 | ✓ | - |
| cantidad_minima | int4 | ✓ | 5 |
| peso | numeric | ✓ | - |
| dimension_ancho | numeric | ✓ | - |

**FK →** proveedor_id → `proveedores_stock.id` | subcategoria_id → `categorias_productos.id` | organizacion_id → `organizaciones.id` | categoria_id → `categorias_productos.id` |

**Constraints:** CHECK `precio_venta_gt_costo` (mig `20260718120000_add_precio_venta_gt_costo_constraint.sql`) — pese al nombre histórico, ahora solo valida `precio_venta >= 0 AND precio_costo >= 0`. NO exige venta > costo: se permiten precios bajo costo / 0 a propósito (insumos, liquidación, loss leaders). |

### variantes_producto

| Column | Type | Null | Default |
|--------|------|------|---------|
| activa | bool | ✓ | true |
| id | uuid | ✗ | uuid_generate_v4() |
| foto_url | text | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| sku_variante | text | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| nombre | text | ✗ | - |
| producto_id | uuid | ✗ | - |
| atributos | jsonb | ✓ | `{}`::jsonb |
| precio_ajustado | numeric | ✓ | - |
| cantidad_stock | int4 | ✗ | 0 |

**FK →** producto_id → `productos_stock.id` |

### categorias_productos

| Column | Type | Null | Default |
|--------|------|------|---------|
| nombre | text | ✗ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| organizacion_id | uuid | ✗ | - |
| descripcion | text | ✓ | - |
| parent_id | uuid | ✓ | - |
| orden | int4 | ✓ | 0 |
| activa | bool | ✓ | true |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| color_badge | varchar | ✓ | - |
| icono_url | text | ✓ | - |
| imprimir_en_comanda | boolean | ✗ | true |

**FK →** parent_id → `categorias_productos.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`categorias_productos_organizacion_id_nombre_parent_id_key`) on organizacion_id | UNIQUE(`categorias_productos_organizacion_id_nombre_parent_id_key`) on parent_id | UNIQUE(`categorias_productos_organizacion_id_nombre_parent_id_key`) on nombre |

**Notes:**
- `imprimir_en_comanda` (added 2026-05-12 in `20260512202140`) — per-category opt-out for kitchen comanda printing. Default `true` (everything prints to cocina); set `false` for categories like drinks/desserts that bypass kitchen routing.

### ventas_externas

| Column | Type | Null | Default |
|--------|------|------|---------|
| notas | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| sucursal_id | uuid | ✓ | - |
| profesional_id | uuid | ✓ | - |
| subtotal | numeric | ✗ | 0 |
| descuento_total | numeric | ✗ | 0 |
| total_final | numeric | ✗ | 0 |
| total_pagado | numeric | ✗ | 0 |
| saldo_pendiente | numeric | ✗ | 0 |
| cancelada_at | timestamptz | ✓ | - |
| cancelada_por_usuario_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| estado | text | ✗ | `pendiente_pago`::text |
| motivo_cancelacion | text | ✓ | - |

**FK →** cancelada_por_usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id` | usuario_id → `usuarios.id` | sucursal_id → `sucursales.id` | profesional_id → `profesionales.id` |

**Indexes:** partial index on `(profesional_id)` WHERE `profesional_id IS NOT NULL` (mig `20260423210000`) — supports per-pro sales attribution reports.

### ventas_externas_items

| Column | Type | Null | Default |
|--------|------|------|---------|
| venta_externa_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| subtotal_linea | numeric | ✗ | - |
| precio_final_unitario | numeric | ✗ | - |
| notas | text | ✓ | - |
| ajuste_tipo | text | ✗ | `sin_ajuste`::text |
| orden | int4 | ✗ | 1 |
| created_at | timestamptz | ✗ | now() |
| total_linea | numeric | ✗ | - |
| ajuste_valor | numeric | ✗ | 0 |
| precio_base_unitario | numeric | ✗ | - |
| cantidad | int4 | ✗ | - |
| producto_id | uuid | ✓ | - |
| plato_id | uuid | ✓ | - |

**FK →** venta_externa_id → `ventas_externas.id` | producto_id → `productos_stock.id` (RESTRICT) | plato_id → `platos.id` (RESTRICT) |

**Constraints:** CHECK `ventas_externas_items_producto_xor_plato` (mig `20260713120000_autopago_platos.sql`) — exactamente uno de `producto_id` / `plato_id` no nulo (línea de producto de stock **o** de plato, nunca ambos/ninguno). `producto_id` pasó de NOT NULL a nullable para permitir líneas de plato cuando el autopago (kiosko) vende platos. |

### venta_productos_interna

| Column | Type | Null | Default |
|--------|------|------|---------|
| notas | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| cantidad | int4 | ✗ | - |
| precio_sugerido | numeric | ✗ | - |
| precio_usado | numeric | ✗ | - |
| devuelto | bool | ✗ | false |
| devuelto_por_usuario_id | uuid | ✓ | - |
| fecha_devolucion | timestamptz | ✓ | - |
| usuario_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| sucursal_id | uuid | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| producto_id | uuid | ✗ | - |

**FK →** usuario_id → `usuarios.id` | profesional_id → `profesionales.id` | producto_id → `productos_stock.id` | sucursal_id → `sucursales.id` | organizacion_id → `organizaciones.id` | devuelto_por_usuario_id → `usuarios.id` |

### consumos

| Column | Type | Null | Default |
|--------|------|------|---------|
| estado_pedido | jsonb | ✓ | - |
| notas_consumo | text | ✓ | - |
| precio_final | numeric | ✗ | - |
| precio_original | numeric | ✗ | - |
| servicio_id | uuid | ✓ | - |
| atencion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| profesional_id | uuid | ✓ | - |
| producto_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| cantidad | int4 | ✗ | 1 |
| descuento_monto | numeric | ✗ | 0.00 |
| descuento_porcentaje | numeric | ✗ | 0.00 |
| usar_precio_original_para_comision | bool | ✗ | false |
| comanda_impresa | bool | ✗ | false |
| finished_at | timestamptz | ✓ | - |
| duration | int4 | ✓ | - |
| work_resumed_at | timestamptz | ✓ | - |

**FK →** servicio_id → `servicios.id` | profesional_id → `profesionales.id` | atencion_id → `atenciones.id` |

`comanda_impresa` (mig `20260603120000_comanda_impresa_flag.sql`) — flag for the kitchen comanda printing loop, sister column to `atencion_platos.comanda_impresa` (same semantics, see [atenciones-sessions.md](atenciones-sessions.md#atencion_platos)). The kitchen-printer PC polls for `comanda_impresa = false`, prints, then flippea to `true`. Backfill same as on `atencion_platos` — items in finished/cancelled atenciones or `estado_pedido->>'estado' = 'LISTO'` were pre-marked `true` at deploy.

`finished_at` (mig `20260624120000_add_finished_at_to_consumos.sql`) — `timestamptz NULL`, no default. Timestamp when the consumo line is marked finished; NULL = not yet finished. Same type as `created_at` but nullable and set at finalization, not creation.

`duration` (mig `20260625120000_add_duration_to_consumos.sql`) — `integer NULL`, no default, `CONSTRAINT consumos_duration_check CHECK (duration >= 0)`. Duration of the consumo in **minutes**; NULL = not yet set. Companion to `finished_at`, no backfill (existing rows stay NULL). `CHECK (duration >= 0)` permits NULL by Postgres three-valued logic (NULL >= 0 → NULL, not FALSE). **Semántica acumulativa (no replace)**: cada "finalizar" SUMA los minutos del segmento activo — `duration = COALESCE(duration,0) + GREATEST(0, ROUND((now - COALESCE(work_resumed_at, created_at)) / 60))`.

`work_resumed_at` (mig `20260626120000_add_work_resumed_at_to_consumos.sql`) — `timestamptz NULL`, no default, no backfill. Ancla del segmento de trabajo en curso tras **reabrir** un consumo finalizado: al reabrir se setea `work_resumed_at = now()` y el próximo "finalizar" suma `(now - work_resumed_at)` en vez de medir desde `created_at` (que inflaría `duration` con el tiempo pausado). NULL = primer segmento → se mide desde `created_at` (comportamiento idéntico al previo para filas existentes). El cierre masivo server-side vive en `finalizar_atencion_con_log` paso 3b (cierra todos los consumos de servicio pendientes al finalizar la atención — ver [atenciones-sessions.md](atenciones-sessions.md#lifecycle-rpc)); el espejo client-side es `aplicarFinalizacionConsumo()` en `useConsumos.ts`.

**Indexes:** partial index `idx_consumos_usar_precio_original` on `(atencion_id)` WHERE `usar_precio_original_para_comision = true`.

`usar_precio_original_para_comision` (mig `20260423220000_consumos_comision_valor_individual.sql`) — when **true**, `calcularComision()` uses `precio_original` (the snapshot of the servicio's individual price) as the commission base instead of `precio_final` (the prorated pack price). Activated only when a cita is created from a pack whose `servicios.pack_config.comision_por_valor_individual = true`; the `create-pack-appointment` Edge Function propagates the flag, and `AtencionesCRUD` persists it on each consumo at atencion start. Default false → identical to legacy behaviour.

**Asymmetry**: this flag changes commission math only. Atencion totals, `ingresos`, and cierre-de-caja still aggregate `precio_final` regardless of the flag — there is no double-counting risk on revenue, only on commission attribution.

### consumo_ayudantes

Ayudantes (0..N profesionales) de un consumo de servicio, adicionales al dueño (`consumos.profesional_id`). Creada en migración `20260721120001_consumo_ayudantes.sql`. Cada ayudante recibe **comisión propia** (su `comisiones_json` sobre la misma base del consumo) en Reporte Profesional, Comisiones y Cierre Diario — la atribución se computa en la capa de reportes (no se persiste comisión).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| consumo_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** consumo_id → `consumos.id` (ON DELETE CASCADE) | profesional_id → `profesionales.id` (NO ACTION — protege el historial de comisiones) | organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE(`consumo_ayudantes_unique`) on (consumo_id, profesional_id) — un ayudante no se repite por consumo |

**Indexes:** `idx_consumo_ayudantes_profesional` on (profesional_id) | `idx_consumo_ayudantes_org` on (organizacion_id). El UNIQUE cubre los lookups por consumo_id.

**Trigger:** `trg_consumo_ayudantes_no_owner` BEFORE INSERT OR UPDATE → `check_consumo_ayudante_no_owner()` rechaza (errcode 23514) si el ayudante == dueño efectivo del consumo (`COALESCE(consumos.profesional_id, atenciones.profesional_id)`). La regla principal vive en la UI (excluye al dueño del picker).

**RLS:** ninguna (postura grants-only del proyecto, espejo de `servicio_precios_sucursal`/`stock_por_ubicacion`). GRANT SELECT/INSERT/UPDATE/DELETE a `anon, authenticated, service_role`; `notify pgrst` en la migración.

**Notes:**
- Keyed solo por `consumo_id` (sin `atencion_id`); la atención se alcanza vía `consumos.atencion_id`. Espejo del junction `ingreso_atenciones`. `organizacion_id` se lleva para queries/reportes org-scoped (ojo: `consumos` NO tiene org propio).
- Solo se agregan a consumos de **servicio** (la UI no ofrece ayudantes en productos).
- Consumido por: `useConsumos` (embed `consumo_ayudantes` + `agregarAyudante`/`quitarAyudante`), `AyudantesConsumo` (UI dentro de `ListaConsumos`), y los 3 agregadores de comisión (`useReporteProfesional`, `useComisiones`, `useCierreDiario`) que acreditan al ayudante su comisión propia — suma a comisión/producción pero **NO** a revenue/conteos (evita doble conteo del valor del servicio).

### RPCs on sales/products

#### `resumen_ventas_por_producto(p_organizacion_id uuid, p_fecha_desde timestamptz, p_fecha_hasta timestamptz, p_sucursal_id uuid DEFAULT NULL) → TABLE`

Single-call sales summary by producto across all three sales surfaces. Added in mig `20260424120000_resumen_ventas_por_producto_rpc.sql`. Replaces ~5 round-trips + client-side aggregation in the sales report.

**Returns:** `(producto_id uuid, producto_nombre text, uds_interna bigint, total_interna numeric, uds_externa bigint, total_externa numeric, uds_atencion bigint, total_atencion numeric, uds_total bigint, total_general numeric)` ordered by `total_general DESC, producto_nombre ASC`.

**Sources combined:**
- `venta_productos_interna` where `devuelto = false` and `created_at` in range
- `ventas_externas_items` of `ventas_externas` where `estado = 'pagada'`, `created_at` in range, optional `sucursal_id` filter
- `consumos.producto_id IS NOT NULL` of atenciones whose `ingresos` row falls in range (matches by `atencion_id`)

**Auth:** `SECURITY INVOKER` with custom-auth org guard — raises `forbidden` (`42501`) unless `is_super_admin()` or `get_current_custom_user_organization() = p_organizacion_id`. Same pattern as `movimientos_stock_razones_distinct_org`.

**Why this matters:** the project does NOT use Supabase Auth, so RLS-only protection isn't enough — the org guard inside the function is the actual access boundary. When wrapping new aggregation RPCs, mirror this pattern.

**Cancelled-atencion exclusion (mig `20260526120000_fix_resumen_ventas_excluir_canceladas.sql`):** the `atenciones_pagadas` CTE originalmente solo filtraba por `ingresos.created_at` sin chequear `atenciones.estado` → atenciones canceladas con un ingreso registrado (caso: anulación tardía después de cobro) aparecían en el resumen aunque no se vean en `/atenciones`. Fix: JOIN con `atenciones` + exclusión explícita `WHERE a.estado != 'cancelada'`, consistente con el filtro default de la lista de atenciones. Signature/RETURNS TABLE idénticos → `CREATE OR REPLACE` preserva GRANTs.

