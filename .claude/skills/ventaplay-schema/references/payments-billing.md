# Payments & Billing

> 17 tables in this domain

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

**Prepago de cotizaciones → atención (migs `20260702120000` + `20260721120000`, vertical Taller):** `cotizacion_id` vincula un cobro de anticipo a su cotización. Trigger `tr_link_pagos_cotizacion_on_paid` — desde `20260721120000_cotizacion_pago_crea_atencion.sql` es **BEFORE** UPDATE OF `pagado` (antes era AFTER) → función SECURITY DEFINER `link_pagos_cotizacion_on_paid()`: cuando `pagado` pasa a `true`, hay `cotizacion_id` y `NEW.atencion_id IS NULL`, llama a `convertir_cotizacion_en_atencion(cotizacion_id, cotizaciones.usuario_id)` y setea `NEW.atencion_id` con la atención resultante (idempotente: si ya existía la reusa). Al ser BEFORE, ese `atencion_id` queda en el RETURNING del UPDATE → el pipeline de pago (`ensureIngresoForPaidLink`) adjunta su único ingreso a esa atención, sin doble conteo. La RPC además deja la cotización en `aceptada` (reemplaza el auto-accept del trigger AFTER anterior de `20260702120000`). EXCEPTION handler: si la conversión falla, el anticipo igual se marca pagado (degradado, sin atención). Las columnas `cotizaciones.*` (incl. `prepago_requerido`/`prepago_porcentaje`/`profesional_id`) y el resto de la vertical Cotizaciones → skill **`ventaplay-taller`**; `atenciones.cotizacion_origen_id` + la RPC `convertir_cotizacion_en_atencion` → [atenciones-sessions.md](atenciones-sessions.md).

**TUU optimistic-redirect flow (migs `20260425123000`–`20260425220000`):**
- `pago_optimista_at` is set when the UI redirects the user as if payment succeeded; the actual TUU verification runs asynchronously in `verify-tuu-payment-background`. The `pending` partial index drives that worker's queue.
- `pago_verificacion_estado` transitions `NULL → pending → verified | rejected`. `pago_verificacion_intentos` and `pago_verificacion_log` accumulate retry state.
- `notificado_pago_at` is **independent** of verification — it tracks user-facing notification (e.g. "su pago fue confirmado"), not the verification itself.
- `origen_url` records where the payment link was opened (used to attribute checkout origin for analytics).

**Automatización `link_pago_enviado` (mig `20260923120000`):** trigger `tr_link_pago_enviado_db` AFTER INSERT ON `link_pagos` **WHEN `NEW.origen_url IS NULL`** → `trigger_link_pago_enviado_to_edge()` (SECURITY DEFINER, `search_path = ''`), `net.http_post` fire-and-forget a `<supabase_functions_url>/trigger-automatizaciones` (timeout 2 s, excepciones a `RAISE WARNING`). El guard por `origen_url IS NULL` distingue el link **enviado al cliente** de los creados por el checkout público. `tipo_evento='link_pago_enviado'` es el 17º valor del CHECK de `automatizaciones_whatsapp`.

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

**Constraints de origen (DROP+ADD en mig `20260924120000`):**
- `ingresos_origen_tipo_check` → `origen_tipo IN ('atencion','venta_externa','propina_directa','pos_manual')` (**4 valores**; `pos_manual` nuevo).
- `ingresos_origen_consistencia_check` → 4 ramas: `atencion` (venta_externa_id NULL) · `venta_externa` (venta_externa_id NOT NULL **y** atencion_id NULL) · `propina_directa` (ambos NULL) · `pos_manual` (venta_externa_id NULL; `atencion_id` **puede** ser NULL y llenarse después).

`origen_tipo='pos_manual'` = cobro hecho en el equipo POS sin atención asociada, que después se engancha a una atención desde el CRM:
- **`asignar_ingreso_a_atencion(p_ingreso_id uuid, p_atencion_id uuid, p_usuario_id uuid DEFAULT NULL, p_propinas jsonb DEFAULT NULL) → json`** — DROP+CREATE (ganó `p_propinas`). Adjunta el ingreso y recalcula el estado de pago.
- **`desasignar_ingreso_de_atencion(p_ingreso_id uuid, p_usuario_id uuid DEFAULT NULL) → json`** — lo suelta y recalcula.
Ambas SECURITY DEFINER, `GRANT ALL` a `anon, authenticated, service_role`.

### RPCs on `ingresos`

#### `get_ingresos_con_datos_v2(... , por_fecha_atencion boolean DEFAULT false) → TABLE`

Aggregated reporting query used by the ingresos listing. Returns per-ingreso rows joined with atencion / venta_externa / profesional / sucursal / boleta data.

**Return-shape additions (2026-04-16 → 2026-04-17):**
- `sucursal_nombre text` — historical sucursal via `COALESCE(cit.sucursal_id, aten_cit.sucursal_id) → sucursales.nombre` (the sucursal on the cita at the time of the atención). Falls back to the professional's current `sucursal_id` when the ingreso has no linked cita. Added in `20260416120000_fix_sucursal_historica_ingresos.sql`.
- `fecha_atencion timestamptz` — `fecha_inicio` of the linked atención. Lets UI distinguish "payment date" (`fecha_pago`) from "service date". Added in `20260417150000_add_fecha_atencion_profesionales_nombres.sql`.
- `profesionales_nombres text` — comma-joined list of ALL professionals involved in the atención (supports multi-pro atenciones for search/filter UI). Same migration.

**Timezone fix (`20260417120000_fix_timezone_get_ingresos_con_datos_v2.sql` + `20260417130000_fix_timezone_atenciones_rpcs.sql`):** All `fecha_desde`/`fecha_hasta` comparisons now wrap `fecha_pago` / `fecha_inicio` in `AT TIME ZONE 'America/Santiago'` before casting to `::date`. This fixes off-by-one day filtering near midnight UTC. The same TZ fix was applied to `get_atencion_financial_stats` in `20260417130000`.

**`origen_tipo='propina_directa'`** nació en la mig `20260515120000_ingresos_propina_directa.sql` (propina cobrada sin atención ni venta externa).

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

#### `obtener_pagos_netos_atenciones(p_atencion_ids uuid[]) → TABLE(atencion_id, total_pagado numeric, total_consumo numeric)`

(mig `20260812120000`) Wrapper batch de `calcular_total_pagado_atencion` para prorratear comisiones en atenciones parcialmente pagadas (`estado_pago='abonado'`) desde la vista Comisiones y `/reporte-profesional`, SIN re-derivar la fórmula de pago client-side. Devuelve además `total_consumo` de la misma fila (denominador del factor de prorrateo, consistente con el estado). SQL STABLE SECURITY DEFINER, GRANT a anon/authenticated/service_role.

#### `get_kpis_negocio(p_organizacion_id uuid, p_fecha_desde date, p_fecha_hasta date) → jsonb`

(migs `20260814120000` v1, `20260814120001` grants, `20260814120002` v2) Reporte de KPIs para la API externa `get-business-report` (portal Configuración → API, categoría Reportes). jsonb con: `atenciones` (reusa `get_atencion_financial_stats` — reversos inteligentes, por `fecha_inicio` tz Chile), `ingresos` (v2 — TODO lo que entró en el período por `fecha_pago`, por `origen_tipo`, con la misma lógica de reversos; pregunta distinta a `atenciones.*`, no es doble conteo), `citas` (total + breakdown por estado, por `fecha_cita`) y `top_servicios` (top 10 por monto sobre atenciones finalizadas/reabierto). **Seguridad: recibe la org como PARÁMETRO → EXECUTE SOLO `service_role`.** El `REVOKE ... FROM PUBLIC` de la v1 NO alcanzó — los DEFAULT PRIVILEGES de Supabase grantean EXECUTE explícito a anon/authenticated en cada función nueva, así que `20260814120001` revoca explícitamente de anon/authenticated (era un IDOR: cualquiera con el anon key pedía el reporte de cualquier org). Patrón a recordar para toda RPC parametrizada por org.

#### `get_kpis_profesional(p_org_id uuid, p_desde date, p_hasta date) → TABLE(profesional_id uuid, profesional_nombre text, n_atenciones integer, produccion numeric, ingresos numeric, venta_interna numeric, comision numeric, propinas numeric)`

Migraciones `20260601185624` (versión inicial de 6 columnas) → `20260601194907` (**DROP+CREATE**: agrega `ingresos` y `venta_interna` → 8 columnas, forma vigente) → `20260601224732` (excluye propinas anuladas) → `20260602165353` (venta interna desde bodega). `LANGUAGE sql STABLE`, `SET search_path = public`, SECURITY INVOKER. Solo cuenta atenciones `estado='finalizada' AND estado_pago='pagado'`, con el día bucketeado en `AT TIME ZONE 'America/Santiago'`. GRANT EXECUTE a `anon, authenticated, service_role`.

#### `get_propinas_totales(p_org, p_restrict_prof uuid[], p_tipo, p_estado, p_from, p_to, p_profesional_id, p_sucursal_prof uuid[], p_ingreso_ids uuid[]) → TABLE(total_count, total_monto, count_activas, promedio_percent)`

(mig `20260811120000`) Totales de propinas EXACTOS sobre el conjunto filtrado, sin depender del `max_rows=1000` de PostgREST. La UI (`usePropinasHistory`) la usa para las tarjetas KPI y el conteo de paginación, con los mismos filtros que la tabla. `total_monto`/`promedio_percent` EXCLUYEN anuladas; `total_count` cuenta todas las filas que cumplen filtros (incluye anuladas con `p_estado='all'`) para que coincida con la paginación. SQL STABLE, GRANT solo a `authenticated`. `p_restrict_prof` = restricción del rol professional (ver `organizaciones.propina_visible_profesional`).

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

**Notes:** ⚠️ **No confundir con `giftcards_emitidas`** (abajo). Esta tabla registra el **uso** de una giftcard como medio de pago de una atención (histórico, sin saldo ni ciclo de vida). Las giftcards que la organización **emite y vende**, con saldo y vencimiento, viven en `giftcards_emitidas`; al canjearse escriben una fila acá **y** una en `giftcard_canjes`.

## Giftcards emitidas (venta, saldo y canje)

> Migraciones `20260922120000` (2 tablas + RPCs), `20260922130000` (cron), `20260922140000` (editar/recargar), `20260922150000` + `20260922160000` (log de externas), `20260922170000` (tabla de eventos + instrumentación). Vertical completa: la org **emite** giftcards con código, saldo y vencimiento; se canjean parcialmente contra atenciones hasta agotar el saldo. **Sin RLS — grants-only** (postura del proyecto, espejo de `stock_por_ubicacion`); el aislamiento por org lo hacen las RPCs (`get_current_custom_user_organization()` / `is_super_admin()`).

### giftcards_emitidas

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| codigo | text | ✗ | - |
| monto_inicial | numeric(10,2) | ✗ | - |
| saldo | numeric(10,2) | ✗ | - |
| estado | text | ✗ | `activa` |
| fecha_vencimiento | date | ✓ | - |
| creado_por_usuario_id | uuid | ✓ | - |
| anulada_por_usuario_id | uuid | ✓ | - |
| fecha_anulacion | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (NO ACTION) | creado_por_usuario_id → `usuarios.id` (NO ACTION) | anulada_por_usuario_id → `usuarios.id` (NO ACTION) |

**Constraints:** UNIQUE on `codigo` — **global, no por org** | CHECK `codigo = upper(codigo)` | CHECK `monto_inicial > 0` | CHECK `saldo >= 0` | CHECK `estado IN ('activa','agotada','vencida','anulada')` |

**Indexes:** `idx_giftcards_emitidas_org` on `(organizacion_id, created_at DESC)` |

**Notes:** Código `GC-` + 12 chars del alfabeto sin ambigüedades `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (10 reintentos ante colisión), o `p_codigo_custom`. La unicidad global del código es deliberada: el canje se hace por código sin conocer la org.

### giftcard_canjes

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| giftcard_emitida_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| atencion_id | uuid | ✗ | - |
| ingreso_id | uuid | ✓ | - |
| monto | numeric(10,2) | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** giftcard_emitida_id → `giftcards_emitidas.id` (NO ACTION) | organizacion_id → `organizaciones.id` (NO ACTION) | `atencion_id` e `ingreso_id` son uuid **sin FK** |

**Constraints:** CHECK `monto > 0` |

**Indexes:** `idx_giftcard_canjes_ingreso` on `(ingreso_id)` | `idx_giftcard_canjes_emitida` on `(giftcard_emitida_id)` |

**Notes:** Cada canje descuenta de `giftcards_emitidas.saldo`. Es el puente que permite **restaurar saldo al anular el ingreso** (ver `anular_ingreso_con_reverso` abajo).

### giftcards_emitidas_eventos

> Bitácora append-only por giftcard (mig `20260922170000`).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| giftcard_emitida_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| evento | text | ✗ | - |
| usuario_id | uuid | ✓ | - |
| usuario_nombre | text | ✓ | - |
| monto | numeric(10,2) | ✓ | - |
| detalles | jsonb | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** giftcard_emitida_id → `giftcards_emitidas.id` (NO ACTION) | organizacion_id → `organizaciones.id` (NO ACTION). `usuario_id` **sin FK** (NULL = Sistema); `usuario_nombre` denormalizado sobrevive el borrado del usuario.

**Constraints:** CHECK `evento IN ('creada','canjeada','anulada','vencimiento_editado','recargada','saldo_restaurado','vencida')` |

**Indexes:** `idx_gce_eventos_card` on `(giftcard_emitida_id, created_at DESC)` |

**Grants:** SELECT + INSERT a `anon, authenticated, service_role` — **sin UPDATE/DELETE** a propósito (append-only). La migración backfilleó un evento `creada` por cada giftcard preexistente.

### RPCs de giftcards emitidas

| RPC | Firma | Notas |
|---|---|---|
| `crear_giftcards_emitidas` | `(p_organizacion_id uuid, p_cantidad int, p_monto numeric, p_fecha_vencimiento date DEFAULT NULL, p_codigo_custom text DEFAULT NULL) → SETOF giftcards_emitidas` | cantidad 1..200 |
| `validar_giftcard_emitida` | `(p_codigo text) → TABLE(id, saldo, estado, fecha_vencimiento, monto_inicial)` | sql STABLE, lectura previa al canje |
| `canjear_giftcard_emitida` | `(p_codigo text, p_monto numeric, p_atencion_id uuid, p_ingreso_id uuid DEFAULT NULL) → json` | `FOR UPDATE` sobre la card; escribe `giftcards` + `giftcard_canjes`; agota → `estado='agotada'` |
| `anular_giftcard_emitida` | `(p_id uuid) → json` | solo desde `activa` o `vencida` |
| `editar_giftcard_emitida` | `(p_id uuid, p_fecha_vencimiento date DEFAULT NULL) → json` | org-scoped, `FOR UPDATE` |
| `recargar_giftcard_emitida` | `(p_id uuid, p_monto numeric) → json` | suma a `saldo` **y** a `monto_inicial` |
| `get_giftcards_emitidas_totales` | `(p_organizacion_id uuid, p_fecha_desde timestamptz DEFAULT NULL, p_fecha_hasta timestamptz DEFAULT NULL, p_estado text DEFAULT NULL) → json` | KPIs, gate org/`is_super_admin()` |
| `get_giftcards_externas` | `(p_organizacion_id uuid, p_fecha_desde timestamptz DEFAULT NULL, p_fecha_hasta timestamptz DEFAULT NULL, p_search text DEFAULT NULL, p_limit int DEFAULT 15, p_offset int DEFAULT 0) → json` | log paginado de giftcards **externas** (las de la tabla `giftcards` que no vienen de una emitida). La primera versión (`…150000`) tiraba `42P01`; la vigente es `…160000` (CTEs encadenadas en una sola sentencia) |
| `registrar_giftcard_evento` | `(p_card_id uuid, p_org uuid, p_evento text, p_usuario_id uuid DEFAULT NULL, p_monto numeric DEFAULT NULL, p_detalles jsonb DEFAULT NULL) → void` | helper que usan las 6 RPCs anteriores |

**`anular_ingreso_con_reverso(p_ingreso_id uuid, p_motivo_anulacion text, p_usuario_id uuid) → json` fue reescrita** (mig `20260922120000`, instrumentada en `…170000`): al anular un ingreso ahora **restituye el saldo** de las giftcards canjeadas contra él (vía `giftcard_canjes.ingreso_id`) y registra el evento `saldo_restaurado`. Sin esto, anular un pago pagado con giftcard quemaba el saldo.

**Cron `giftcards-marcar-vencidas`** (05:00 diario; definido en `…130000`, re-scheduleado en `…170000`): `activa` + `fecha_vencimiento < CURRENT_DATE` → `vencida`, insertando el evento `vencida` en la misma sentencia (`WITH ... RETURNING`).

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
| whatsapp_notificado_at | timestamptz | ✓ | - |
| montos_ajustados_iva | bool | ✗ | false |

**FK →** organizacion_id → `organizaciones.id` | cuenta_facturacion_id → `cuentas_facturacion_electronica.id` | atencion_id → `atenciones.id` |

**Notes (columnas 2026-07):**
- `whatsapp_notificado_at` (mig `20260821120000_boleta_emitida_automatizacion.sql`) — claim atómico de la automatización `boleta_emitida` (`UPDATE ... WHERE whatsapp_notificado_at IS NULL`): la boleta llega a `sincronizada` desde ~5 sitios (emit FASE-4, webhook Tupana, recover, sync manual) y solo el primero dispara el WhatsApp. NULL = no notificada. La misma migración crea el bucket público `boletas-pdf` (20 MB, solo PDF, policies públicas) para re-alojar el PDF — el `pdf_url` de Tupana es presignado y expira ~1h, pero Meta descarga el documento al momento del envío.
- `montos_ajustados_iva` (mig `20260828120000_boletas_montos_ajustados_iva.sql`) — `true` = la boleta afecta (DTE 39) se emitió con montos convertidos BRUTO→NETO (÷1.19) antes de enviarse a Tupana (fix: Tupana trata `unit_price` como neto y agrega 19%; antes un producto de $300 salía en $357). Discrimina para la anulación: si `true`, la Nota de Crédito debe convertir igual (los `detalle_items` guardados están en bruto); si `false` (boleta pre-fix o exenta DTE 41), la NC envía tal cual. Misma columna en `ventas_externas_boletas_electronicas`.

### atenciones_boletas_honorarios

> Boletas de honorarios (DTE 80) que el PROFESIONAL emite por su comisión. Migración `20260714100000_honorarios_boletas.sql`. Espejo de `atenciones_boletas_electronicas` pero keyeada por `profesional_id` (no `cuenta_facturacion_id`). Gateada por `organizaciones.usa_honorarios` + `profesionales.honorarios_activo`. Solo SERVICIOS generan honorario (la comisión de productos es renta del trabajo).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| atencion_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| profesional_id | uuid | ✗ | - |
| tipo | varchar(20) | ✗ | `servicio` |
| emisor_rut | varchar(20) | ✗ | - |
| receiver_rut | varchar(20) | ✗ | `66666666-6` |
| retention_type | varchar(20) | ✗ | `RETCONTRIBUYENTE` |
| dte_type_code | varchar(2) | ✗ | `80` |
| monto_bruto | int4 | ✗ | - |
| estado | varchar(20) | ✗ | `pending` |
| tupana_batch_id | text | ✓ | - |
| tupana_document_id | text | ✓ | - |
| folio | text | ✓ | - |
| pdf_url | text | ✓ | - |
| request_payload | jsonb | ✗ | `{}`::jsonb |
| batch_response | jsonb | ✓ | - |
| document_response | jsonb | ✓ | - |
| detalle_items | jsonb | ✗ | `[]`::jsonb |
| error_message | text | ✓ | - |
| anulada_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| whatsapp_notificado_at | timestamptz | ✓ | - |

**FK →** atencion_id → `atenciones.id` (CASCADE) | organizacion_id → `organizaciones.id` (CASCADE) | profesional_id → `profesionales.id` (RESTRICT) |

**Constraints:** CHECK `tipo IN ('servicio','producto')` | CHECK `dte_type_code IN ('80','90')` | CHECK `retention_type IN ('RETCONTRIBUYENTE','RETRECEPTOR')` | CHECK `estado IN ('pending','emitida','sincronizada','error','anulada','descartada')` (mig `20260714100001` agregó `descartada`) | CHECK `monto_bruto >= 0` |

**Indexes:** UNIQUE parcial `atenciones_boletas_honorarios_active_key` on `(atencion_id, profesional_id, tipo) WHERE estado IN ('pending','emitida','sincronizada')` — 1 BHE viva por (atención, profesional, tipo); `descartada`/`error`/`anulada` liberan el slot | `idx_atenciones_boletas_honorarios_atencion` | `_org` | `_profesional` | `idx_abh_org_estado_atencion` on `(organizacion_id, estado, atencion_id)` (mig `20260714100002`) |

**Triggers:** `update_atenciones_boletas_honorarios_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** NO (dev-wide). GRANTs SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE a anon/authenticated/postgres/service_role (mismo patrón que `atenciones_boletas_electronicas`).

**Notes:** `whatsapp_notificado_at` (mig `20260831120000_honorario_emitido_automatizacion.sql`) — claim atómico de la automatización `honorario_emitido` (se dispara cuando la BHE llega a `sincronizada` CON `pdf_url` — el PDF solo existe si el profesional está ENROLADO en Tupana); el PDF se re-aloja en el bucket público `boletas-pdf` (creado en `20260821120000`). Receptor siempre consumidor final `66666666-6`; auto-retención `RETCONTRIBUYENTE` (14,5%, la aplica Tupana). `emisor_rut` = `profesionales.honorarios_rut`. Tupana resuelve razón social/giro/dirección desde el SII por el RUT (no se almacenan). Anulación NO disponible por API → manual en el SII; `anulada_at` marca el estado local. `atenciones.honorarios_facturar_a_org = true` factura la atención completa a la org sin split (la BHE pendiente queda `descartada`). RPCs de filtro (mig `20260714100002`): `obtener_ids_atenciones_honorarios_pendientes` / `_emitidos(p_org, p_desde, p_hasta)`; `obtener_ids_atenciones_facturacion_parcial` (mig `20260714100003`) suma el bruto de las BHE vivas al total facturado para no marcar como "parcial" una atención bien documentada (org + BHE = total).

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
| montos_ajustados_iva | bool | ✗ | false |
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

