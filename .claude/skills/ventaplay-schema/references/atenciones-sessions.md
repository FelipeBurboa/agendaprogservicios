# Atenciones (Sessions/Appointments)

> 9 tables in this domain

### atenciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| fecha_fin | timestamptz | ✓ | - |
| motivo_cancelacion | text | ✓ | - |
| notas_atencion | text | ✓ | - |
| profesional_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| cliente_id | uuid | ✗ | - |
| estado | text | ✗ | `en_curso`::text |
| es_venta_productos | bool | ✗ | false |
| cita_id | uuid | ✓ | - |
| fecha_inicio | timestamptz | ✗ | now() |
| estado_pago | text | ✓ | `por_pagar`::text |
| id | uuid | ✗ | gen_random_uuid() |
| total_consumo | numeric | ✗ | 0.00 |
| numero_comensales | int2 | ✓ | - |
| precuenta_print_pending | boolean | ✗ | false |
| precuenta_print_items | jsonb | ✓ | - |
| finalizado_por_id | uuid | ✓ | - |
| finalizado_por_nombre | text | ✓ | - |
| atendido_por_nombre | text | ✓ | - |
| honorarios_facturar_a_org | boolean | ✗ | false |
| venta_externa_origen_id | uuid | ✓ | - |
| cotizacion_origen_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** cita_id → `citas.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` | cliente_id → `clientes.id` | venta_externa_origen_id → `ventas_externas.id` (SET NULL) | cotizacion_origen_id → `cotizaciones.id` (SET NULL) |

**Constraints:** CHECK `atenciones_numero_comensales_check`: `numero_comensales IS NULL OR (numero_comensales BETWEEN 1 AND 999)` (restaurant covers count; nullable for non-restaurant flows) | CHECK `check_estado_pago`: `estado_pago IN ('por_pagar','abonado','pagado','sobreabonado','cerrado_sin_pago')` — **5 valores**, `cerrado_sin_pago` agregado por DROP+ADD en mig `20260925120000` |

**Indexes (orígenes):** UNIQUE parcial `uniq_atenciones_venta_externa_origen` on `(venta_externa_origen_id) WHERE NOT NULL` | UNIQUE parcial `uniq_atenciones_cotizacion_origen` on `(cotizacion_origen_id) WHERE NOT NULL` |

**Notes (recent additions):**
- `precuenta_print_pending` (added 2026-05-12 in `20260512180534`) — restaurant pre-cuenta print queue flag. Toggled true when staff requests pre-cuenta; the next available terminal picks it up via the WebUSB printer hook + clears it.
- `precuenta_print_items` (mig `20260614183338`) — `jsonb NULL`. Pre-cuenta **parcial**: `{ "plato_ids": uuid[], "consumo_ids": uuid[] }` limita el ticket a esos ítems (cuenta separada). `NULL` = pre-cuenta completa. Lo lee el trigger `crear_precuenta_print_job` (V3) y el motor del navegador (V2).
- `finalizado_por_id` / `finalizado_por_nombre` (added 2026-05-12 in `20260512224140`) — records who closed/finalized the atencion. `finalizado_por_nombre` is denormalized for audit-log durability if the user is later deleted.
- `atendido_por_nombre` (mig `20260530163622`) — `text NULL` denormalizado: quién atendió, para sobrevivir el borrado del profesional y para imprimirlo en la pre-cuenta (`datos.atendidoPor`).
- `estado_pago = 'cerrado_sin_pago'` (mig `20260925120000`) — cierre administrativo de una atención que **nunca se va a cobrar** (incobrable, cortesía, error). `calcular_estado_pago_atencion` fue reescrita para **preservar** ese estado mientras `total_pagado <= 0` (si después entra un pago, el estado se recalcula normalmente).
- `honorarios_facturar_a_org` (added 2026-06 in `20260714100001`) — `boolean NOT NULL DEFAULT false`. Si true, la atención se factura COMPLETA a la organización sin split de honorarios (resolución manual del dropdown "Facturar a la organización"); las BHE pendientes quedan `descartada`. Ver `atenciones_boletas_honorarios` en [payments-billing.md](payments-billing.md).
- `venta_externa_origen_id` (added 2026-06 in `20260713120000_autopago_platos.sql`) — atención de "kiosko" creada por `crear_atencion_kiosko_platos` al pagarse una `ventas_externas` con platos (autopago). UNIQUE parcial (idempotencia: una venta → ≤1 atención). Gatilla guards en triggers: `calcular_estado_pago_atencion` → `'pagado'` (se factura vía la venta_externa) y `queue_auto_boleta_on_finalize` no encola boleta automática (evita DTE duplicado). El cron `finalizar_atenciones_kiosko` la cierra al imprimirse las comandas (o tras 2h).
- `cotizacion_origen_id` (added 2026-06 in `20260720120000_cotizacion_a_atencion.sql`) — atención generada al convertir una cotización (RPC `convertir_cotizacion_en_atencion(p_cotizacion_id, p_actor_user_id) → jsonb`, SECURITY DEFINER, idempotente). Crea la atención `en_curso` + `consumos` reconciliando el redondeo para que `Σ consumos.precio_final == cotizaciones.total_final` (última línea absorbe el resto); usa `organizaciones.profesional_sin_asignar_id` (centinela "Sin asignar") cuando la cotización no trae profesional; devuelve las líneas de PRODUCTO para que el frontend descuente stock. UNIQUE parcial (idempotencia). También disparada por el pago del anticipo vía el trigger BEFORE `tr_link_pagos_cotizacion_on_paid` (ver [payments-billing.md](payments-billing.md)).
- **Notification trigger (migs `20260805120000` + `20260806120000`):** `trg_notificar_evento_atencion` (AFTER INSERT OR UPDATE) inserta en `notificaciones` (feed de la app móvil). **(A) Derivación** — UPDATE con `profesional_id` distinto (vía "Derivar Profesional") → `origen='derivacion'`/`tipo='asignada'` al NUEVO profesional; UPDATE-only, FUERA del gate `cita_id` (también para atenciones standalone). **(B) Estado** — SOLO atenciones con `cita_id`; ignora el INSERT (el "atender" ya emite `cita 'modificada'` por en_curso); estado→`cancelada` → `cancelada`, otro cambio de `estado` → `modificada` (incluye `finalizada`/`reabierto`). Dedup 10s por `(cita_id, profesional_id, tipo)` evita la doble notificación cuando cita y atención sincronizan estado. See [tasks-misc.md](tasks-misc.md#notificaciones).

**Realtime publication:** `atenciones` is in `supabase_realtime` (migration `20260513040225`). Restaurant cocina/mesa UIs subscribe to UPDATE events for live status sync.

### atenciones_logs

| Column | Type | Null | Default |
|--------|------|------|---------|
| usuario_id | uuid | ✗ | - |
| fecha_evento | timestamptz | ✗ | now() |
| motivo | text | ✓ | - |
| estado_nuevo | text | ✓ | - |
| estado_anterior | text | ✓ | - |
| usuario_nombre | text | ✗ | - |
| tipo_evento | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| atencion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** atencion_id → `atenciones.id` |

### ingreso_atenciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| ingreso_id | uuid | ✗ | - |
| atencion_id | uuid | ✗ | - |
| monto_aplicado | numeric | ✗ | - |
| orden | int2 | ✗ | 1 |
| created_at | timestamptz | ✓ | now() |

**FK →** ingreso_id → `ingresos.id` | atencion_id → `atenciones.id` |

**Constraints:** UNIQUE(`ingreso_atenciones_ingreso_id_atencion_id_key`) on atencion_id | UNIQUE(`ingreso_atenciones_ingreso_id_atencion_id_key`) on ingreso_id |

### atencion_platos

| Column | Type | Null | Default |
|--------|------|------|---------|
| estado_pedido | jsonb | ✓ | - |
| subtotal | numeric | ✗ | - |
| precio_unitario_snapshot | numeric | ✗ | - |
| cantidad | int4 | ✗ | 1 |
| organizacion_id | uuid | ✗ | - |
| plato_id | uuid | ✗ | - |
| atencion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| nombre_snapshot | text | ✗ | - |
| notas | text | ✓ | - |
| comanda_impresa | bool | ✗ | false |
| comanda_lista | bool | ✗ | true |

**FK →** plato_id → `platos.id` | organizacion_id → `organizaciones.id` | atencion_id → `atenciones.id` |

`comanda_impresa` (mig `20260603120000_comanda_impresa_flag.sql`) — flag para el flujo de impresión de comandas de cocina. La PC con la impresora hace polling buscando `comanda_impresa = false`, imprime y luego flippea a `true`. Las otras máquinas nunca tocan esta columna. Backfill al deploy: items en atenciones finalizadas/canceladas (`estado NOT IN ('en_curso','reabierto')`) O con `estado_pedido->>'estado' = 'LISTO'` se marcaron como `true` para evitar reimpresión en el primer ciclo. La misma columna existe en `consumos` con la misma semántica — ver [sales-products.md](sales-products.md). En Impresión V2 la fuente multi-destino es `comanda_print_jobs` — ver [pos.md](pos.md).

`comanda_lista` (mig `20260704120000_add_comanda_lista_to_atencion_platos.sql`) — fase 1 del fix de **"comandas partidas"**: la confirmación de un pedido inserta los platos uno a uno (cada insert resuelve receta + descuenta stock = lento); el ciclo de auto-impresión (5s) podía dispararse A MITAD de la inserción e imprimir una comanda parcial. Solución "todo o nada": la confirmación inserta con `comanda_lista = false` (invisible al motor de impresión) y al terminar el loop libera TODOS con un único UPDATE atómico. `DEFAULT true` → filas existentes y cualquier flujo que no use la confirmación en dos fases imprimen igual que antes; SOLO la confirmación de pedidos inserta explícitamente `false`.

### atencion_plato_componentes

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| cantidad_descontada | numeric | ✗ | - |
| unidad_medida | text | ✗ | `gramo`::text |
| nombre_producto_snapshot | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| atencion_plato_id | uuid | ✗ | - |
| origen_tipo | text | ✗ | - |
| producto_id | uuid | ✗ | - |
| plato_origen_id | uuid | ✓ | - |

**FK →** producto_id → `productos_stock.id` | plato_origen_id → `platos.id` | atencion_plato_id → `atencion_platos.id` |

### platos

| Column | Type | Null | Default |
|--------|------|------|---------|
| precio_venta | numeric | ✗ | 0 |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| rendimiento_total_gramos | numeric | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| created_at | timestamptz | ✓ | now() |
| activo | bool | ✓ | true |
| categoria_id | uuid | ✓ | - |
| nombre | text | ✗ | - |
| descripcion | text | ✓ | - |
| foto_url | text | ✓ | - |
| orden | int4 | ✓ | - |

**FK →** categoria_id → `categorias_productos.id` | organizacion_id → `organizaciones.id` |

**Indexes:** `idx_platos_categoria_orden` on `(categoria_id, orden)` |

`orden` (mig `20260615172808`) — posición del plato dentro de su categoría en la carta. La migración backfilleó `row_number()` 1..N `PARTITION BY (organizacion_id, categoria_id) ORDER BY nombre, created_at`. RPCs asociadas (ambas SECURITY DEFINER, GRANT a `anon, authenticated, service_role`): **`set_platos_orden(p_pares jsonb) → void`** (guarda el reordenamiento drag&drop) y **`platos_mas_vendidos(p_org uuid) → TABLE(plato_id uuid, vendidos numeric)`** (sugerencia de orden por ventas; raise `'Sin permiso sobre esta organización'` si la org no es la del llamante).

### plato_ingredientes

| Column | Type | Null | Default |
|--------|------|------|---------|
| producto_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| cantidad_requerida | numeric | ✗ | 1 |
| preparacion_origen_id | uuid | ✓ | - |
| preparacion_origen_gramos | numeric | ✓ | - |
| orden | int4 | ✓ | 0 |
| created_at | timestamptz | ✓ | now() |
| plato_id | uuid | ✗ | - |
| notas | text | ✓ | - |
| preparacion_origen_nombre | text | ✓ | - |
| unidad_medida | text | ✗ | `gramo`::text |

**FK →** preparacion_origen_id → `platos.id` | producto_id → `productos_stock.id` | plato_id → `platos.id` |

**Constraints:** UNIQUE(`plato_ingredientes_plato_id_producto_id_key`) on producto_id | UNIQUE(`plato_ingredientes_plato_id_producto_id_key`) on plato_id |

### plato_toppings

| Column | Type | Null | Default |
|--------|------|------|---------|
| descripcion | text | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| producto_id | uuid | ✗ | - |
| plato_id | uuid | ✗ | - |
| activo | bool | ✓ | true |
| unidad_medida | text | ✗ | `gramo`::text |
| orden | int4 | ✓ | 0 |
| cantidad_requerida | numeric | ✗ | 1 |
| precio_extra | numeric | ✗ | 0 |
| precio_carta | numeric(12,2) | ✓ | - |

**FK →** plato_id → `platos.id` | producto_id → `productos_stock.id` |

**Constraints:** UNIQUE(`plato_toppings_plato_id_producto_id_key`) on producto_id | UNIQUE(`plato_toppings_plato_id_producto_id_key`) on plato_id | CHECK `plato_toppings_precio_carta_non_negative`: `precio_carta IS NULL OR precio_carta >= 0` |

**Notes:**
- `precio_carta` is the explicit menu price shown on the carta (printed menu/UI). NULL means fall back to legacy derivation:
  - When the topping's `producto_id` is a "producto en carta" (has its own menu price), use `precio_venta × cantidad_requerida`.
  - Otherwise use `COALESCE(precio_extra, 0)`.
- Added in migration `20260417140000_plato_toppings_precio_carta.sql`; existing rows were backfilled via the same migration before NULL was retained as legacy-fallback semantic.

## Batch RPC

### get_atenciones_rows_batch(p_organizacion_id uuid, p_atencion_ids uuid[]) → jsonb

Single-call hidrator for the `/atenciones` list page. Returns 7 buckets keyed by `atencion_id::text`, consumed by `useAtencionesRowsBatch` to seed React Query caches before per-row hooks fire — collapses what would be N×7 individual fetches into one round-trip.

**Returns** (jsonb object with 7 keys):

| Bucket | Shape | Notes |
|--------|-------|-------|
| `pagos` | `Record<atencion_id, PagoAtencion[]>` | Singles directos + abonos via cita_id + distribuciones multi (ingreso_atenciones). Mirrors `useIngresosPorAtencion.ts` exactly. |
| `propinas` | `Record<atencion_id, Record<ingreso_id, monto>>` | Misma triple unión que `pagos`, agregando propinas no anuladas con `monto_propina > 0` por ingreso. |
| `giftcards` | `Record<atencion_id, GiftCard[]>` | Solo "loose" — `ingreso_id IS NULL`. Las atadas a un pago viajan dentro de la PagoAtencion. |
| `canjes` | `Record<atencion_id, Canje[]>` | Mismo criterio loose que giftcards. |
| `boletas` | `Record<atencion_id, { count, montoTotal }>` | JOIN con la tabla puente `boleta_atenciones` para que tanto boletas single como multi-atencion cuenten al sello FACTURADO. Solo `estado IN ('emitida', 'sincronizada')` con `folio NOT NULL`. `montoTotal = SUM(detalle_items[*].total_price)`. |
| `fresca` | `Record<atencion_id, { id, estado_pago, updated_at }>` | Status poll para resolver el `estadoPagoActual` consolidado en `useAtencionCardData`. |
| `packInfo` | `Record<atencion_id, { esPack, packComisionIndividual }>` | **(v4)** Solo entradas que SON pack — el cliente completa con `{ esPack: false, packComisionIndividual: false }` para las demás vía `seedCache`. `esPack = (pack_grupo_id NOT NULL OR pack_servicio_id NOT NULL)`. `packComisionIndividual = pack_config->>'comision_por_valor_individual' = 'true'` cuando `pack_servicio_id NOT NULL`. |

**Attributes:** `STABLE SECURITY INVOKER`. No escribe; solo SELECT. Grants implícitos via PostgREST `anon|authenticated|service_role` (preservados a través de los `CREATE OR REPLACE`).

**Multi-tenant guard:** todas las secciones filtran por `organizacion_id = p_organizacion_id` para evitar leak entre orgs.

**Versions:**
- `v1` (mig `20260411120000`): bootstrap del batch con 6 buckets (sin packInfo).
- **Facturación multi-atención** (migs `20260503120000` — tabla puente `boleta_atenciones` + reescritura de las RPCs de emisión — y `20260503120002` — los filtros `obtener_ids_atenciones_facturadas`/`_pendientes` pasan a mirar el puente además de la FK directa, para que una boleta que cubre N atenciones marque las N).
- `v2` (mig `20260503120001`): rehizo PAGOS/PROPINAS pero introdujo bugs (column ref `monto_total` inexistente, shape `PagoAtencion` incompleto, propinas/giftcards/canjes duplicados). Mantuvo el cambio legítimo de BOLETAS (puente `boleta_atenciones`).
- `v3` (mig `20260516120000`): restaura el shape v1 correcto para los 5 buckets rotos por v2 + conserva el JOIN boletas v2.
- **`v4` (mig `20260521120000`):** agrega bucket `packInfo`. Todo lo demás byte-equivalent a v3.

**Cliente consumer:** `src/components/atenciones/hooks/useAtencionesRowsBatch.ts`. El hook se kickea durante el render del padre (no en useEffect — sidesteps parent-after-child effect ordering) y registra la promesa en un `Map` module-level keyed por `orgId|sorted_atencion_ids`. Per-row hooks (`useIngresosPorAtencion`, `useAtencionCardData`) llaman `awaitBatchForAtencion(orgId, atencionId)` en su `queryFn`; si encuentran promesa en flight la esperan y devuelven la slice, sino caen al fetch individual original. **Outside `/atenciones`** (single-row payment views, etc.) el Map está vacío → fallback automático sin cambios de comportamiento.

**Performance impact (v4):** elimina la cascada de ~50 requests N+1 en `/atenciones` para listas de 30 atenciones (~30 a `citas` + ~20 duplicadas a `servicios?select=pack_config&id=eq.<mismo_uuid>`). Postgres deduplica los `IN (uuid[])` internamente vía índice por PK.

---

## Payment State RPCs (canonical, 2026-05)

Tras el incidente de cobro duplicado en Club La Barba (atención `a7b165bb`, 13-may-2026), la fórmula "cuánto se pagó de una atención" fue **consolidada en una única fuente de verdad SQL** y todas las versiones TS duplicadas fueron eliminadas. Migración: `20260607120000_fix_calcular_estado_pago_reverso_pos_failed.sql`. Antes existían 4 implementaciones (1 SQL + 3 TS) y todas restaban TODOS los reversos sin chequear si el ingreso original había contado como pago positivo — cuando se anulaba un POS pending/failed/cancelled/timeout, el reverso restaba pero el original nunca había sumado → doble penalización → atención stuck en `por_pagar` → cajero cobraba de nuevo.

Las 5 RPCs forman una jerarquía vertical: el predicado en la base, las dos funciones núcleo en el medio, y las dos RPCs de borde (lectura / escritura) que consume el frontend.

### `ingreso_cuenta_como_pago(p_ingreso_id uuid) → boolean`

**Predicado canónico — única fuente de verdad de "qué cuenta como pago positivo".** Un ingreso cuenta sólo si `(tipo IS NULL OR tipo = 'ingreso') AND (pos_status IS NULL OR pos_status = 'completed')`. Si la definición de POS_FAILED cambia, se edita SOLO acá. Un reverso únicamente resta si su `ingreso_original_id` cuenta, garantizando la conservación `original=+X ⇔ reverso=-X`. `STABLE SECURITY DEFINER`. Granted a `anon, authenticated, service_role`.

### `calcular_total_pagado_atencion(p_atencion_id uuid) → numeric`

**Núcleo numérico.** Suma 4 fuentes: (1) pagos directos no-multi de la tabla `ingresos`, (2) distribuciones multi-pago vía `ingreso_atenciones`, (3) giftcards huérfanas (`ingreso_id IS NULL`), (4) canjes huérfanos. Cada rama aplica el predicado `ingreso_cuenta_como_pago` a los reversos antes de restarlos. `SECURITY DEFINER`. La usan las 3 funciones de arriba.

### `calcular_estado_pago_atencion(p_atencion_id uuid) → text`

**State-resolver.** Compara `calcular_total_pagado_atencion` contra `atenciones.total_consumo` y devuelve `'pagado' | 'abonado' | 'por_pagar' | 'sobreabonado'`. Caso especial: si `total_consumo = 0` retorna `'pagado'` directamente. Reescrita sobre el núcleo — cero duplicación de la lógica del reverso. La usan los 3 triggers existentes que mantienen sincronizado `atenciones.estado_pago`.

### `obtener_resumen_pago_atencion(p_atencion_id uuid) → TABLE`

**RPC de LECTURA para el frontend.** Reemplaza el cálculo TS de `useIngresosPorAtencion` y `packPaymentHelpers`. Devuelve breakdown completo en una sola call:

| Columna | Tipo | Notas |
|---|---|---|
| `total_ingresos` | numeric | Suma de pagos positivos que cuentan (excluye anulados POS-failed) |
| `total_reversos` | numeric | Suma de reversos positivos (no aplica signo) |
| `total_neto` | numeric | `calcular_total_pagado_atencion()` — ya con signos aplicados |
| `total_giftcards` | numeric | Solo huérfanas (`ingreso_id IS NULL`) |
| `total_canjes` | numeric | Solo huérfanos |
| `cantidad_ingresos` | integer | Count de pagos no-reverso que cuentan |
| `cantidad_reversos` | integer | Count de reversos que cuentan |
| `ultimo_pago` | timestamptz | `MAX(fecha_pago)` de pagos que cuentan |
| `tiene_reversos` | boolean | `cantidad_reversos > 0` |
| `saldo_pendiente` | numeric | `GREATEST(total_consumo - total_neto, 0)` |
| `estado_pago` | text | Calculado vía `calcular_estado_pago_atencion()` — imposible que difiera de lo que escriben los triggers |

Forma compatible con el tipo TS `ResumenPagosAtencion`. `SECURITY DEFINER`.

### `recalcular_estado_pago_atencion(p_atencion_id uuid) → text`

**RPC de ESCRITURA (calcula + persiste).** Reemplaza las ~130 líneas de `IngresosService.actualizarEstadoPagoAtencion`. Lee el estado actual de la atención, calcula el nuevo vía `calcular_estado_pago_atencion`, hace `UPDATE ... SET estado_pago = nuevo, updated_at = NOW()` **sólo si el estado cambió** (idempotente). Devuelve el estado final. `SECURITY DEFINER`. La invocan el frontend después de mutar pagos (POS confirm, anular, abonar) y la edge function `check-pos-payment` cuando el cron flippea `pos_status`.

**Flujo recomendado nuevo:**
```
Frontend muta pago → recalcular_estado_pago_atencion(atencion_id)
Frontend lee breakdown → obtener_resumen_pago_atencion(atencion_id)
```

**No usar más** (deprecated, todavía existen para no romper código legacy pero ya no son la fuente de verdad):
- `IngresosService.actualizarEstadoPagoAtencion` (TS, ~130 líneas) — reemplazado por `recalcular_estado_pago_atencion`
- Cálculos manuales en `useIngresosPorAtencion`, `packPaymentHelpers` — reemplazados por `obtener_resumen_pago_atencion`

---

## Creation RPC (API externa)

### `crear_atencion_venta(p_organizacion_id, p_cliente_id, p_profesional_id, p_servicios jsonb DEFAULT '[]', p_productos jsonb DEFAULT '[]', p_cita_id uuid DEFAULT NULL, p_notas text DEFAULT NULL, p_forzar_stock_negativo boolean DEFAULT false) → jsonb`

Mig `20260824120000_crear_atencion_venta.sql`. Crea atómicamente una atención (venta) para la **API externa `manage-atenciones` (create)**: INSERT en `atenciones` (`estado='en_curso'`, walk-in por defecto — `cita_id` NULL; `es_venta_productos=true` si SOLO hay productos) + servicios → `consumos` (precio del payload o de `servicios.precio`; `notas_consumo='API'`) + productos → `agregar_producto_consumo_con_stock` (descuento de stock atómico). **`precio_final` = unitario × cantidad (total de línea)** — el trigger `recalcular_total_atencion` suma `SUM(precio_final)`. Valida pertenencia cliente/profesional a la org; devuelve `{success, atencion_id, servicios_agregados, productos_agregados, total_consumo}` o `{success:false, code}` (`CLIENTE_NO_ENCONTRADO`, `SIN_ITEMS`, etc. — EXCEPTION handler devuelve `code:'EXCEPTION'` en vez de propagar). SECURITY DEFINER, `search_path = public, extensions`. ⚠️ **service_role-only**: recibe la org por parámetro, así que REVOKE explícito de anon/authenticated (patrón anti-IDOR de `20260814120001`); la auth real la hace la edge vía `authenticateWithApiKey`. Hermana de las RPCs móviles `crear_atencion_con_cita` / `crear_venta_productos_con_stock` (`20260731120000/120001`) pero con salida jsonb y sin canasta de cita.

## Lifecycle RPC

### `finalizar_atencion_con_log(p_atencion_id uuid, p_usuario_id uuid, p_usuario_nombre text, p_actualizar_cita boolean DEFAULT true) → TABLE`

**RPC canónico de finalización** — TODOS los puntos de finalización lo invocan (AtencionDetalle, calendario hover "Finalizada" + CitaDetalleModal, edge functions de pago en landing TUU/MercadoPago). `SECURITY DEFINER`. Acepta atenciones en `en_curso` | `reabierto`; RAISE si no existe o no está en curso. Devuelve `(atencion_id, estado_anterior, estado_nuevo, fecha_finalizacion, cita_actualizada)`.

**Evolución 2026-06 (3 reescrituras, misma firma → `CREATE OR REPLACE`):**
- **`20260627120000_finalizar_atencion_cierra_consumos.sql`** — agrega paso 3b: al finalizar, **cierra todos los consumos de servicio pendientes** de la atención (`finished_at = fecha_fin`, `duration += minutos del segmento activo` desde `work_resumed_at` o `created_at`; ver [sales-products.md](sales-products.md#consumos)). Omite ya finalizados (`finished_at IS NOT NULL` → sin doble conteo) y productos (`servicio_id IS NULL`). Espeja `aplicarFinalizacionConsumo()` de `useConsumos.ts`.
- **`20260628120000_finalizar_atencion_cierra_consumos_fix_ambiguo.sql`** — fix SQLSTATE 42702: la variable OUT `atencion_id` del `RETURNS TABLE` colisionaba con la columna sin calificar en el UPDATE de consumos. Todas las columnas de consumos quedan calificadas (`consumos.`).
- **`20260629100000_finalizar_atencion_registra_finalizado_por.sql`** — persiste `atenciones.finalizado_por_id` / `finalizado_por_nombre` **en la misma transacción** (antes: solo iba a `atencion_logs` + un UPDATE fire-and-forget del cliente → datos históricos vacíos). Sentinel: si `p_usuario_id = '00000000-...-000000000000'` (sistema), ambas columnas quedan NULL; el nombre se normaliza con `NULLIF(TRIM(...), '')`.

**Pasos actuales:** (1) lee estado + cita_id; (2) valida `en_curso|reabierto`; (3) UPDATE atención → `finalizada`, `fecha_fin`, `estado_pago = calcular_estado_pago_atencion()`, `finalizado_por_*`; (3b) cierra consumos de servicio; (4) si `p_actualizar_cita` y hay cita → `citas.estado = 'completada'`; (5) INSERT en `atencion_logs` (best-effort, tolera `undefined_table`); (6) RETURN.

### `cerrar_atencion_sin_pago(p_atencion_id uuid, p_motivo text, p_usuario_id uuid, p_usuario_nombre text) → text`

Migs `20260925120000` + `20260925130000`. SECURITY DEFINER, `search_path = public`, GRANT a `anon, authenticated, service_role`. Cierre administrativo de una atención incobrable: deja `estado_pago = 'cerrado_sin_pago'` y escribe `atencion_logs` con `evento='cierre_sin_pago'` (+ el `estado_atencion` del momento). **Guards:** `motivo` ≥4 chars, la atención debe ser de la org del llamante, estar en `finalizada` **o `reabierto`** (la segunda migración amplió el estado; error `solo_finalizada_o_reabierto`), tener `estado_pago='por_pagar'` y **cero pagos**.

### `transferir_consumos_a_mesa(p_origen_atencion uuid, p_mesa_destino uuid, p_plato_ids uuid[] DEFAULT '{}', p_consumo_ids uuid[] DEFAULT '{}', p_comensales integer DEFAULT 1) → uuid`

Mig `20260614180602`. SECURITY DEFINER, `search_path = public`. Mueve `atencion_platos` / `consumos` seleccionados a otra mesa reasignando su `atencion_id`, abre (o reusa) la atención `en_curso` de la mesa destino, y recalcula `total_consumo` + `estado_pago` en **ambas** atenciones. Devuelve el id de la atención destino. **Aborta** si la atención origen ya tiene pagos o si la mesa destino no está libre.

### `descontar_stock_platos_atencion(p_atencion_id uuid, p_organizacion_id uuid, p_sucursal_id uuid, p_usuario_id uuid, p_lineas jsonb) → void`

Mig `20261101120000`. SECURITY DEFINER. Descuenta los **ingredientes** de los platos de una atención: inserta `atencion_plato_componentes` (`unidad_medida` default `'gramo'`, `origen_tipo` default `'ingrediente'`, `nombre_producto_snapshot`) y baja el stock — por sucursal (`stock_por_ubicacion` con `SELECT … FOR UPDATE`, `variante_id IS NULL`, crea la fila si falta, **puede quedar negativo**, luego recalcula `productos_stock.cantidad_disponible` como SUM de ubicaciones) o global si `p_sucursal_id` es NULL. Siempre registra `movimientos_stock` (`tipo_movimiento='salida'`, `cantidad = -n`, `razon='consumo_atencion'`, `referencia_tipo='atencion_plato'`). **Idempotente**: salta la línea si ya existen componentes para ese `atencion_plato`. GRANT a `anon, authenticated, service_role`.

### Trigger `cancel_comanda_jobs_on_cancelada` (ON `atenciones`)

(Mig `20260707120000_comanda_print_jobs_cleanup.sql`.) AFTER UPDATE OF `estado`, WHEN pasa a `'cancelada'` → cancela (`status='cancelled'`) los `comanda_print_jobs` abiertos de la atención, evitando huérfanos que tapen la cola de impresión V2 (head-of-line blocking). Las atenciones `finalizada` NO se tocan en el trigger — las limpia el janitor pg_cron con 15 min de gracia. Detalle completo en [pos.md](pos.md#comanda_print_jobs).

---

### mermas_pedido

Immutable audit log of pedido (restaurant order) item deletions. Items are physically removed from `atencion_platos` / `consumos` and a row inserted here for forensics. Created in migration `20260512222458`; RLS relaxed to permissive in `20260512222606`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| atencion_id | uuid | ✗ | - |
| mesa_nombre | text | ✗ | '' |
| tipo_item | text | ✗ | - (CHECK `plato` \| `consumo`) |
| item_id | uuid | ✗ | - |
| item_nombre | text | ✗ | '' |
| cantidad | integer | ✗ | 1 |
| precio_unitario | numeric(12,2) | ✓ | - |
| subtotal | numeric(12,2) | ✓ | - |
| motivo | text | ✗ | - (CHECK `Error` \| `Merma` \| `Reclamo` \| `Cambio` \| `Otro`) |
| notas | text | ✓ | - |
| cancelado_por | uuid | ✓ | - |
| cancelado_por_nombre | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** none (intentionally — the codebase's restaurant-audit convention denormalizes for log-immutability resilience to upstream deletes).

**Indexes:** `idx_mermas_pedido_org_created` on `(organizacion_id, created_at DESC)` | `idx_mermas_pedido_atencion` on `(atencion_id)` |

**RLS:** enabled, permissive — `mermas_pedido_select` SELECT USING (`true`) and `mermas_pedido_insert` INSERT WITH CHECK (`true`) (relaxed from initial org-scoped policy in `20260512222606` to allow anon-evaluated reads if needed for cross-org audit views; identity is enforced at the app + RPC layer).

**Notes:**
- `tipo_item` discriminates which source table the item came from before deletion — `plato` for `atencion_platos` rows, `consumo` for `consumos` rows.
- `item_id` is **NOT a FK** — it intentionally references rows that may have been physically deleted from `atencion_platos` / `consumos` (by definition).
- `cancelado_por_nombre` is denormalized so the audit row stays readable even if the user is later deleted.
- Used by the restaurant cancel-item flow in `/restaurantes/mesas/[mesa]` — staff selects items to remove + picks a motivo + writes optional notas.

