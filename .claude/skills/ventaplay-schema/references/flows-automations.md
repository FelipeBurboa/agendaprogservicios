# Flows & Automations

> 4 tables in this domain

### flujos_configuracion

| Column | Type | Null | Default |
|--------|------|------|---------|
| nombre | text | ✗ | `Flujo Principal`::text |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| activo | bool | ✗ | true |
| descripcion | text | ✓ | - |
| configuracion | jsonb | ✗ | `{"ui": {"isValid": false, "webhookExist |

### flujos_ejecuciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| error_mensaje | text | ✓ | - |
| timeout_en | timestamptz | ✓ | - |
| ultimo_mensaje_id | text | ✓ | - |
| nodo_actual_id | text | ✓ | - |
| estado | text | ✗ | `iniciado`::text |
| id | uuid | ✗ | gen_random_uuid() |
| flujo_configuracion_id | uuid | ✗ | - |
| contacto_id | uuid | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| finalizado_en | timestamptz | ✓ | - |
| iniciado_en | timestamptz | ✗ | now() |
| datos_contexto | jsonb | ✓ | `{}`::jsonb |

**FK →** flujo_configuracion_id → `flujos_configuracion.id` | contacto_id → `contactos.id` |

**Indexes:** UNIQUE parcial `flujos_ejecuciones_active_per_contacto_unique` on `(contacto_id) WHERE estado IN ('iniciado','en_progreso','esperando_respuesta')` (mig `20260517120000`) — **un contacto no puede tener dos flujos vivos a la vez**; los estados terminales (`completado`, `fallido`, `expirado`, `cancelado`) quedan fuera del índice y no chocan. La migración primero canceló los duplicados existentes (conservando el de `updated_at, iniciado_en, id` más alto y anotando el motivo en `error_mensaje`). Un INSERT que viole este índice significa que algo intentó lanzar un segundo flujo — no reintentar a ciegas.

### flujos_pasos_ejecucion

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| error_mensaje | text | ✓ | - |
| ejecutado_en | timestamptz | ✓ | - |
| completado_en | timestamptz | ✓ | - |
| ejecucion_id | uuid | ✗ | - |
| datos_entrada | jsonb | ✓ | `{}`::jsonb |
| id | uuid | ✗ | gen_random_uuid() |
| datos_salida | jsonb | ✓ | `{}`::jsonb |
| nodo_id | text | ✗ | - |
| tipo_nodo | text | ✗ | - |
| estado | text | ✗ | `pendiente`::text |

**FK →** ejecucion_id → `flujos_ejecuciones.id` |

**Indexes:** `idx_flujos_pasos_ejecucion_ejecucion_id` on (ejecucion_id) | `idx_flujos_pasos_ejecucion_created_at` on (created_at) |

**Notes:**
- Table is high-volume: every flow node execution INSERTs one row. Without retention it grows unbounded — production was at ~8.77 GB before the first manual prune in 2026-05.
- `idx_flujos_pasos_ejecucion_created_at` (mig **`20260507120000`**, built `CONCURRENTLY`) backs the retention DELETE `WHERE created_at < now() - INTERVAL '1 month'` → ordered index scan, sin seq scan. ⚠️ Doc previa citaba `20260504120000`, timestamp que **no existe** en `supabase/migrations/`.
- **Ya hay cron** (mig `20260508120000`): `cleanup-flujos-pasos-ejecucion-old`, diario **06:00 UTC** (~03:00 Chile, fuera de los slots 04:00/05:00 que ya usan otros crons), borra las filas de más de 1 mes. Idempotente (`cron.schedule` con el mismo nombre actualiza en sitio). Antes de esto la limpieza era manual y la tabla llegó a ~8.77 GB, disparando la auto-expansión de disco de Supabase (16 → 24 GB).
- FK `fk_flujos_pasos_ejecucion_ejecucion` is `ON DELETE NO ACTION`, so deleting a parent `flujos_ejecuciones` row that still has children fails. Drain children first, then prune parents that have no remaining children.

### automatizaciones_ejecuciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| programada_para | timestamptz | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| automatizacion_id | uuid | ✗ | - |
| ejecutada_en | timestamptz | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| tipo_evento | text | ✗ | - |
| evento_id | text | ✓ | - |
| contacto_numero | text | ✗ | - |
| contacto_nombre | text | ✓ | - |
| plantilla_nombre | text | ✓ | - |
| canal | text | ✗ | `whatsapp`::text |
| estado | text | ✗ | - |
| mensaje_id | text | ✓ | - |
| error | text | ✓ | - |
| evento_data | jsonb | ✓ | - |
| parametros_enviados | jsonb | ✓ | - |
| intentos | int4 | ✓ | 0 |

**FK →** organizacion_id → `organizaciones.id` | automatizacion_id → `automatizaciones_whatsapp.id` |

**Constraints:** CHECK `automatizaciones_ejecuciones_canal_check`: `canal IN ('whatsapp','email')` |

**Indexes:** `idx_automatizaciones_ejecuciones_programada_para` on (programada_para) |

**Notes:**
- `canal` mirrors the parent automation's channel. Email rows leave `plantilla_nombre` NULL (whatsapp-only field) — that column was made nullable in migration `20260415120000_add_email_channel_to_automatizaciones.sql` for exactly this reason.
- `contacto_numero` is **polymorphic by canal**: phone for `canal='whatsapp'` rows, email address for `canal='email'` rows. The column stays `text`; reporting queries should branch on `canal` before comparing formats.
- Base definition of `automatizaciones_whatsapp` lives in [whatsapp.md](whatsapp.md); only the ejecuciones child lives here.

