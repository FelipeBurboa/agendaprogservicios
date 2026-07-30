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
| usa_propina | bool | ✗ | true |
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
| ocultar_contacto_cliente_profesionales | bool | ✗ | false |
| usa_honorarios | bool | ✗ | false |
| vita_model_override | text | ✓ | - |
| profesional_sin_asignar_id | uuid | ✓ | - |
| buffer_mensajes_segundos | int4 | ✗ | 5 |
| propina_visible_profesional | bool | ✗ | false |
| comision_visible_profesional | bool | ✗ | false |
| usa_club_fidelizacion | bool | ✗ | false |

**FK →** default_estado_funnel → `estados_funnel.id` | profesional_sin_asignar_id → `profesionales.id` (ON DELETE SET NULL) |

**Constraints:** UNIQUE(`organizaciones_api_key_key`) on api_key | UNIQUE(`organizaciones_subdominio_key`) on subdominio |

`cliente_email_obligatorio` (mig `20260611120000_google_meet_y_email_cliente.sql`) — when true, the email field becomes required when creating a cliente from the internal UI (`ClienteCreationModal` + `BasicInfoStep`). Motivated by Google Calendar integration: to invite the client as an attendee on the Google event, we need their email. Off by default (most orgs collect phone-first, email-optional). Configurable per-org from the `ClientesConfigDialog` accessible via the "Configuración" button in the Clientes section.

`crear_google_meet_citas` (mig `20260612120000_crear_google_meet_citas.sql`) — **master gate** for the Google Meet feature. Since `20260813120000` it no longer creates a Meet room on *every* synced cita: a cita generates a Meet room only when this flag is ON **AND** the cita includes ≥1 servicio with `servicios.crear_google_meet = true` (see [services-professionals.md](services-professionals.md)). Evaluated in `google-calendar-sync/lib/citaLoader.ts` (`loadCitaContext` looks up the per-servicio flag over `cita.servicios[].id`). Opt-in (default false) because most VentaPlay orgs are brick-and-mortar (peluquerías, spas, clínicas presenciales) and don't need a videollamada per cita. Admins toggle this flag AND pick the servicios from the "Google Calendar" Configuración dialog in the Profesionales section (`GoogleCalendarConfigDialog` — switch + servicios checklist). The Meet URL is stored in `citas.google_meet_url` after creation, displayed in the "Reunión" tab of `CitaDetalleModal`, and exposed to WhatsApp automations as the `cita.link_meet` variable.

`mostrar_propina_reporte_profesional` (mig `20260424180000_add_mostrar_propina_reporte_profesional.sql`) — when true, `/reporte-profesional` shows the tip KPI and table column for that org. Independent of `usa_propina` (which gates whether tips are collected at all) — an org may collect tips but choose not to surface them in the per-pro report.

`use_taller` (mig `20260512120000_add_use_taller_to_organizaciones.sql`) — boolean NOT NULL DEFAULT false. Gate de la vertical **Taller / Cotizaciones** (vehículos, ingresos vehiculares, cotizaciones). El schema de esas tablas lo documenta el skill **`ventaplay-taller`** (migs `20260525130000`, `20260525210727`, `20260525223830`, `20260526140000`, `20260526170000`, `20260505120000`, `20260505180000`, `20260506120000`, `20260506180000`, `20260506210000`, `20260506213000`, y las de 2026-07 listadas allí).

**Grants de los menús — ida y vuelta:** `20260529232259` revocó la escritura de `anon` sobre `menus_configuracion`/`menus_items` y `20260529232901` la **restauró** el mismo día (la app habla con Postgres como `anon` vía auth custom, así que sin GRANT daba `42501` pese al RLS). Estado final = el de `20260620120000`: CRUD a `anon, authenticated`, con la seguridad real en `is_ventaplay_internal_user()`.

`usa_egreso` (mig `20260430120000_add_usa_egreso_to_organizaciones.sql`) — feature gate for the Egresos workflow on `/ingresos`. When true: the "Crear Egreso" button renders, `useEgresosData.obtenerEgresos` query fires, the Tabla de Ingresos shows mixed `MovimientoCajaConDatos` rows (ingresos + egresos sorted by `fecha_movimiento`), and Cierre Diario renders the "Total Egresos" KPI card + subtracts from Caja Neta. When false: button hidden, query short-circuited via `enabled: usaEgreso`, `egresosTotales` is `undefined`, Excel/PDF exports skip the Egresos section, and `data.movimientos` collapses to `data.ingresos`. Wired through `useOrgEgreso()` helper in `src/contexts/AuthContext.tsx`. Existing `egresos` rows are not deleted when toggled off — only UI surfacing is gated.

`ocultar_contacto_cliente_profesionales` (mig `20260710120000_ocultar_contacto_cliente_profesionales.sql`) — boolean NOT NULL DEFAULT false. Si true, los usuarios con rol `professional` de la org NO ven el botón "Cliente" en el detalle de cita. Tiene precedencia natural por OR sobre el flag individual `profesionales.ocultar_contacto_cliente` (si lo prende el admin, aplica a todos sus profesionales sin tocar el flag individual). Evita que el profesional contacte al cliente fuera de la plataforma. Validación solo en frontend.

`usa_honorarios` (mig `20260714100000_honorarios_boletas.sql`) — boolean NOT NULL DEFAULT false. Gate del módulo de Boletas de Honorarios (DTE 80). Cuando true (+ `profesionales.honorarios_activo`), la comisión de servicio del profesional se documenta como BHE en `atenciones_boletas_honorarios` (ver [payments-billing.md](payments-billing.md)) y la boleta de la org se emite reducida por ese monto. Solo SERVICIOS generan honorario (la comisión de productos es renta del trabajo).

`vita_model_override` (mig `20260714120000_add_vita_model_override_to_organizaciones.sql`) — text NULL. Override org-wide del modelo VITA. Cuando es un slug allowlisted (ver `ALLOWED_MODELS` en `flujos-operations/node-processors.ts`), supersede `node.data.modelId` de TODOS los nodos VITA de la org. NULL = sin override (cada flujo usa su propio modelo). Debe mantenerse en sync con `ALLOWED_MODELS`.

`profesional_sin_asignar_id` (mig `20260720120000_cotizacion_a_atencion.sql`) — uuid NULL, FK `profesionales.id` ON DELETE SET NULL. Puntero al profesional centinela "Sin asignar" (agenda deshabilitada, `configuracion_agenda.activa = false`), creado lazy por la RPC `get_or_create_profesional_sin_asignar(p_org)`. Lo usa `convertir_cotizacion_en_atencion` cuando la cotización no trae profesional asignado.

`buffer_mensajes_segundos` (mig `20260729120000_add_buffer_mensajes_segundos_to_organizaciones.sql`) — `int4 NOT NULL DEFAULT 5`, CHECK `>= 0 AND <= 60`. Debounce por organización: segundos a esperar desde el ÚLTIMO mensaje entrante de WhatsApp antes de procesar el flujo (agrupa mensajes rápidos del cliente en un solo turno). Reemplaza los waits hardcodeados de `whatsapp-webhook-verify` (6s en Meta, 2s+1.5s en Twilio) por un valor configurable. `0` = sin espera (procesa de inmediato). Único consumidor: la edge function `whatsapp-webhook-verify`. Relacionado con la medición de latencia del motor de flujos (memoria `project_flujos_latencia_medicion`).

`usa_club_fidelizacion` (mig `20260925150000`) — boolean NOT NULL DEFAULT false. Gate del **Club de Fidelización** (puntos por compra POS). Con el flag apagado, `ensure_club_claim` aborta con `club_org_inactiva` y no se emiten códigos `VP-XXXX`. La config fina (modo de cálculo, WhatsApp destino, plantilla del mensaje) vive en `club_fidelizacion_config`; ver [crm-contacts.md](crm-contacts.md#club-de-fidelización-puntos-por-compra-pos).

`propina_visible_profesional` (mig `20260810120000`) — si true (y `usa_propina = true`), el rol `professional` puede ver el módulo `/propinas`, filtrado a SUS propias propinas. Se controla desde el botón "Configuración" de la página Profesionales.

`comision_visible_profesional` (mig `20260815120000`) — espejo del anterior para `/comisiones`: si true, el rol `professional` ve el módulo filtrado a sus propias comisiones. Admin/manager siempre tienen acceso; el flag solo gobierna al rol `professional`.

`usa_propina` DEFAULT cambiado `false → true` (mig `20260827120000_usa_propina_default_true.sql`) — solo orgs NUEVAS; sin backfill de filas existentes (deliberado). `provision_organizacion` omite la columna en el INSERT, así que hereda el default.

### RPCs de provisioning (API interna, edge `provision-organization`)

> Migraciones `20260630190000_provision_organizacion.sql`, `20260630190001_update_organizacion.sql`, `20260809120000_provision_p0_fixes.sql`, `20260809120001_get_organizacion_provision.sql`, `20260823120000_provision_servicios_profesionales.sql`, `20260830120001_provision_automatizaciones_predefinidas.sql`, `20260830120002_email_plantillas_predefinidas_citas.sql`, `20260830120003_provision_organizacion_email_plantillas.sql`, `20260901120000_provision_medios_agenda.sql`, `20260902120000_provision_cuentas_pago.sql`, `20260903120000_provision_cuentas_fe.sql` (cuentas DTE: top-level `cuentas_facturacion_electronica[]`). Auto-onboarding de organizaciones — las llama EXCLUSIVAMENTE la edge function `provision-organization` (auth: service_role Bearer o `x-session-token` de super_admin / admin VentaPlay; no cliente-facing). Todas SECURITY DEFINER, `search_path = public, extensions` (pgcrypto para `hash_password`).

- **`provision_organizacion(p_payload jsonb, p_dry_run boolean DEFAULT false) → jsonb`** — crea en UNA transacción (todo-o-nada): `organizaciones` + **4 `medios_pago`** (Efectivo/POS/Transferencia/POS Manual) + `flujos_configuracion` default + **6 automatizaciones de citas predefinidas** (confirmación/reagendamiento/cancelación × whatsapp/email — TODAS `activa=false`; WhatsApp sin plantilla porque Meta exige aprobarla; Email nace CON las 3 plantillas predefinidas creadas por `crear_plantillas_email_citas(org)` + `variables_guardadas` pre-mapeadas, migs `20260830120001`→`120003`) + `organizaciones_facturacion` + `sucursales[]` + `usuarios[]` + `servicios[]` + `profesionales[]` (mig `20260823120000`: servicios por nombre+precio+duración, categoría find-or-create por NOMBRE en `servicio_categorias`; profesionales con sucursal/comisión/honorarios; vínculo prof→servicios por NOMBRE o `todos_los_servicios: true`; packs/precios-por-sucursal/tags/login FUERA de v1; agenda vía `_provision_apply_profesional_agenda`: lun–vie 9–18 por defecto si hay servicios; opt-out `opciones.agenda_default=false`). Passwords/`api_key` vienen de la edge. Mínimo: `nombre` + `subdominio`. RUT duplicado → `RUT_DUPLICADO`. Idempotencia HTTP de retries: header `Idempotency-Key` en la edge (no en el RPC).
- **`update_organizacion(p_payload jsonb, p_dry_run boolean DEFAULT false) → jsonb`** — PATCH atómico. Identifica por `organizacion_id` o `subdominio`. INMUTABLES: `id`, `subdominio`, `nombre`. `facturacion` UPSERT con `estatuto` mergeado; sucursales/usuarios/servicios/profesionales se APPENDEAN (agenda default al agregar profesionales). Sucursal sin dirección → 400.
- **`_provision_apply_profesional_agenda(...)`** (mig `20260901120000`) — helper interno: planillas + `configuracion_json` activa. Sin servicios asignados → warning, no activa.
- **`get_organizacion_provision(p_organizacion_id uuid, p_subdominio text, p_rut_empresa text)` → jsonb** (mig `20260809120001`) — lectura por id | subdominio | RUT (al menos uno): org + módulos + facturación + sucursales + usuarios SIN credenciales.
- **`normalize_rut(p_rut text) → text`** (mig `20260809120000`, IMMUTABLE STRICT) — normaliza RUT chileno al formato canónico `NNNNNNN-D` (sin puntos, guion antes del dígito verificador, K mayúscula). Ambos RPCs de escritura la usan al leer/comparar `rut_empresa`. Ambos exponen `usa_honorarios` + `usa_propina_boleta` en el payload de módulos (fix `20260809120000`).
- **Evolución posterior de las automatizaciones predefinidas (migs `20260921120000`–`20260921160000`, `20260927100000`, `20260927103000`, `20260928140000`):** el set pasó de **6 a 8** al sumar `cita_recordatorio` × whatsapp/email (`activa=false`, `recordatorio_modo='hora_fija_mismo_dia'`, `recordatorio_hora_envio='09:00'`; la de email usa el nuevo helper `crear_plantilla_email_recordatorio(org) → uuid`, service_role-only). `20260921120000` **backfilleó** las 6 originales en todas las orgs existentes (idempotente por `(org, tipo_evento, canal)`). `20260927100000` cambió los `destinatarios` de las 3 automatizaciones de email de cita a `['cliente','profesional','manager']` (recordatorio queda en `['cliente']`) y backfilleó las que estaban en `['cliente','profesional']`; `20261102140000` re-aplicó ese backfill por nombre de automatización, uniendo roles sin quitar ninguno. Un 9º INSERT (`atencion_seguimiento`) se agregó en `20260927103000` y se **revirtió** en `20260928140000` → el contador vuelve a 8. Ver [whatsapp.md](whatsapp.md).
- **`crear_plantillas_email_citas(p_organizacion_id uuid) → TABLE(confirmacion_id, reagendamiento_id, cancelacion_id)`** (mig `20260830120002`; reescrita en `20260921130000` con branding VentaPlay — morado `#450693` + footer "Powered by VentaPlay" — y en `20260923130000` para agregar un bloque **`calendar_cta`** ("agregar a mi calendario") en Confirmación y Reagendamiento, no en Cancelación. Ambas reescrituras traen `UPDATE`s guardados que solo tocan plantillas cuyo `html_content` sigue siendo byte-idéntico al generado antes → una plantilla editada por la org nunca se pisa.) — inserta las 3 plantillas de email predefinidas (Confirmación/Reagendamiento/Cancelación de Cita, `template_type='builder'`, `category='transaccional'`, `is_active=true`) con las `{{vars}}` estándar que `VARIABLE_ALIASES_AUTOMATICAS` (`src/types/automatizaciones.ts`) auto-mapea. La misma migración **backfilleó** todas las orgs existentes cuyas automatizaciones email tenían `email_template_id IS NULL` (asignó plantilla, dejó `activa=false` — activar es decisión de cada org).

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

**Constraints:** UNIQUE(`organizaciones_facturacion_organizacion_id_unique`) on organizacion_id | CHECK(`tipo_sociedad_check`) tipo_sociedad IS NULL OR tipo_sociedad IN (`SPA`, `SA`, `Limitada`, `EIRL`, `LTDA`, `PN_HONORARIOS`, `PN_PRIMERA_CAT`) — `LTDA` added 2026-04-21 because users were typing it as the abbreviation for `Limitada`; `PN_HONORARIOS` (Persona Natural - Honorarios) + `PN_PRIMERA_CAT` (Persona Natural - 1ª Categoría) added mig `20260822120000` (el selector los ofrecía y la BD rechazaba con 23514) |

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

Menús de navegación dinámicos configurables por Ventaplay — asignables a **módulos** vía `modulos`, a una **organización** vía `organizacion_id`, y opcionalmente a un **perfil/rol** vía `role_id`. Migraciones: `20260619120000` (base) + `20260621120000` (`organizacion_id`) + `20260904120000` (`role_id`, `favoritos_habilitados`).

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
| role_id | uuid | ✓ | - |
| favoritos_habilitados | bool | ✗ | true |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE SET NULL — `20260621120000`) | role_id → `roles.id` (ON DELETE SET NULL — `20260904120000`) |

**Constraints:** CHECK(`menus_configuracion_modulos_check`) `modulos <@ ARRAY['restaurantes','talleres']` | CHECK(`menus_configuracion_role_requires_org`) `role_id IS NULL OR organizacion_id IS NOT NULL` (`20260904120000`) |

**Indexes:** GIN `idx_menus_configuracion_modulos_gin` on `modulos` | partial `idx_menus_configuracion_activo` on `activo` WHERE `activo = true` | partial `idx_menus_configuracion_organizacion_id` on `(organizacion_id) WHERE organizacion_id IS NOT NULL` | partial `idx_menus_configuracion_role_id` on `(role_id) WHERE role_id IS NOT NULL` | UNIQUE parcial `idx_menus_configuracion_org_wide_activo` on `(organizacion_id) WHERE activo AND organizacion_id IS NOT NULL AND role_id IS NULL` | UNIQUE parcial `idx_menus_configuracion_org_role_activo` on `(organizacion_id, role_id) WHERE activo AND organizacion_id IS NOT NULL AND role_id IS NOT NULL` (reemplazan el viejo `idx_menus_configuracion_org_activo`) |

**Triggers:** `tr_menus_configuracion_updated_at` | `tr_menus_configuracion_one_active_per_modulo` (BEFORE INSERT/UPDATE OF activo, modulos, organizacion_id, **role_id** → `menus_configuracion_deactivate_siblings()`: desactiva hermanos que (a) compartan módulos **o** (b) tengan la misma `organizacion_id` **y** el mismo `role_id` via `IS NOT DISTINCT FROM`). Un menú org-wide y menús por-perfil de la misma org **pueden coexistir** activos. |

**RLS:** SELECT global (`USING (true)`). Escritura gateada por `is_ventaplay_internal_user()`. **Grants** CRUD a `anon, authenticated` (`20260620120000`).

**Resolución en runtime (`20260904120000`):** prioridad **org+role > org-wide (`role_id` NULL) > módulo**. Si el usuario tiene varios roles con menú asignado, gana el de mayor privilegio (`super_admin`…`viewer`, luego custom). `favoritos_habilitados=false` oculta Favoritos/estrellas en `DynamicSidebar`.

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

