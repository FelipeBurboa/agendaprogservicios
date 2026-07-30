# Point of Sale (POS)

> 17 tables in this domain (`impresoras_configuradas` fue dropeada y NO cuenta)

### pos_devices

| Column | Type | Null | Default |
|--------|------|------|---------|
| serial_number | varchar | ✗ | - |
| notes | text | ✓ | - |
| location | text | ✓ | - |
| tipo_documento_dte | int4 | ✓ | 0 |
| config | jsonb | ✓ | `{}`::jsonb |
| transaction_count | int4 | ✓ | 0 |
| last_transaction_at | timestamptz | ✓ | - |
| last_seen_ip | inet | ✓ | - |
| last_seen_at | timestamptz | ✓ | - |
| deactivated_at | timestamptz | ✓ | - |
| activated_at | timestamptz | ✓ | - |
| created_by | uuid | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| status | USER-DEFINED | ✗ | `active`::pos_status |
| model | USER-DEFINED | ✗ | - |
| brand | USER-DEFINED | ✗ | - |
| token_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** token_id → `pos_tokens.id` | created_by → `usuarios.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`unique_serial_per_org`) on organizacion_id | UNIQUE(`unique_serial_per_org`) on serial_number |

### pos_devices_view

| Column | Type | Null | Default |
|--------|------|------|---------|
| model | USER-DEFINED | ✓ | - |
| brand | USER-DEFINED | ✓ | - |
| token_id | uuid | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| id | uuid | ✓ | - |
| created_by | uuid | ✓ | - |
| last_seen_at | timestamptz | ✓ | - |
| updated_at | timestamptz | ✓ | - |
| serial_number | varchar | ✓ | - |
| created_at | timestamptz | ✓ | - |
| last_seen_ip | inet | ✓ | - |
| last_transaction_at | timestamptz | ✓ | - |
| transaction_count | int4 | ✓ | - |
| notes | text | ✓ | - |
| location | text | ✓ | - |
| token_hint | varchar | ✓ | - |
| organizacion_nombre | text | ✓ | - |
| config | jsonb | ✓ | - |
| activated_at | timestamptz | ✓ | - |
| tipo_documento_dte | int4 | ✓ | - |
| token_last_regenerated | timestamptz | ✓ | - |
| deactivated_at | timestamptz | ✓ | - |
| status | USER-DEFINED | ✓ | - |

### pos_audit_log

| Column | Type | Null | Default |
|--------|------|------|---------|
| ip_address | inet | ✓ | - |
| performed_by | uuid | ✓ | - |
| performed_at | timestamptz | ✗ | now() |
| details | jsonb | ✓ | `{}`::jsonb |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| pos_token_id | uuid | ✓ | - |
| action | varchar | ✗ | - |
| pos_device_id | uuid | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | pos_token_id → `pos_tokens.id` | pos_device_id → `pos_devices.id` | performed_by → `usuarios.id` |

### pos_tokens

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_by | uuid | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| model | USER-DEFINED | ✗ | - |
| brand | USER-DEFINED | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| token_hint | varchar | ✓ | - |
| token | text | ✓ | - |
| active_devices | int4 | ✓ | 0 |
| total_devices | int4 | ✓ | 0 |
| regenerated_by | uuid | ✓ | - |
| last_regenerated_at | timestamptz | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | created_by → `usuarios.id` | regenerated_by → `usuarios.id` |

**Constraints:** UNIQUE(`unique_token_per_org_brand_model`) on model | UNIQUE(`unique_token_per_org_brand_model`) on brand | UNIQUE(`unique_token_per_org_brand_model`) on organizacion_id |

### autopago_configs

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| enabled | bool | ✗ | false |
| public_token | text | ✗ | - |
| pos_device_id | uuid | ✓ | - |
| sucursal_id | uuid | ✓ | - |
| config | jsonb | ✗ | `{}`::jsonb |
| mesa_id | uuid | ✓ | - |
| usuario_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | pos_device_id → `pos_devices.id` (SET NULL) | sucursal_id → `sucursales.id` (SET NULL) | mesa_id → `profesionales.id` (SET NULL) | usuario_id → `usuarios.id` (SET NULL) |

**Indexes:** `idx_autopago_configs_usuario_id` parcial on `(usuario_id) WHERE usuario_id IS NOT NULL` (mig `20260611193000`) |

**Constraints:** UNIQUE on organizacion_id (one config per org) | UNIQUE on public_token |

**Notes:** Public self-service POS kiosk config. `public_token` exposes the kiosk endpoint without auth; gate sensitive fields behind RLS. `mesa_id` (mig `20260713120000_autopago_platos.sql`, FK `profesionales` SET NULL) — mesa a la que se enganchan los pedidos de PLATOS del kiosko: cuando el autopago vende platos, al pagarse la `ventas_externas`, `crear_atencion_kiosko_platos` crea la atención de kiosko sobre esta mesa para que cocina reciba la comanda y se descuente el stock de ingredientes.

### configuracion_tickets

> Config por organización del contenido de los tickets térmicos (pre-cuenta + comanda). Migración `20260716120000_configuracion_tickets.sql`. Una fila por org; sin fila ⇒ defaults hardcodeados (`DEFAULT_TICKET_CONFIG` en `src/services/printing/ticketConfig.ts`) = el ticket actual. La firma RestoPlay NO es configurable (hardcodeada en el builder).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| precuenta | jsonb | ✗ | `{}`::jsonb |
| comanda | jsonb | ✗ | `{}`::jsonb |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE on `organizacion_id` (una fila por org) |

**Triggers:** `update_configuracion_tickets_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** ENABLED. Cuatro policies org-scoped (SELECT/INSERT/UPDATE/DELETE) gateadas por `is_super_admin() OR get_current_custom_user_organization() = organizacion_id` (mismo patrón org-scoped que `impresoras_configuradas`).

**Notes:** `precuenta` / `comanda` jsonb llevan mensajes editables + toggles de campos del ticket. Consumida por el motor de impresión (`src/services/printing/`).

### ~~impresoras_configuradas~~ — TABLA ELIMINADA

> ⚠️ **No existe.** `DROP TABLE ... CASCADE` en `20260817120000_drop_impresoras_configuradas.sql` (irreversible). Era el inventario del modelo de impresión **legacy** (roles fijos `mesa-precuenta`/`comanda-cocina`); su código consumidor (`usePrinterAdmin`, `impresorasConfiguradasRepository`, `legacyDestinationMigration`) también se eliminó. Reemplazada por `impresion_destinos` + `impresion_destino_categorias` + `comanda_print_jobs` (§Impresión V2). Si un query o tipo la menciona, está muerto. Ver `.claude/skills/ventaplay-printing/SKILL.md` + `ADMIN-IMPRESORAS.md`.

## Impresión V2 (destinos configurables + jobs por destino)

> Migraciones `20260629120000_impresion_destinos_v2.sql` (3 tablas + RLS), `20260630120000_impresion_destinos_v2_permissions_guards.sql` (GRANTs + unique parcial legacy) y `20260707120000_comanda_print_jobs_cleanup.sql` (estado `cancelled` + trigger + janitor pg_cron). Reemplaza el modelo legacy de 2 roles fijos (`mesa-precuenta`/`comanda-cocina` en localStorage + flag `comanda_impresa`) por **destinos** por terminal con ruteo por categoría de producto y una **cola de jobs por destino**. No altera el flag `comanda_impresa` (sigue siendo el punto de sync); la tabla legacy `impresoras_configuradas` fue dropeada en `20260817120000`.

### impresion_destinos

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| terminal_id | text | ✗ | - |
| terminal_nombre | text | ✓ | - |
| nombre | text | ✗ | - |
| transport_type | text | ✗ | - |
| vendor_id | int4 | ✓ | - |
| product_id | int4 | ✓ | - |
| serial_number | text | ✓ | - |
| device_index | int4 | ✓ | - |
| manufacturer_name | text | ✓ | - |
| product_name | text | ✓ | - |
| host | text | ✓ | - |
| port | int4 | ✓ | 9100 |
| supports_precuenta | bool | ✗ | false |
| supports_comanda | bool | ✗ | false |
| legacy_role | text | ✓ | - |
| activo | bool | ✗ | true |
| metadata | jsonb | ✗ | `{}`::jsonb |
| last_seen_at | timestamptz | ✓ | - |
| bridge_id | uuid | ✓ | - |
| mac_address | text | ✓ | - |
| system_name | text | ✓ | - |
| impreso_por_bridge | bool | ✗ | false |
| last_ok_at | timestamptz | ✓ | - |
| last_error_at | timestamptz | ✓ | - |
| last_error_motivo | text | ✓ | - |
| last_error_detalle | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) | bridge_id → `print_bridges.id` (ON DELETE SET NULL) |

**Constraints:** CHECK `transport_type IN ('usb','network')` | CHECK `legacy_role IN ('mesa-precuenta','comanda-cocina')` (NULL permitido) | CHECK `last_error_motivo IS NULL OR last_error_motivo IN ('sin_conexion','problema')` (mig `20260920120105`) | UNIQUE parcial `impresion_destinos_org_terminal_legacy_role_unique` on `(organizacion_id, terminal_id, legacy_role) WHERE legacy_role IS NOT NULL` (mig `20260630120000` — evita duplicar destinos legacy por doble clic en "Convertir legacy") |

**Indexes:** `idx_impresion_destinos_org_terminal_activo` on `(organizacion_id, terminal_id, activo)` | `idx_impresion_destinos_org_legacy_role` parcial on `(organizacion_id, legacy_role) WHERE legacy_role IS NOT NULL` | parcial on `(bridge_id) WHERE bridge_id IS NOT NULL` (mig `20260920120100`) |

**Columnas del Print Server (migs `20260920120100`, `20260920120105`):** `bridge_id` engancha el destino a un `print_bridges` — **si es NOT NULL, el destino lo imprime el bridge, no el navegador** (discriminador V2-navegador vs V3-bridge en el janitor y en las RPCs). `mac_address` / `system_name` identifican la impresora física dentro del bridge (la MAC permite reencontrarla tras un cambio de IP por DHCP). `impreso_por_bridge` marca el modo. `last_ok_at` / `last_error_at` / `last_error_motivo` / `last_error_detalle` = estado de conexión que escribe el bridge vía `print_bridge_destino_estado` / `print_bridge_job_done` (el detalle se trunca a 200 chars).

**Triggers:** `update_impresion_destinos_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** ENABLED, 4 policies org-scoped (`is_super_admin() OR get_current_custom_user_organization() = organizacion_id`). **GRANTs** SELECT/INSERT/UPDATE/DELETE a `anon, authenticated, service_role` (mig `20260630120000` — sin esto el rol `anon` daba 42501 pese al RLS).

**Notes:** Un destino = una impresora física asignada a un terminal, con capacidades independientes `supports_precuenta` / `supports_comanda` (puede hacer ambas). `legacy_role` marca destinos migrados desde el modelo V1 de roles. Mismo set de columnas de transporte que `impresoras_configuradas` (USB ids o `host`/`port`).

### impresion_destino_categorias

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| destino_id | uuid | ✗ | - |
| categoria_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | destino_id → `impresion_destinos.id` (CASCADE) | categoria_id → `categorias_productos.id` (CASCADE) |

**Constraints:** UNIQUE(`impresion_destino_categorias_destino_categoria_unique`) on `(destino_id, categoria_id)` |

**Indexes:** `idx_impresion_destino_categorias_org_categoria` on `(organizacion_id, categoria_id)` | `idx_impresion_destino_categorias_destino` on `(destino_id)` |

**RLS:** ENABLED, 4 policies org-scoped (mismo patrón que `impresion_destinos`). GRANTs CRUD a `anon, authenticated, service_role`.

**Notes:** Ruteo de comandas: qué categorías de plato/producto imprimen comanda en cada destino (ej. bar imprime solo "Bebidas", cocina imprime "Platos"). N:M destino ↔ `categorias_productos`.

### comanda_print_jobs

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| destino_id | uuid | ✗ | - |
| atencion_id | uuid | ✗ | - |
| item_type | text | ✗ | - |
| item_id | uuid | ✗ | - |
| status | text | ✗ | `pending` |
| claimed_by_terminal_id | text | ✓ | - |
| claimed_at | timestamptz | ✓ | - |
| printed_at | timestamptz | ✓ | - |
| error_message | text | ✓ | - |
| retry_count | int4 | ✗ | 0 |
| datos | jsonb | ✓ | - |
| grupo_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | destino_id → `impresion_destinos.id` (CASCADE) | atencion_id → `atenciones.id` (CASCADE) |

**Constraints:** CHECK `item_type IN ('atencion_platos','consumos','precuenta')` (`precuenta` agregado en mig `20260928150000` vía DROP+ADD) | CHECK `status IN ('pending','claimed','printed','error','cancelled')` (`cancelled` agregado en mig `20260707120000` vía DROP+ADD del check) | UNIQUE(`comanda_print_jobs_destino_item_unique`) on `(destino_id, item_type, item_id)` |

**Realtime:** tabla publicada en `supabase_realtime` con `REPLICA IDENTITY FULL` (mig `20260920120100`) — el bridge escucha inserts en vez de pollear.

**Columnas V3 (mig `20260928150000`):** `datos jsonb` = **snapshot del ticket ya armado por la BD** (el trigger lo construye: `mesaNombre`, `meseroNombre`, `grupoNombre`, `negocioNombre`, `numeroComensales`, `productos[]`; para pre-cuenta además `razonSocial`, `rutEmpresa`, `telefono`, `mostrarPropina`, `nombreCliente`, `atendidoPor`, `total`). El bridge imprime lo que viene en `datos` — no consulta la atención. `grupo_id` (sin FK) referencia `grupos_trabajo` para partir la comanda por grupo de trabajo. Jobs con `datos IS NULL` son V2 (navegador); `print_bridge_pending_jobs_v3` solo devuelve los que tienen `datos`.

**Indexes:** `idx_comanda_print_jobs_org_destino_status` on `(organizacion_id, destino_id, status, created_at)` | `idx_comanda_print_jobs_org_atencion` on `(organizacion_id, atencion_id)` | `idx_comanda_print_jobs_pending` parcial on `(organizacion_id, destino_id) WHERE status IN ('pending','error')` (cola del consumidor — `cancelled` queda excluido naturalmente) |

**Triggers:** `update_comanda_print_jobs_updated_at` (BEFORE UPDATE) |

**RLS:** ENABLED, 4 policies org-scoped. GRANTs CRUD a `anon, authenticated, service_role`.

**Notes:** Estado de impresión de comanda **por destino e ítem** (un mismo ítem puede generar N jobs si rutea a N destinos). `item_id` es UUID polimórfico discriminado por `item_type` — apunta a `atencion_platos.id` o `consumos.id`, **sin FK** (el ítem puede borrarse físicamente). Reemplaza `comanda_impresa` como fuente multi-destino. Ciclo de vida: `pending → claimed (claimed_by_terminal_id/claimed_at) → printed (printed_at)` con `error` + `retry_count` para reintentos y `cancelled` como segundo estado terminal (no infla conteos de impresos ni toca `comanda_impresa` legacy).

**Garbage collection anti head-of-line blocking (mig `20260707120000`, post-mortem Casona Asturias jun 2026):** el consumidor (`runV2ComandaCycle`) trae los 50 `pending` más viejos por destino; jobs huérfanos (atención cancelada/finalizada después de encolar) tapaban la ventana y las comandas nuevas jamás se imprimían. Defensa en capas: **(1)** trigger `cancel_comanda_jobs_on_cancelada` AFTER UPDATE OF `estado` ON `atenciones` (WHEN pasa a `cancelada`) → función SECURITY DEFINER `cancel_comanda_jobs_on_atencion_cancelada()` cancela los jobs abiertos (`pending|claimed|error`) de esa atención; **(3)** janitor pg_cron `cleanup-comanda-print-jobs` cada 10 min: (a) cancela jobs abiertos de atenciones `cancelada|finalizada` con >15 min de gracia (finalizadas NO se cancelan en el trigger — la comanda pudo recién enviarse), (b) TTL duro: cualquier job abierto >6 h → `cancelled`. La capa (2) — no re-encolar jobs muertos — vive en la app (`printEngineV2`).

**Janitor — versión vigente (mig `20260928150800`, tras `20260920120100`):** el cron `cleanup-comanda-print-jobs` (cada 10 min) se reescribió dos veces y hoy corre 4 sentencias: (a) cancelar huérfanos de atenciones `cancelada|finalizada` con >15 min de gracia **solo si `impresion_destinos.bridge_id IS NULL`**, (b) TTL duro >6 h **también solo para destinos legacy sin bridge**, (c) expiración global a los **7 días** (`status='cancelled'`, `error_message='Venció: nadie lo llevó a estado final en 7 días'`), (d) purga física `DELETE` de `printed|cancelled` con >14 días, `LIMIT 500`. El punto: **el janitor ya no cancela jobs de destinos con bridge** — un bridge apagado un rato no pierde sus comandas; solo la expiración de 7 días las alcanza.

**Creación de jobs en BD (mig `20260818130000_comanda_print_jobs_trigger.sql`, post-mortem Café Marisol jul-2026):** trigger `trg_crear_comanda_print_jobs` AFTER INSERT OR UPDATE OF `comanda_lista` ON `atencion_platos` → `crear_comanda_print_jobs_para_plato()` (SECURITY DEFINER). Antes los jobs los creaba SOLO el navegador en su ciclo de 5s que mira atenciones `en_curso|reabierto` — si el mozo cerraba la mesa antes de que el ciclo despertara (8–20s medidos), la atención pasaba a `finalizada`, salía de la consulta y el job NUNCA se creaba → comanda perdida. Ahora el job nace en la MISMA transacción que inserta el plato (o que lo marca `comanda_lista=true`). Replica `pickDefaultComandaDestino` + `resolveDestinoIdsForItem` de `printRouting.ts`: skip si `comanda_lista≠true` / `comanda_impresa=true` / `categorias_productos.imprimir_en_comanda=false`; un job por destino activo `supports_comanda` cuya categoría matchee en `impresion_destino_categorias`; fallback en cascada `legacy_role='comanda-cocina'` → `nombre ~* 'cocina'` → primer activo. **Convive con el motor del navegador** (que sigue creando jobs por su lado) vía `ON CONFLICT (destino_id, item_type, item_id) DO NOTHING`. Solo cubre `atencion_platos` (no `consumos`); orgs sin destinos de comanda nunca lo ejecutan.

## POS Print Bridge (Kozen) — comprobante de pago POS

> Migraciones `20260804120000_pos_print_bridge.sql` (2 tablas + RLS) y `20260804130000_pos_print_bridge_rpcs.sql` (RPCs del vinculador). Impresión del **comprobante de pago POS detallado** a través de una APK puente que corre en el equipo **Kozen** (Pro 2) e imprime con la librería Kozen. **No confundir con Impresión V2** (`impresion_destinos`/`comanda_print_jobs`, comandas de restaurante por WebUSB/red): esto es el recibo del cobro POS. La APK NO usa JWT de Supabase — se autentica con `(device_serial + pairing_token)` contra la edge function `pos-print-jobs` (service_role).

### pos_print_bridges

> Emparejamiento: un registro por equipo que corre la APK puente.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| pos_device_id | uuid | ✓ | - |
| device_serial | text | ✗ | - |
| pairing_token | text | ✗ | - |
| nombre | text | ✓ | - |
| activo | bool | ✗ | true |
| usuario_id | uuid | ✓ | - |
| usar_app | bool | ✗ | false |
| last_seen_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) | pos_device_id → `pos_devices.id` (ON DELETE SET NULL) | usuario_id → `usuarios.id` (ON DELETE SET NULL) |

`usuario_id` + `usar_app` (mig `20260818120001_pos_bridge_modo_propio.sql`): `usuario_id` = override opcional del usuario al que se atribuye el cobro (NULL → usuario de sistema, mismo patrón que autopago). `usar_app` = toggle "Utilizar app" del POS: `true` = **MODO PROPIO** (la APK cobra vía inter-app y consume la cola `pos_cobros`), `false` = MODO INTEGRACIÓN (cloud RemotePayment, comportamiento previo).

**Constraints:** UNIQUE(`pos_print_bridges_serial_unique`) on `device_serial` (un emparejamiento por serial) |

**RLS:** ENABLED. Una policy `pos_print_bridges_org_isolation` `FOR ALL` `USING (organizacion_id IN (SELECT usuarios.organizacion_id FROM usuarios WHERE usuarios.id = auth.uid()))` (mismo patrón que `pos_devices_org_isolation`). El CRM autenticado ve solo su org; las edge functions usan service_role (bypassean RLS); el vinculador usa los RPCs SECURITY DEFINER.

**RPCs (mig `20260804130000`, firmas actuales de `20260818120001` — DROP+CREATE, SECURITY DEFINER, `search_path=public`, GRANT EXECUTE a `authenticated`):**
- `upsert_print_bridge(p_organizacion_id, p_pos_device_id, p_device_serial, p_pairing_token, p_nombre DEFAULT NULL, p_usar_app boolean DEFAULT NULL) → TABLE(id uuid, device_serial text, pairing_token text, activo bool, usar_app bool)` — crea o actualiza el emparejamiento por `device_serial` (`ON CONFLICT (device_serial) DO UPDATE`, re-activa `activo=true`; `p_usar_app NULL` preserva el valor guardado). RAISE si falta org/serial/token.
- `get_print_bridge(p_organizacion_id, p_device_serial) → TABLE(id, device_serial, pairing_token, activo, usar_app)` — lee el emparejamiento de un equipo dentro de la org.

### pos_print_jobs

> Cola de trabajos de impresión. Un job por `ingreso_id` (idempotencia ante reintentos de `create-pos-payment`).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| pos_device_id | uuid | ✓ | - |
| device_serial | text | ✗ | - |
| ingreso_id | uuid | ✓ | - |
| payload | jsonb | ✗ | - |
| status | text | ✗ | `pending_payment` |
| attempts | int4 | ✗ | 0 |
| error_message | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| ready_at | timestamptz | ✓ | - |
| printed_at | timestamptz | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) | pos_device_id → `pos_devices.id` (ON DELETE SET NULL) | ingreso_id → `ingresos.id` (ON DELETE CASCADE) |

**Constraints:** CHECK `pos_print_jobs_status_check` — `status IN ('pending_payment','ready','printed','error')` | UNIQUE parcial `pos_print_jobs_ingreso_unique` on `(ingreso_id) WHERE ingreso_id IS NOT NULL` (un job por ingreso) |

**Indexes:** `pos_print_jobs_device_ready_idx` on `(device_serial) WHERE status = 'ready'` (lo que la APK debe imprimir) |

**RLS:** ENABLED. Policy `pos_print_jobs_org_isolation` `FOR ALL` (mismo patrón org-isolation que `pos_print_bridges`).

**Notes:** Flujo: al completarse un cobro POS el backend crea el job con el detalle (`status` pasa a `ready`); la APK consulta su job pendiente por `device_serial`, lo imprime y lo marca `printed`. `payload` lleva el detalle del comprobante.

### pos_cobros

> Cola de **COBROS** del POS en MODO PROPIO (mig `20260818120000_pos_cobros.sql`, consolida las antiguas 20260815/16/18/20). El CRM encola un cobro para un equipo Kozen; la APK lo descubre en el MISMO pull que ya usa para `pos_print_jobs`, dispara el pago inter-app, imprime y registra (F3). **Claim-before-launch:** la APK marca `taken` ANTES de lanzar el pago → cero doble cobro. Solo activo con `pos_print_bridges.usar_app = true`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| pos_device_id | uuid | ✓ | - |
| device_serial | text | ✗ | - |
| atencion_id | uuid | ✓ | - |
| distribucion | jsonb | ✓ | - |
| monto | numeric | ✗ | 0 |
| propina_monto | numeric | ✗ | 0 |
| pedir_propina | bool | ✗ | false |
| descripcion | text | ✓ | - |
| estado | text | ✗ | `pending` |
| ingreso_id | uuid | ✓ | - |
| sequence_number | text | ✓ | - |
| error_message | text | ✓ | - |
| created_by_usuario_id | uuid | ✓ | - |
| taken_at | timestamptz | ✓ | - |
| done_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | pos_device_id → `pos_devices.id` (SET NULL) | atencion_id → `atenciones.id` (SET NULL) | ingreso_id → `ingresos.id` (SET NULL) | created_by_usuario_id → `usuarios.id` (SET NULL) |

**Constraints:** CHECK `estado IN ('pending','taken','done','failed','canceled','expired')` |

**Indexes:** `idx_pos_cobros_serial_estado` on `(device_serial, estado)` (pull de la APK) | `idx_pos_cobros_org` |

**RLS:** ENABLED. Escritura solo edge functions (service_role, bypass RLS); LECTURA permisiva `pos_cobros_select_all USING (true)` + `GRANT SELECT TO anon, authenticated` — el CRM (auth custom, sin `auth.uid()`) necesita pollear el estado del cobro para cerrar el modal. Mismo patrón "Desarrollo" que `atenciones`/`ingresos`.

**Notes:** `distribucion` = `[{atencionId, monto}]` para PAGO MÚLTIPLE (un cargo repartido en N atenciones, igual que el flujo cloud); NULL = cobro de 1 atención (`atencion_id`). `propina_monto` = propina fija que el CRM manda como tip (la tarjeta cobra `monto + propina_monto`); `pedir_propina` deja que el equipo la pida en pantalla. `ingreso_id` se setea al registrarse el pago (F3).

### pos_crash_reports

> Crashes reportados por la **APK del POS** (Kozen). Migración `20260924140000_pos_crash_reports.sql`. Tabla de diagnóstico pura — no participa de ningún flujo operativo.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✓ | - |
| device_serial | text | ✓ | - |
| pos_device_id | uuid | ✓ | - |
| app_version | text | ✓ | - |
| android_version | text | ✓ | - |
| thread_name | text | ✓ | - |
| message | text | ✓ | - |
| stacktrace | text | ✓ | - |
| occurred_at | timestamptz | ✓ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** ninguna. `organizacion_id` y `pos_device_id` son uuid **sin FK** a propósito: un crash puede llegar de un equipo aún no emparejado o de una org borrada, y el reporte igual debe guardarse.

**Indexes:** `(organizacion_id, created_at DESC)` |

**RLS:** ENABLED. Policy `pos_crash_reports_select` (super admin OR org propia). **GRANT SELECT** a `anon, authenticated, service_role`; **GRANT INSERT solo a `service_role`** — la APK reporta por edge function, nunca directo.

## Grupos de trabajo (split de comandas)

### grupos_trabajo

> Migración `20260614170124_grupos_trabajo.sql`. Agrupa categorías de producto en "grupos de trabajo" (ej. Cocina fría / Cocina caliente / Barra) para **partir una comanda en varios tickets** dentro del mismo destino. Ortogonal a `impresion_destino_categorias` (que decide *a qué impresora* va): el grupo decide *en cuántos tickets se corta*. Solo lo usa el motor de comandas; no toca `impresion_destinos` ni `comanda_impresa`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| nombre | text | ✗ | - |
| orden | int4 | ✓ | - |
| activo | bool | ✗ | true |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Indexes:** `idx_grupos_trabajo_org_activo` on `(organizacion_id, activo)` |

**Triggers:** `update_grupos_trabajo_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** ENABLED, 4 policies org-scoped (`is_super_admin() OR get_current_custom_user_organization() = organizacion_id`) + GRANTs CRUD a `anon, authenticated, service_role`.

**Columna relacionada:** `categorias_productos.grupo_trabajo_id uuid NULL → grupos_trabajo(id) ON DELETE SET NULL` (+ índice parcial `idx_categorias_productos_grupo_trabajo`). NULL = la categoría no se separa. El grupo resuelto viaja al job en `comanda_print_jobs.grupo_id` y su nombre queda embebido en `datos.grupoNombre`.

## Print Server (bridge) — Impresión V3

> Migraciones `20260920120100`–`20260920120107` (bridge, impresoras, comandos) y `20260928150000`–`20260928150900` (motor V3: snapshot en BD + pre-cuenta). **Cambio de modelo:** en V2 el NAVEGADOR armaba el ticket y hablaba con la impresora (WebUSB o Print Bridge local por localhost). En V3 el **servidor** arma el ticket (triggers de BD escriben `comanda_print_jobs.datos`) y un **Print Server** persistente — autenticado con su propio token, no con la sesión de un usuario — lo baja por Supabase y lo imprime. El navegador deja de ser necesario para que la comanda salga.
>
> Convivencia: un destino con `bridge_id IS NULL` sigue siendo V2 (navegador); con `bridge_id` seteado es V3. El janitor y las RPCs discriminan por esa columna.

### print_bridges

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| nombre | text | ✓ | - |
| token_hash | text | ✗ | - |
| code_hash | text | ✓ | - |
| last_seen_at | timestamptz | ✓ | - |
| activo | bool | ✗ | true |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE `print_bridges_token_hash_unique` on `(token_hash)` |

**Indexes:** `(organizacion_id, activo)` |

**Triggers:** `update_print_bridges_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** ENABLED. Policy `print_bridges_all_org` (FOR ALL, super admin OR org propia) + GRANTs CRUD a `anon, authenticated`.

**Storage:** los instaladores del bridge se sirven desde el bucket público `print-bridge` (mig `20260601201513_print_bridge_storage_bucket.sql`; límite subido a 200 MB en `20260717120000`). No es una tabla — es Storage.

**Notes:** El token del bridge se guarda **hasheado** con `hash_session_token()` — el mismo primitivo de `user_sessions`; el plaintext solo existe en el equipo. `code_hash` es la versión del código que reporta el heartbeat (para detectar bridges desactualizados).

### print_bridge_printers

> Inventario de impresoras que el bridge descubre en su máquina/LAN y reporta con `report_print_bridge_printers`.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| bridge_id | uuid | ✗ | - |
| tipo | text | ✗ | - |
| nombre | text | ✗ | - |
| mac_address | text | ✓ | - |
| host | text | ✓ | - |
| port | int4 | ✓ | 9100 |
| vendor_id | int4 | ✓ | - |
| product_id | int4 | ✓ | - |
| serial_number | text | ✓ | - |
| system_name | text | ✓ | - |
| disponible | bool | ✓ | - |
| last_seen_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | bridge_id → `print_bridges.id` (CASCADE) |

**Constraints:** CHECK `tipo IN ('usb','network')` | UNIQUE parcial `print_bridge_printers_red_por_mac` on `(bridge_id, mac_address) WHERE tipo='network' AND mac_address IS NOT NULL AND mac_address <> ''` | UNIQUE `print_bridge_printers_unique` on los 8 campos de identidad (`bridge_id, tipo, coalesce(mac_address,''), coalesce(host,''), coalesce(vendor_id,-1), coalesce(product_id,-1), coalesce(serial_number,''), coalesce(system_name,'')`) `WHERE NOT (tipo='network' AND mac_address IS NOT NULL AND mac_address <> '')` |

**RLS:** ENABLED. Policy `print_bridge_printers_select_org` (SELECT: super admin OR org propia OR org del bridge) + GRANTs CRUD a `anon, authenticated`.

**Notes — fusión por MAC (mig `20260920120107`):** el índice original de 8 columnas duplicaba la impresora de red cada vez que el DHCP le cambiaba la IP. Ahora las de red con MAC se identifican SOLO por `(bridge_id, mac_address)` y el upsert actualiza el `host` → el cambio de IP se auto-cura. `disponible` (mig `20260920120106`) es nullable = desconocido; el reporte marca `false` a las que no se ven hace más de 1 minuto.

### print_bridge_commands

> Cola de órdenes CRM → bridge (mig `20260920120103`, ampliada en `20260920120104`).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| bridge_id | uuid | ✗ | - |
| comando | text | ✗ | - |
| status | text | ✗ | `pending` |
| payload | jsonb | ✓ | - |
| resultado | jsonb | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| done_at | timestamptz | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | bridge_id → `print_bridges.id` (CASCADE) |

**Constraints:** CHECK `comando IN ('scan','update','test')` (DROP+ADD en mig `20260920120104`; era solo `scan`) | CHECK `status IN ('pending','done','error')` |

**Indexes:** parcial `(bridge_id, status) WHERE status='pending'` |

**Realtime:** publicada en `supabase_realtime` + `REPLICA IDENTITY FULL` — el bridge reacciona al comando sin pollear.

**RLS:** ENABLED. `print_bridge_commands_all_org` (FOR ALL, org) + `_select_bridge` / `_update_bridge` (por `current_bridge_organizacion()`) + GRANTs CRUD a `anon, authenticated`.

**Notes:** `payload` lleva los parámetros del comando (para `test`: `{destino_id}`). `scan` = re-descubrir impresoras; `update` = auto-actualizarse.

### Identidad del bridge y RLS

El bridge NO usa sesión de usuario: se autentica con su token y opera con un JWT cuyo claim `organizacion_id` lee el helper **`current_bridge_organizacion() → uuid`** (sql STABLE, lee `request.jwt.claims`). Sobre ese helper se agregaron policies extra: `comanda_print_jobs_select_bridge` (SELECT), `comanda_print_jobs_update_bridge` (UPDATE) e `impresion_destinos_select_bridge` (SELECT) — todas `organizacion_id = current_bridge_organizacion()`.

### RPCs del Print Server

| RPC | Firma | Notas |
|---|---|---|
| `authenticate_print_bridge` | `(p_token text) → TABLE(bridge_id uuid, organizacion_id uuid, nombre text)` | match por `token_hash = hash_session_token(p_token)` + `activo`. SECDEF. **REVOKEd** de public/anon/authenticated |
| `register_print_bridge` | `(p_organizacion_id uuid, p_token text, p_nombre text DEFAULT NULL) → uuid` | alta desde el CRM. GRANT a `authenticated` |
| `print_bridge_heartbeat` | `(p_bridge_id uuid, p_code_hash text DEFAULT NULL) → void` | DROP+CREATE en `20260920120101` (antes `p_version`). REVOKEd |
| `report_print_bridge_printers` | `(p_bridge_id uuid, p_printers jsonb) → integer` | upsert two-pass (MAC primero). Claves JSON: `tipo, nombre, mac, host, port, vendor_id, product_id, serial_number, system_name, disponible`. REVOKEd |
| `print_bridge_pending_jobs` | `(p_bridge_id uuid) → TABLE(job_id, destino_id, atencion_id, item_type, item_id)` | **V2**: status `pending|error`, reclama `claimed` con lease de 90 s, LIMIT 50. REVOKEd |
| `print_bridge_pending_jobs_v3` | `(p_bridge_id uuid) → TABLE(id, organizacion_id, destino_id, atencion_id, item_type, item_id, grupo_id, datos, status)` | **V3**: solo jobs con `datos IS NOT NULL`, status `pending|error|claimed`, LIMIT 200, sin lease. ⚠️ el `DROP+CREATE` de `20260928150900` (que agregó `status`) **no re-emitió los GRANTs** de `20260928150400` — verificar permisos si da 42501 |
| `print_bridge_destinos` | `(p_bridge_id uuid) → TABLE(id, nombre, transport_type, host, port, system_name, supports_comanda, supports_precuenta)` | destinos que le tocan a ese bridge |
| `print_bridge_job_done` | `(p_bridge_id uuid, p_job_ids uuid[], p_ok boolean, p_error_message text DEFAULT NULL, p_error_motivo text DEFAULT NULL) → integer` | reescrita 3 veces (`20260920120102` → `20260928150600` → `20260928150700`; vale la última). Marca `printed`/`error` (+`retry_count`, mensaje a 500 chars), estampa el estado de conexión en `impresion_destinos`, **apaga `atenciones.precuenta_print_pending`** en jobs de pre-cuenta, limpia `error_message` al imprimir OK, y sincroniza `comanda_impresa` solo cuando TODOS los jobs hermanos están `printed` |
| `print_bridge_destino_estado` | `(p_bridge_id uuid, p_destino_id uuid, p_ok boolean, p_error text DEFAULT NULL) → boolean` | ping de conexión; en fallo siempre estampa motivo `sin_conexion`. REVOKEd |
| `print_bridge_command_done` | `(p_bridge_id uuid, p_command_id uuid, p_ok boolean, p_resultado jsonb DEFAULT NULL) → void` | cierra un `print_bridge_commands`. REVOKEd |

### Triggers V3 (el ticket lo arma la BD)

- **`crear_comanda_print_jobs_para_plato()`** (reescrita en `20260928150100`, sigue colgando de `trg_crear_comanda_print_jobs` ON `atencion_platos`) — además de rutear por categoría, ahora resuelve el `grupos_trabajo` y **construye `datos`** con el ticket completo. Sigue respetando `comanda_lista`, `comanda_impresa` y `categorias_productos.imprimir_en_comanda`, con el mismo fallback en cascada a un destino de cocina y `ON CONFLICT DO NOTHING`.
- **`crear_comanda_print_jobs_para_consumo()`** + trigger `trg_crear_comanda_print_jobs_consumo` AFTER INSERT ON `consumos` (mig `20260928150200`) — **novedad**: los `consumos` (productos vendidos en la mesa) ahora también generan comanda; en V2 solo lo hacían los `atencion_platos`.
- **`crear_precuenta_print_job()`** + trigger `trg_crear_precuenta_print_job` AFTER UPDATE OF `precuenta_print_pending` ON `atenciones` (migs `20260928150300` / `20260928150500`) — al levantarse el flag crea un job `item_type='precuenta'`, `item_id = atencion_id`, **uno por cada destino** activo con `supports_precuenta` y `bridge_id IS NOT NULL`; respeta el filtro parcial `atenciones.precuenta_print_items`. El `ON CONFLICT` reabre el job (`status='pending'`, `datos` fresco, `error_message`/`printed_at` en NULL) → reimprimir pre-cuenta es volver a levantar el flag.

