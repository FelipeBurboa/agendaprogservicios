# Organizations & Configuration

> 12 tables in this domain

### organizaciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| subdominio | varchar | ✓ | - |
| descripcion | text | ✓ | - |
| nombre | text | ✗ | - |
| usa_propina_boleta | bool | ✗ | false |
| usa_canje | bool | ✗ | false |
| usa_propina | bool | ✗ | false |
| mostrar_propina_reporte_profesional | bool | ✗ | false |
| usa_giftcard | bool | ✗ | false |
| usa_egreso | bool | ✗ | false |
| use_restaurant | bool | ✗ | true |
| use_ficha_medica | bool | ✗ | true |
| reset_days | int4 | ✓ | 2 |
| is_demo | bool | ✗ | false |
| metodo_asignacion | int2 | ✓ | `1`::smallint |
| default_estado_funnel | uuid | ✓ | - |
| landing_config | jsonb | ✓ | `{"sections": {"hero": {"enabled": true, |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| foto_url | text | ✓ | - |
| api_key | text | ✓ | - |
| use_email | bool | ✗ | false |
| chat_widget | bool | ✗ | false |
| cliente_email_obligatorio | bool | ✗ | false |
| crear_google_meet_citas | bool | ✗ | false |

**FK →** default_estado_funnel → `estados_funnel.id` |

**Constraints:** UNIQUE(`organizaciones_api_key_key`) on api_key | UNIQUE(`organizaciones_subdominio_key`) on subdominio |

`cliente_email_obligatorio` (mig `20260611120000_google_meet_y_email_cliente.sql`) — when true, the email field becomes required when creating a cliente from the internal UI (`ClienteCreationModal` + `BasicInfoStep`). Motivated by Google Calendar integration: to invite the client as an attendee on the Google event, we need their email. Off by default (most orgs collect phone-first, email-optional). Configurable per-org from the `ClientesConfigDialog` accessible via the "Configuración" button in the Clientes section.

`crear_google_meet_citas` (mig `20260612120000_crear_google_meet_citas.sql`) — when true, citas of professionals with Google Calendar connected auto-generate a Google Meet room when the event is created in Google. Opt-in (default false) because most VentaPlay orgs are brick-and-mortar (peluquerías, spas, clínicas presenciales) and don't need a videollamada per cita. Activated by admins from the "Google Calendar" Configuración dialog in the Profesionales section. The Meet URL is stored in `citas.google_meet_url` after creation, displayed in the "Reunión" tab of `CitaDetalleModal`, and exposed to WhatsApp automations as the `cita.link_meet` variable.

`mostrar_propina_reporte_profesional` (mig `20260424180000_add_mostrar_propina_reporte_profesional.sql`) — when true, `/reporte-profesional` shows the tip KPI and table column for that org. Independent of `usa_propina` (which gates whether tips are collected at all) — an org may collect tips but choose not to surface them in the per-pro report.

`usa_egreso` (mig `20260430120000_add_usa_egreso_to_organizaciones.sql`) — feature gate for the Egresos workflow on `/ingresos`. When true: the "Crear Egreso" button renders, `useEgresosData.obtenerEgresos` query fires, the Tabla de Ingresos shows mixed `MovimientoCajaConDatos` rows (ingresos + egresos sorted by `fecha_movimiento`), and Cierre Diario renders the "Total Egresos" KPI card + subtracts from Caja Neta. When false: button hidden, query short-circuited via `enabled: usaEgreso`, `egresosTotales` is `undefined`, Excel/PDF exports skip the Egresos section, and `data.movimientos` collapses to `data.ingresos`. Wired through `useOrgEgreso()` helper in `src/contexts/AuthContext.tsx`. Existing `egresos` rows are not deleted when toggled off — only UI surfacing is gated.

### chat_widget_config

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| style | text | ✗ | 'ink-and-paper' |
| org_name | text | ✗ | '' |
| custom_prompt | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** UNIQUE(`chat_widget_config_organizacion_id_key`) on organizacion_id | CHECK(`chat_widget_config_org_name_length`) char_length(org_name) <= 30 |

### organizaciones_facturacion

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| estatuto_pdf_url | text | ✓ | - |
| contacto_nombres | text | ✓ | - |
| contacto_apellidos | text | ✓ | - |
| contacto_rut | text | ✓ | - |
| documentos_timbrados_sii | jsonb | ✓ | `[]`::jsonb |
| razon_social | varchar | ✓ | - |
| contacto_email | text | ✓ | - |
| tipo_sociedad | varchar | ✓ | - |
| rut_empresa | varchar | ✓ | - |
| nombres_representante | varchar | ✓ | - |
| apellidos_representante | varchar | ✓ | - |
| rut_representante | varchar | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| estatuto_parseado | jsonb | ✓ | - |
| created_at | timestamptz | ✗ | timezone(`utc`::text, now()) |
| cuentas_pago | jsonb | ✓ | `[]`::jsonb |
| contacto_telefono | text | ✓ | - |
| actividades_sii | jsonb | ✓ | `[]`::jsonb |
| updated_at | timestamptz | ✗ | timezone(`utc`::text, now()) |
| datos_comerciales | jsonb | ✓ | `{}`::jsonb |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`organizaciones_facturacion_organizacion_id_unique`) on organizacion_id | CHECK(`tipo_sociedad_check`) tipo_sociedad IS NULL OR tipo_sociedad IN (`SPA`, `SA`, `Limitada`, `EIRL`, `LTDA`) — `LTDA` added 2026-04-21 because users were typing it as the abbreviation for `Limitada` |

### sucursales

| Column | Type | Null | Default |
|--------|------|------|---------|
| foto_url | text | ✓ | - |
| lng | float8 | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| lat | float8 | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| organizacion_id | uuid | ✗ | - |
| informacion_adicional | text | ✓ | - |
| direccion | text | ✗ | - |
| telefono | text | ✓ | - |
| nombre | text | ✗ | - |
| nombre_unaccented | text | ✓ | - |
| email | text | ✓ | - |
| created_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` |

### app_global_config

| Column | Type | Null | Default |
|--------|------|------|---------|
| description | text | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| config_key | varchar | ✗ | - |
| config_value | jsonb | ✗ | `{}`::jsonb |

### menus_configuracion

Menús de navegación dinámicos configurables por Ventaplay — asignables a **módulos** vía `modulos` y/o a una **organización específica** vía `organizacion_id` (NULL = menú por-módulo, no ligado a una org). Migraciones `20260619120000_create_menus_configuracion.sql` (base) + `20260621120000_add_organizacion_id_to_menus_configuracion.sql` (columna `organizacion_id`).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| nombre | text | ✗ | - |
| descripcion | text | ✓ | - |
| modulos | text[] | ✗ | `'{}'` |
| activo | bool | ✗ | false |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE SET NULL — added `20260621120000`) |

**Constraints:** CHECK(`menus_configuracion_modulos_check`) `modulos <@ ARRAY['restaurantes','talleres']` (cada módulo debe ser `restaurantes` o `talleres`) |

**Indexes:** GIN `idx_menus_configuracion_modulos_gin` on `modulos` | partial `idx_menus_configuracion_activo` on `activo` WHERE `activo = true` | partial `idx_menus_configuracion_organizacion_id` on `(organizacion_id) WHERE organizacion_id IS NOT NULL` (`20260621120000`) | UNIQUE partial `idx_menus_configuracion_org_activo` on `(organizacion_id) WHERE activo = true AND organizacion_id IS NOT NULL` (`20260621120000` — safety-net: un solo menú activo por org) |

**Triggers:** `tr_menus_configuracion_updated_at` (BEFORE UPDATE → `menus_configuracion_touch_updated_at()`) | `tr_menus_configuracion_one_active_per_modulo` (BEFORE INSERT/UPDATE OF activo, modulos, **organizacion_id** → `menus_configuracion_deactivate_siblings()`: al activar un menú, desactiva los demás menús activos que (a) compartan algún módulo **y/o** (b) estén asignados a la misma `organizacion_id` → **un solo menú activo por módulo y por org**. Reescrito + watched-cols ampliadas en `20260621120000`) |

**RLS:** SELECT global (`USING (true)` — menús globales legibles por cualquier sesión). Escritura (INSERT/UPDATE/DELETE) gateada por el helper `is_ventaplay_internal_user()` = `is_super_admin() OR get_current_custom_user_organization() = '36924e79-0db9-4fb4-80e8-0cf2c43d4310'` (org interna de Ventaplay). **Grants** (mig `20260620120000_grant_menus_anon_write.sql`): `SELECT, INSERT, UPDATE, DELETE` a `anon, authenticated` — la app habla con PG como `anon` (auth custom X-Session-Token); sin grants daba `42501 permission denied`. El gate real es el RLS.

**Resolución en runtime (`20260621120000`):** prioridad **org-específico > módulo** — si existe un menú activo con `organizacion_id = <org actual>`, gana sobre el menú activo por módulo. `organizacion_id IS NULL` = menú asignado solo por módulo (comportamiento original). Toda fila existente nace con `organizacion_id NULL` (sin backfill) → comportamiento previo intacto.

### menus_items

Ítems jerárquicos de un menú (árbol vía self-FK `parent_id`). Misma migración.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| menu_id | uuid | ✗ | - |
| parent_id | uuid | ✓ | - |
| label | text | ✗ | - |
| icon_name | text | ✓ | - |
| route | text | ✓ | - |
| tab_key | text | ✓ | - |
| orden | int4 | ✗ | 0 |
| activo | bool | ✗ | true |

**FK →** menu_id → `menus_configuracion.id` (CASCADE) | parent_id → `menus_items.id` (self-FK, CASCADE) |

**Indexes:** `idx_menus_items_menu_id` on `menu_id` | `idx_menus_items_menu_parent_orden` on `(menu_id, parent_id, orden)` |

**RLS / Grants:** idénticos a `menus_configuracion` (SELECT global; escritura `is_ventaplay_internal_user()`; CRUD a `anon, authenticated`).

### paletas_personalizadas

| Column | Type | Null | Default |
|--------|------|------|---------|
| descripcion | text | ✓ | - |
| colores | ARRAY | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| tema | USER-DEFINED | ✓ | `light`::theme_type |
| organizacion_id | uuid | ✗ | - |
| created_by | uuid | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| nombre | text | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | created_by → `usuarios.id` |

**Constraints:** UNIQUE(`paletas_personalizadas_nombre_organizacion_id_key`) on organizacion_id | UNIQUE(`paletas_personalizadas_nombre_organizacion_id_key`) on nombre |

### paletas_sistema

| Column | Type | Null | Default |
|--------|------|------|---------|
| activa | bool | ✓ | true |
| nombre | text | ✗ | - |
| descripcion | text | ✓ | - |
| colores | ARRAY | ✗ | - |
| updated_at | timestamptz | ✓ | now() |
| created_at | timestamptz | ✓ | now() |
| created_by | uuid | ✓ | - |
| orden | int4 | ✓ | 0 |
| tema | USER-DEFINED | ✓ | `light`::theme_type |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** created_by → `usuarios.id` |

**Constraints:** UNIQUE(`paletas_sistema_nombre_key`) on nombre |

### subdominio_stats

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizaciones_sin_subdominio | int8 | ✓ | - |
| total_organizaciones | int8 | ✓ | - |
| organizaciones_con_subdominio | int8 | ✓ | - |
| porcentaje_con_subdominio | numeric | ✓ | - |

### organization_clean_logs

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| target_org_id | uuid | ✗ | - |
| records_deleted | jsonb | ✗ | `{}`::jsonb |
| performed_by | uuid | ✗ | - |
| entities_cleaned | ARRAY | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** target_org_id → `organizaciones.id` |

### organization_clone_logs

| Column | Type | Null | Default |
|--------|------|------|---------|
| status | text | ✗ | `in_progress`::text |
| records_cloned | jsonb | ✗ | `{}`::jsonb |
| target_org_id | uuid | ✗ | - |
| source_org_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| entities_cloned | ARRAY | ✗ | - |
| error_message | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| completed_at | timestamptz | ✓ | - |
| started_at | timestamptz | ✗ | now() |
| performed_by | uuid | ✗ | - |
| id_mappings | jsonb | ✓ | `{}`::jsonb |

**FK →** target_org_id → `organizaciones.id` | source_org_id → `organizaciones.id` |

