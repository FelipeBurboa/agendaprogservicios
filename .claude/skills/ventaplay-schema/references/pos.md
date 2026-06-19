# Point of Sale (POS)

> 9 tables in this domain

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
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | pos_device_id → `pos_devices.id` (SET NULL) | sucursal_id → `sucursales.id` (SET NULL) |

**Constraints:** UNIQUE on organizacion_id (one config per org) | UNIQUE on public_token |

**Notes:** Public self-service POS kiosk config. `public_token` exposes the kiosk endpoint without auth; gate sensitive fields behind RLS.

### impresoras_configuradas

> Inventario administrativo de impresoras térmicas por terminal + rol. Migración `20260623120000_impresoras_configuradas.sql`. Complementa `localStorage` (`receiptPrinter:<org>:<role>`) — **no** es la fuente de verdad del motor de impresión en V1.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| terminal_id | text | ✗ | - |
| terminal_nombre | text | ✓ | - |
| rol | text | ✗ | - |
| nombre | text | ✓ | - |
| transport_type | text | ✗ | - |
| vendor_id | int4 | ✓ | - |
| product_id | int4 | ✓ | - |
| serial_number | text | ✓ | - |
| device_index | int4 | ✓ | - |
| manufacturer_name | text | ✓ | - |
| product_name | text | ✓ | - |
| host | text | ✓ | - |
| port | int4 | ✓ | 9100 |
| bridge_version | text | ✓ | - |
| browser_user_agent | text | ✓ | - |
| last_seen_at | timestamptz | ✓ | - |
| metadata | jsonb | ✗ | `{}`::jsonb |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE(`impresoras_configuradas_org_terminal_rol_unique`) on `(organizacion_id, terminal_id, rol)` | CHECK `rol IN ('mesa-precuenta','comanda-cocina')` | CHECK `transport_type IN ('usb','network')` |

**Indexes:** `idx_impresoras_configuradas_org_rol` on `(organizacion_id, rol)` | `idx_impresoras_configuradas_org_terminal` on `(organizacion_id, terminal_id)` |

**Triggers:** `update_impresoras_configuradas_updated_at` (BEFORE UPDATE → `update_updated_at_column()`) |

**RLS:** ENABLED. Cuatro policies org-scoped (SELECT/INSERT/UPDATE/DELETE) gateadas por `is_super_admin() OR get_current_custom_user_organization() = organizacion_id`. A diferencia de la mayoría de tablas operativas (dev wide-open), esta nace org-scoped correctamente.

**Notes:** Registro administrativo por equipo (`terminal_id`) y rol; un equipo puede tener una impresora por rol (UNIQUE `(organizacion_id, terminal_id, rol)`). Lleva tanto ids USB (`vendor_id`/`product_id`/`serial_number`/`device_index`/`manufacturer_name`/`product_name`) como coords de red (`host`/`port`), discriminados por `transport_type`. `bridge_version` + `browser_user_agent` + `last_seen_at` son telemetría diagnóstica. El motor de impresión sigue leyendo `localStorage`; esta tabla es inventario/visibilidad admin (V1). Roles válidos = los dos `PrinterRole` (`mesa-precuenta`, `comanda-cocina`). Ver `.agents/skills/ventaplay-printing/SKILL.md`. **Superseded operativamente por Impresión V2** (`impresion_destinos` + `comanda_print_jobs`, abajo) — esta tabla NO se altera ni elimina (retrocompat legacy).

## Impresión V2 (destinos configurables + jobs por destino)

> Migraciones `20260629120000_impresion_destinos_v2.sql` (3 tablas + RLS), `20260630120000_impresion_destinos_v2_permissions_guards.sql` (GRANTs + unique parcial legacy) y `20260707120000_comanda_print_jobs_cleanup.sql` (estado `cancelled` + trigger + janitor pg_cron). Reemplaza el modelo legacy de 2 roles fijos (`mesa-precuenta`/`comanda-cocina` en localStorage + flag `comanda_impresa`) por **destinos** por terminal con ruteo por categoría de producto y una **cola de jobs por destino**. Retrocompatible: no altera `impresoras_configuradas` ni `comanda_impresa`.

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
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) |

**Constraints:** CHECK `transport_type IN ('usb','network')` | CHECK `legacy_role IN ('mesa-precuenta','comanda-cocina')` (NULL permitido) | UNIQUE parcial `impresion_destinos_org_terminal_legacy_role_unique` on `(organizacion_id, terminal_id, legacy_role) WHERE legacy_role IS NOT NULL` (mig `20260630120000` — evita duplicar destinos legacy por doble clic en "Convertir legacy") |

**Indexes:** `idx_impresion_destinos_org_terminal_activo` on `(organizacion_id, terminal_id, activo)` | `idx_impresion_destinos_org_legacy_role` parcial on `(organizacion_id, legacy_role) WHERE legacy_role IS NOT NULL` |

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
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) | destino_id → `impresion_destinos.id` (CASCADE) | atencion_id → `atenciones.id` (CASCADE) |

**Constraints:** CHECK `item_type IN ('atencion_platos','consumos')` | CHECK `status IN ('pending','claimed','printed','error','cancelled')` (`cancelled` agregado en mig `20260707120000` vía DROP+ADD del check) | UNIQUE(`comanda_print_jobs_destino_item_unique`) on `(destino_id, item_type, item_id)` |

**Indexes:** `idx_comanda_print_jobs_org_destino_status` on `(organizacion_id, destino_id, status, created_at)` | `idx_comanda_print_jobs_org_atencion` on `(organizacion_id, atencion_id)` | `idx_comanda_print_jobs_pending` parcial on `(organizacion_id, destino_id) WHERE status IN ('pending','error')` (cola del consumidor — `cancelled` queda excluido naturalmente) |

**Triggers:** `update_comanda_print_jobs_updated_at` (BEFORE UPDATE) |

**RLS:** ENABLED, 4 policies org-scoped. GRANTs CRUD a `anon, authenticated, service_role`.

**Notes:** Estado de impresión de comanda **por destino e ítem** (un mismo ítem puede generar N jobs si rutea a N destinos). `item_id` es UUID polimórfico discriminado por `item_type` — apunta a `atencion_platos.id` o `consumos.id`, **sin FK** (el ítem puede borrarse físicamente). Reemplaza `comanda_impresa` como fuente multi-destino. Ciclo de vida: `pending → claimed (claimed_by_terminal_id/claimed_at) → printed (printed_at)` con `error` + `retry_count` para reintentos y `cancelled` como segundo estado terminal (no infla conteos de impresos ni toca `comanda_impresa` legacy).

**Garbage collection anti head-of-line blocking (mig `20260707120000`, post-mortem Casona Asturias jun 2026):** el consumidor (`runV2ComandaCycle`) trae los 50 `pending` más viejos por destino; jobs huérfanos (atención cancelada/finalizada después de encolar) tapaban la ventana y las comandas nuevas jamás se imprimían. Defensa en capas: **(1)** trigger `cancel_comanda_jobs_on_cancelada` AFTER UPDATE OF `estado` ON `atenciones` (WHEN pasa a `cancelada`) → función SECURITY DEFINER `cancel_comanda_jobs_on_atencion_cancelada()` cancela los jobs abiertos (`pending|claimed|error`) de esa atención; **(3)** janitor pg_cron `cleanup-comanda-print-jobs` cada 10 min: (a) cancela jobs abiertos de atenciones `cancelada|finalizada` con >15 min de gracia (finalizadas NO se cancelan en el trigger — la comanda pudo recién enviarse), (b) TTL duro: cualquier job abierto >6 h → `cancelled`. La capa (2) — no re-encolar jobs muertos — vive en la app (`printEngineV2`).

