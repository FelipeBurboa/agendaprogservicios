# Payments & Billing

> 12 tables in this domain

### medios_pago

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| requiere_pos_manual | bool | ✓ | false |
| requiere_pos | bool | ✗ | false |
| created_at | timestamptz | ✗ | now() |
| nombre | text | ✗ | - |
| activo | bool | ✗ | true |
| campos_config | jsonb | ✗ | `[]`::jsonb |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`unique_medio_pago_por_organizacion`) on organizacion_id | UNIQUE(`unique_medio_pago_por_organizacion`) on nombre |

`campos_config` (mig `20260705120000_medios_pago_campos_configurables.sql`) — definición de campos personalizados que se piden al cobrar con este medio (medios NO integrados). Shape: `[{ key: text, label: text, tipo: 'texto'|'numero'|'select', obligatorio: bool, opciones?: text[] }]`. `[]` (default) = sin campos extra → comportamiento legacy byte-equivalente. Los valores capturados se guardan en `ingresos.datos_medio_pago`. No toca la lógica binaria `requiere_pos` / `requiere_pos_manual`.

### link_pagos

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | int8 | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| contacto_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| usuario_id | uuid | ✓ | - |
| cantidad | int8 | ✗ | - |
| ref | text | ✗ | - |
| descripcion | text | ✓ | - |
| pagado | bool | ✗ | false |
| pagado_fecha | timestamptz | ✓ | - |
| cita_id | uuid | ✓ | - |
| atencion_id | uuid | ✓ | - |
| tuu_tx_token | uuid | ✓ | - |
| tuu_instance | uuid | ✓ | - |
| notificado_pago_at | timestamptz | ✓ | - |
| pago_optimista_at | timestamptz | ✓ | - |
| tuu_account_id | text | ✓ | - |
| pago_verificacion_estado | text | ✓ | - |
| pago_verificacion_at | timestamptz | ✓ | - |
| pago_verificacion_intentos | int4 | ✗ | 0 |
| pago_verificacion_log | jsonb | ✗ | `[]`::jsonb |
| origen_url | text | ✓ | - |
| cotizacion_id | uuid | ✓ | - |

**FK →** atencion_id → `atenciones.id` | cita_id → `citas.id` | usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id` | contacto_id → `contactos.id` | cotizacion_id → `cotizaciones.id` (ON DELETE SET NULL) |

**Constraints:** UNIQUE(`link_pagos_ref_key`) on ref | UNIQUE(`link_pagos_ref_unique`) on ref WHERE `ref IS NOT NULL` (mig `20260425140000`) | CHECK(`link_pagos_pago_verificacion_estado_check`) — `pago_verificacion_estado IS NULL OR IN ('pending','verified','rejected')` |

**Indexes:** `link_pagos_tuu_tx_token_idx` on `(tuu_tx_token)` WHERE NOT NULL | `link_pagos_verificacion_pending_idx` on `(id)` WHERE `pago_verificacion_estado = 'pending'` | `idx_link_pagos_cotizacion` on `(cotizacion_id)` WHERE NOT NULL (mig `20260702120000`) |

**Prepago de cotizaciones (mig `20260702120000_cotizaciones_prepago.sql`, vertical Taller):** `cotizacion_id` vincula un cobro de anticipo a su cotización. Trigger `tr_link_pagos_cotizacion_on_paid` (AFTER UPDATE OF `pagado`) → función SECURITY DEFINER `link_pagos_cotizacion_on_paid()`: cuando `pagado` pasa a `true` y hay `cotizacion_id`, auto-acepta la cotización (`estado='aceptada'` si estaba en `borrador|enviada|vista`, `fecha_aceptacion = COALESCE(existente, now())`) e inserta evento `aceptada` (actor `cliente_publico`, payload `{via:'prepago', ref, monto}`) en `cotizaciones_eventos`. Corre sin importar QUÉ código marque pagado (confirm TUU, toggle manual). Las columnas `cotizaciones.prepago_requerido` / `prepago_porcentaje` y el resto de la vertical Cotizaciones se documentan en el skill **`ventaplay-taller`**.

**TUU optimistic-redirect flow (migs `20260425123000`–`20260425220000`):**
- `pago_optimista_at` is set when the UI redirects the user as if payment succeeded; the actual TUU verification runs asynchronously in `verify-tuu-payment-background`. The `pending` partial index drives that worker's queue.
- `pago_verificacion_estado` transitions `NULL → pending → verified | rejected`. `pago_verificacion_intentos` and `pago_verificacion_log` accumulate retry state.
- `notificado_pago_at` is **independent** of verification — it tracks user-facing notification (e.g. "su pago fue confirmado"), not the verification itself.
- `origen_url` records where the payment link was opened (used to attribute checkout origin for analytics).

### configuracion_link_pago

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | int8 | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✓ | - |
| url | text | ✗ | - |
| email | text | ✓ | - |
| telefono | text | ✗ | - |
| apellido | text | ✗ | - |
| nombre | text | ✗ | - |
| plataforma | text | ✗ | - |
| tuu_rut | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`configuracion_link_pago_url_key`) on url |

`tuu_rut` (mig `20260425140000`) — commerce RUT used for TUU/Webpay integrations. Distinct from the org's general billing RUT in `organizaciones_facturacion`; this is the merchant identity TUU expects.

### ingresos

| Column | Type | Null | Default |
|--------|------|------|---------|
| pos_device_id | uuid | ✓ | - |
| pos_transaction_json | jsonb | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| fecha_anulacion | timestamptz | ✓ | - |
| venta_externa_id | uuid | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| atencion_id | uuid | ✓ | - |
| es_pago_multiple | bool | ✓ | false |
| cita_id | uuid | ✓ | - |
| origen_tipo | text | ✗ | `atencion`::text |
| pos_manual_data_json | jsonb | ✓ | - |
| pos_manual_numero_transaccion | varchar | ✓ | NULL::character varying |
| pos_manual_numero_tarjeta | varchar | ✓ | NULL::character varying |
| pos_manual_tipo_tarjeta | varchar | ✓ | NULL::character varying |
| pos_idempotency_key | varchar | ✓ | - |
| pos_error_message | text | ✓ | - |
| anulado_por_usuario_id | uuid | ✓ | - |
| pos_transaction_id | text | ✓ | - |
| pos_sequence_number | varchar | ✓ | - |
| pos_status | varchar | ✓ | NULL::character varying |
| motivo_anulacion | text | ✓ | - |
| tipo | varchar | ✓ | `ingreso`::character varying |
| notas | text | ✓ | - |
| referencia_pos | text | ✓ | - |
| ingreso_original_id | uuid | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| pos_completed_at | timestamptz | ✓ | - |
| pos_response_json | jsonb | ✓ | - |
| medio_pago_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| pos_request_json | jsonb | ✓ | - |
| pos_payment_request_id | int8 | ✓ | - |
| monto | numeric | ✗ | - |
| fecha_pago | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✗ | - |
| datos_medio_pago | jsonb | ✓ | - |

**FK →** cita_id → `citas.id` | venta_externa_id → `ventas_externas.id` | pos_device_id → `pos_devices.id` | organizacion_id → `organizaciones.id` | medio_pago_id → `medios_pago.id` | ingreso_original_id → `ingresos.id` | atencion_id → `atenciones.id` | usuario_id → `usuarios.id` | anulado_por_usuario_id → `usuarios.id` |

`datos_medio_pago` (mig `20260705120000_medios_pago_campos_configurables.sql`) — valores capturados al cobrar para los campos personalizados definidos en `medios_pago.campos_config`. Shape: objeto `{ "<key>": <valor>, ... }`. NULL para ingresos sin campos personalizados (todos los previos a la feature).

### RPCs on `ingresos`

#### `get_ingresos_con_datos_v2(... , por_fecha_atencion boolean DEFAULT false) → TABLE`

Aggregated reporting query used by the ingresos listing. Returns per-ingreso rows joined with atencion / venta_externa / profesional / sucursal / boleta data.

**Return-shape additions (2026-04-16 → 2026-04-17):**
- `sucursal_nombre text` — historical sucursal via `COALESCE(cit.sucursal_id, aten_cit.sucursal_id) → sucursales.nombre` (the sucursal on the cita at the time of the atención). Falls back to the professional's current `sucursal_id` when the ingreso has no linked cita. Added in `20260416120000_fix_sucursal_historica_ingresos.sql`.
- `fecha_atencion timestamptz` — `fecha_inicio` of the linked atención. Lets UI distinguish "payment date" (`fecha_pago`) from "service date". Added in `20260417150000_add_fecha_atencion_profesionales_nombres.sql`.
- `profesionales_nombres text` — comma-joined list of ALL professionals involved in the atención (supports multi-pro atenciones for search/filter UI). Same migration.

**Timezone fix (`20260417120000_fix_timezone_get_ingresos_con_datos_v2.sql` + `20260417130000_fix_timezone_atenciones_rpcs.sql`):** All `fecha_desde`/`fecha_hasta` comparisons now wrap `fecha_pago` / `fecha_inicio` in `AT TIME ZONE 'America/Santiago'` before casting to `::date`. This fixes off-by-one day filtering near midnight UTC. The same TZ fix was applied to `get_atencion_financial_stats` in `20260417130000`.

**`propina_directa` patch (mig `20260608120000_get_ingresos_con_datos_v2_propina_directa_fecha_pago.sql`):** Cierre Diario llama esta RPC con `por_fecha_atencion=true`, modo en el que el filtro de fecha usa `a.fecha_inicio` (la atención). Pero una `propina_directa` no tiene atención (`atencion_id IS NULL`) → `a.fecha_inicio IS NULL` → `NULL >= fecha_desde` nunca es TRUE → la fila quedaba EXCLUIDA → la propina nunca se contaba en la caja. Fix: nueva rama `WHEN i.origen_tipo = 'propina_directa' THEN i.fecha_pago` agregada al CASE del WHERE, colocada ANTES de la rama `por_fecha_atencion` (first-match-wins). Espeja la rama existente de `venta_externa` (ambas son ingresos sin atención). Signature y `RETURNS TABLE` idénticos → `CREATE OR REPLACE` preserva GRANTs.

**`datos_medio_pago` column (mig `20260706120000_get_ingresos_con_datos_v2_datos_medio_pago.sql`):** agrega `datos_medio_pago jsonb` al FINAL del `RETURNS TABLE` + `i.datos_medio_pago` al final del SELECT (único delta vs `20260608120000`; resto verbatim). Como cambia el shape del RETURNS TABLE, la migración hace **DROP + CREATE** (no `CREATE OR REPLACE`) y re-otorga GRANTs a `anon, authenticated, service_role`. La tabla de `/ingresos` lee esta columna para mostrar los campos personalizados del medio de pago. Depende de mig `20260705120000`; NULL para todos los ingresos previos.

**Signature pattern:**
```sql
get_ingresos_con_datos_v2(
  org_id uuid,
  fecha_desde date DEFAULT NULL,
  fecha_hasta date DEFAULT NULL,
  ...,
  por_fecha_atencion boolean DEFAULT false  -- switches WHERE clause to filter by atencion fecha_inicio instead of ingreso fecha_pago
) RETURNS TABLE (..., sucursal_nombre text, fecha_atencion timestamptz, profesionales_nombres text)
```

Always prefer `(fecha_pago AT TIME ZONE 'America/Santiago')::date` (or `fecha_inicio` when `por_fecha_atencion=true`) in client-side date queries against these columns — the session TZ is UTC and Chile is UTC-4/-3.

#### `ingreso_cuenta_como_pago(p_ingreso_id uuid) → boolean`

**Predicado canónico** de "qué ingreso cuenta como pago positivo de una atención" — la única fuente de verdad de la lógica de POS-failed/anulados. Definición: `(tipo IS NULL OR tipo = 'ingreso') AND (pos_status IS NULL OR pos_status = 'completed')`. Los reversos sólo restan del total pagado cuando su `ingreso_original_id` satisface este predicado, garantizando la conservación matemática `original=+X ⇔ reverso=-X`. Si la definición de POS-failed cambia (ej. agregar un nuevo estado terminal), se edita SOLO acá y todo el árbol de cálculo se reajusta. Mig `20260607120000_fix_calcular_estado_pago_reverso_pos_failed.sql`. La consumen `calcular_total_pagado_atencion`, `calcular_estado_pago_atencion`, `obtener_resumen_pago_atencion`, `recalcular_estado_pago_atencion` (todas documentadas en [atenciones-sessions.md](atenciones-sessions.md#payment-state-rpcs-canonical-2026-05) — viven en ese dominio porque su sujeto es `atenciones.estado_pago`).

#### Trigger `actualizar_estado_pago_trigger()` — rewrite 2026-05-22

**Trigger function** invocada por `trigger_actualizar_estado_pago_ingresos` (sobre la tabla `ingresos`, AFTER INSERT/UPDATE/DELETE). Mantiene sincronizado `atenciones.estado_pago` con el estado real de los pagos. Reescrita en mig `20260609120000_fix_trigger_estado_pago_pos_status_race.sql` para arreglar un **segundo cobro duplicado real** (Tonos, 15-may-2026, Lorena Sierra, $76.980 cobrados de más).

**Bugs corregidos:**
1. **POS pending → completed race**: el early-return de la función chequeaba solo `monto`, `tipo`, `motivo_anulacion`. Cuando el cron POS asíncrono (`cron-check-pending-payments` / `check-pos-payment`) flippeaba `pos_status='pending' → 'completed'` minutos después del INSERT, el trigger entraba al early-return → `estado_pago` quedaba stale en `por_pagar` → operador veía "por pagar" y cobraba de nuevo. Fix: agregar `pos_status` al predicado del early-return.
2. **Multi-payment huérfano**: cuando un ingreso tiene `atencion_id=NULL` AND `es_pago_multiple=true` (cobro que distribuye a N atenciones vía `ingreso_atenciones`), el trigger no encontraba atención y no recalculaba nada. Fix: si `NEW.atencion_id IS NULL` pero `es_pago_multiple=true`, iterar sobre `ingreso_atenciones` y recalcular cada atención del puente, con BEGIN/EXCEPTION por iteración para que una falla no aborte las demás.

**Sin cambios** (preservados verbatim del comportamiento anterior): toda la lógica de cita_id fallback, el `EXCEPTION WHEN OTHERS` global, la idempotencia (solo UPDATE si el estado cambió). El trigger sigue siendo el mismo objeto en BD — solo cambia el cuerpo de la función. Cero riesgo de schema change.

### estadisticas_ingresos_reales

| Column | Type | Null | Default |
|--------|------|------|---------|
| ingresos_netos | numeric | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| total_ingresos | int8 | ✓ | - |
| ingresos_brutos | numeric | ✓ | - |
| reversos_total | numeric | ✓ | - |

### reembolsos

> ⚠️ Table not found in schema dump
### giftcards

| Column | Type | Null | Default |
|--------|------|------|---------|
| monto | numeric | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| codigo | text | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| atencion_id | uuid | ✗ | - |
| ingreso_id | uuid | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | ingreso_id → `ingresos.id` | atencion_id → `atenciones.id` |

### propinas

| Column | Type | Null | Default |
|--------|------|------|---------|
| ingreso_id | uuid | ✓ | - |
| tipo | text | ✗ | - |
| consumo_total | numeric | ✗ | 0 |
| profesional_id | uuid | ✗ | - |
| atencion_ids | ARRAY | ✗ | `{}`::uuid[] |
| monto_propina | numeric | ✗ | 0 |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| anulado | bool | ✗ | false |
| fecha_anulacion | timestamptz | ✓ | - |
| valor_ingresado | numeric | ✗ | 0 |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` | ingreso_id → `ingresos.id` | profesional_id → `profesionales.id` |

### atenciones_boletas_electronicas

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| estado | varchar | ✗ | `emitida`::character varying |
| scope | varchar | ✗ | - |
| receiver_rut | varchar | ✗ | - |
| atencion_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| cuenta_facturacion_id | uuid | ✗ | - |
| afecta_iva | bool | ✗ | - |
| request_payload | jsonb | ✗ | `{}`::jsonb |
| batch_response | jsonb | ✓ | - |
| document_response | jsonb | ✓ | - |
| detalle_items | jsonb | ✗ | `[]`::jsonb |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| nota_credito_batch_response | jsonb | ✓ | - |
| nota_credito_document_response | jsonb | ✓ | - |
| anulada_at | timestamptz | ✓ | - |
| nota_credito_pdf_url | text | ✓ | - |
| nota_credito_folio | text | ✓ | - |
| nota_credito_tupana_document_id | text | ✓ | - |
| error_message | text | ✓ | - |
| pdf_url | text | ✓ | - |
| folio | text | ✓ | - |
| tupana_document_id | text | ✓ | - |
| tupana_batch_id | text | ✓ | - |
| dte_type_code | varchar | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | cuenta_facturacion_id → `cuentas_facturacion_electronica.id` | atencion_id → `atenciones.id` |

### ventas_externas_boletas_electronicas

| Column | Type | Null | Default |
|--------|------|------|---------|
| nota_credito_tupana_document_id | text | ✓ | - |
| scope | text | ✗ | `productos`::text |
| dte_type_code | text | ✗ | - |
| tupana_batch_id | text | ✓ | - |
| folio | text | ✓ | - |
| nota_credito_pdf_url | text | ✓ | - |
| nota_credito_folio | text | ✓ | - |
| document_response | jsonb | ✓ | - |
| error_message | text | ✓ | - |
| tupana_document_id | text | ✓ | - |
| pdf_url | text | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| anulada_at | timestamptz | ✓ | - |
| receiver_rut | text | ✗ | - |
| afecta_iva | bool | ✗ | true |
| detalle_items | jsonb | ✗ | `[]`::jsonb |
| cuenta_facturacion_id | uuid | ✗ | - |
| batch_response | jsonb | ✓ | - |
| request_payload | jsonb | ✗ | `{}`::jsonb |
| estado | text | ✗ | `emitida`::text |
| id | uuid | ✗ | gen_random_uuid() |
| venta_externa_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | venta_externa_id → `ventas_externas.id` | cuenta_facturacion_id → `cuentas_facturacion_electronica.id` |

### cuentas_facturacion_electronica

| Column | Type | Null | Default |
|--------|------|------|---------|
| emisor_rut | varchar | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| emisor_sucursal_sii | int4 | ✗ | 0 |
| emisor_resolucion_fecha | date | ✓ | - |
| certificado_vigencia_desde | date | ✓ | - |
| certificado_vigencia_hasta | date | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| afecta_iva | bool | ✗ | true |
| emisor_pais | varchar | ✗ | `CL`::character varying |
| nombre_pila | varchar | ✗ | - |
| emisor_razon_social | varchar | ✗ | - |
| emisor_nombre_fantasia | varchar | ✓ | - |
| emisor_giro | varchar | ✗ | - |
| emisor_codigo_actividad_economica | varchar | ✗ | - |
| emisor_tipo_contribuyente | varchar | ✗ | `empresa`::character varying |
| emisor_direccion | varchar | ✗ | - |
| emisor_comuna | varchar | ✗ | - |
| emisor_ciudad | varchar | ✗ | - |
| emisor_region | varchar | ✗ | - |
| emisor_codigo_sucursal | varchar | ✓ | - |
| emisor_resolucion_numero | varchar | ✓ | - |
| emisor_email_dte | varchar | ✗ | - |
| certificado_digital_url | text | ✓ | - |
| certificado_password | text | ✓ | - |
| tipo | text | ✗ | `servicios`::text |

**FK →** organizacion_id → `organizaciones.id` |

### metas_comerciales

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| mes | int4 | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| anio | int4 | ✗ | - |
| meta_ingresos | numeric | ✗ | - |
| updated_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`metas_comerciales_organizacion_id_anio_mes_key`) on anio | UNIQUE(`metas_comerciales_organizacion_id_anio_mes_key`) on mes | UNIQUE(`metas_comerciales_organizacion_id_anio_mes_key`) on organizacion_id |

### egresos

> Cash outflows / expenses. Decoupled from `ingresos` to avoid the `ingresos_origen_consistencia_check` constraint and to keep payment-side junctions (`ingreso_atenciones`, `propinas`, `giftcards`, `canjes`) free of expense semantics. **Subtracts from Cierre Diario neto.** Migration `20260429120000_add_egresos_table.sql`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| sucursal_id | uuid | ✓ | - |
| monto | numeric | ✗ | - |
| medio_pago | egreso_medio_pago | ✗ | - |
| notas | text | ✗ | - |
| fecha_egreso | timestamptz | ✗ | now() |
| tipo | egreso_tipo | ✗ | `egreso` |
| egreso_original_id | uuid | ✓ | - |
| motivo_anulacion | text | ✓ | - |
| anulado_por_usuario_id | uuid | ✓ | - |
| fecha_anulacion | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**Enums:**
- `egreso_medio_pago`: `efectivo` | `transferencia` | `comprobante_general` (hardcoded — NOT an FK to `medios_pago`)
- `egreso_tipo`: `egreso` | `reverso_egreso`

**FK →** organizacion_id → `organizaciones.id` (ON DELETE RESTRICT) | usuario_id → `usuarios.id` (RESTRICT) | sucursal_id → `sucursales.id` (RESTRICT) | egreso_original_id → `egresos.id` (RESTRICT, self-FK) | anulado_por_usuario_id → `usuarios.id` (SET NULL) |

**Constraints:**
- CHECK(`egresos_monto_positivo`) — `monto > 0`
- CHECK(`egresos_notas_no_vacia`) — `length(btrim(notas)) >= 1` (notes are mandatory)
- CHECK(`egresos_reverso_consistencia`) — `(tipo='egreso' AND egreso_original_id IS NULL) OR (tipo='reverso_egreso' AND egreso_original_id IS NOT NULL)`

**Indexes:**
- `idx_egresos_org_fecha` on `(organizacion_id, fecha_egreso DESC)` — main listing.
- `idx_egresos_org_tipo` on `(organizacion_id, tipo)`.
- `idx_egresos_org_sucursal` on `(organizacion_id, sucursal_id)`.
- `idx_egresos_original` on `(egreso_original_id) WHERE egreso_original_id IS NOT NULL` — reverso lookups.

**Triggers:**
- `update_egresos_updated_at` BEFORE UPDATE → `update_updated_at_column()` (shared generic function).

**RLS:** Enabled with dev-mode wide-open policies (`Egresos - Desarrollo - SELECT/INSERT/UPDATE/DELETE all`). Production hardening = follow-up migration mirroring whatever `ingresos` uses.

**Asymmetries vs `ingresos`:**
- No atencion / venta_externa link — egresos are not tied to a sale.
- `medio_pago` is an enum, NOT a FK; CRM medio-pago picker doesn't apply here.
- No POS fields, no propinas, no giftcards/canjes junctions.
- `tipo='egreso'` shows in Cierre Diario as negative; `tipo='reverso_egreso'` cancels its `egreso_original_id` parent (positive sign in displays).

### RPCs on `egresos`

- **`get_egresos_con_datos_v1(org_id uuid, fecha_desde date DEFAULT NULL, fecha_hasta date DEFAULT NULL, sucursal_id_filter uuid DEFAULT NULL)`** — SECURITY DEFINER, language sql. Returns enriched flat rows: all `egresos` columns + `usuario_nombre`, `sucursal_nombre`, `anulado_por_nombre`, `tiene_reverso boolean`. Date filter wraps `fecha_egreso AT TIME ZONE 'America/Santiago'` before `::date` (project memory: never bare `::date` on UTC timestamps). Granted to `authenticated` and `service_role`.
- **`anular_egreso_con_reverso(p_egreso_id uuid, p_motivo_anulacion text, p_usuario_id uuid)`** — SECURITY DEFINER, language plpgsql, returns the new `reverso_egreso.id`. Atomic flow: `SELECT ... FOR UPDATE` the original; INSERT a `tipo='reverso_egreso'` row mirroring monto/medio_pago/sucursal_id; UPDATE original setting `motivo_anulacion`/`anulado_por_usuario_id`/`fecha_anulacion`. Raises if egreso doesn't exist (`P0002`), is already anulado, is itself a reverso, or already has a reverso (`P0001`). Granted to `authenticated` and `service_role`.

**Cierre Diario integration:**
- `EgresosService.calcularTotales(egresos)` (frontend, `src/components/ingresos/services/EgresosService.ts`) returns `{ totalEgresos, totalReversosEgreso, totalNetoEgresos, porMedio, cantidad, cantidadReversos }`. Net subtracted from `data.kpis.ingresosNetos + data.kpis.totalPropinas` to get **Caja Neta** in `HeroKPI`. Excel + PDF exports include an Egresos sheet/section.
- Tabla de Ingresos shows egresos inline via the unified `data.movimientos: MovimientoCajaConDatos[]` list (kind discriminator `'ingreso' | 'egreso'`, sorted DESC by `fecha_movimiento`).

