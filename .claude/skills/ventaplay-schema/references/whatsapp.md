# Communications - WhatsApp

> 6 tables in this domain

### configuracion_whatsapp_business

| Column | Type | Null | Default |
|--------|------|------|---------|
| verify_token | text | ✓ | - |
| app_id | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✗ | - |
| twilio_account_sid | text | ✓ | - |
| twilio_auth_token | text | ✓ | - |
| twilio_phone_number | text | ✓ | - |
| template_limit | int4 | ✗ | 250 |
| profile | jsonb | ✓ | `{}`::jsonb |
| last_health_check | timestamptz | ✓ | - |
| health_status | jsonb | ✓ | - |
| is_verified | bool | ✗ | false |
| integration | text | ✗ | `meta`::text |
| last_reset | timestamp | ✗ | date_trunc(`second`::text, timezone(`Ame |
| template_count | int4 | ✗ | 0 |
| meta_token | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| phone_number_id | text | ✗ | - |
| whatsapp_business_id | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`configuracion_whatsapp_business_organizacion_id_key`) on organizacion_id | UNIQUE(`configuracion_whatsapp_business_twilio_account_sid_key`) on twilio_account_sid | UNIQUE(`configuracion_whatsapp_business_twilio_auth_token_key`) on twilio_auth_token | UNIQUE(`configuracion_whatsapp_business_twilio_phone_number_key`) on twilio_phone_number |

### whatsapp_plantillas_meta

| Column | Type | Null | Default |
|--------|------|------|---------|
| language | text | ✗ | - |
| parameter_format | text | ✗ | `POSITIONAL`::text |
| name | text | ✗ | - |
| template_id | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| last_synced_at | timestamptz | ✗ | now() |
| meta_created_at | timestamptz | ✓ | - |
| meta_updated_at | timestamptz | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| components | jsonb | ✗ | `[]`::jsonb |
| library_template_name | text | ✓ | - |
| sub_category | text | ✓ | - |
| category | text | ✗ | - |
| status | text | ✗ | - |
| header_media_url | text | ✓ | - |

`header_media_url` (mig `20260816120000_whatsapp_plantillas_header_media.sql`) — URL pública (buckets `whatsapp-images`/`videos`/`documents`) del asset del header multimedia de la plantilla. Se usa como `link` al ENVIAR la plantilla, porque los `example.header_handle` que devuelve Meta expiran. `sync-whatsapp-templates` NO la escribe → sobrevive las sincronizaciones.

### whatsapp_componentes

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| tipo_componente | text | ✗ | - |
| descripcion | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| activo | bool | ✗ | true |
| configuracion | jsonb | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| nombre | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_by | uuid | ✓ | - |

**Constraints:** CHECK `whatsapp_componentes_tipo_componente_check`: `tipo_componente IN ('botones','lista','cta','texto')` — `texto` agregado por DROP+ADD en mig `20260927100500` |

**Validación del payload:** trigger fn `validate_whatsapp_componente_data()` exige campos distintos según el tipo; la rama `texto` (la más laxa) solo pide que `configuracion` tenga la clave `body` — es el componente "mensaje suelto" sin botones ni lista.

### whatsapp_message_statuses

| Column | Type | Null | Default |
|--------|------|------|---------|
| recipient_id | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| timestamp | timestamptz | ✗ | - |
| raw_status_data | jsonb | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| message_id | text | ✗ | - |
| status | text | ✗ | - |
| conversation_id | text | ✓ | - |
| pricing_model | text | ✓ | - |
| pricing_category | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

### whatsapp_message_errors

| Column | Type | Null | Default |
|--------|------|------|---------|
| recipient_id | text | ✗ | - |
| error_title | text | ✓ | - |
| error_message | text | ✓ | - |
| error_details | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| timestamp | timestamptz | ✗ | - |
| status | text | ✓ | - |
| error_code | int4 | ✗ | - |
| raw_error_data | jsonb | ✓ | - |
| message_id | text | ✗ | - |
| created_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` |

### automatizaciones_whatsapp

| Column | Type | Null | Default |
|--------|------|------|---------|
| parametros_mapeo | jsonb | ✓ | `[]`::jsonb |
| plantilla_id | uuid | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| tipo_accion | text | ✗ | `enviar_template`::text |
| updated_at | timestamptz | ✓ | now() |
| recordatorio_hora_envio | text | ✓ | `10:00`::text |
| recordatorio_modo | text | ✓ | `dias_antes`::text |
| created_at | timestamptz | ✓ | now() |
| ultima_ejecucion | timestamptz | ✓ | - |
| recordatorio_horas_antes | int4 | ✓ | 3 |
| descripcion | text | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| condiciones | jsonb | ✓ | `{}`::jsonb |
| destinatarios | ARRAY | ✓ | ARRAY[`cliente`::text] |
| accion_config | jsonb | ✓ | - |
| recordatorio_dias_antes | int4 | ✓ | 1 |
| veces_ejecutada | int4 | ✓ | 0 |
| retraso_minutos | int4 | ✓ | 0 |
| plantilla_nombre | text | ✓ | - |
| tiempo_sin_respuesta_minutos | int4 | ✓ | 60 |
| created_by | uuid | ✓ | - |
| nombre | text | ✗ | - |
| tipo_evento | text | ✗ | - |
| activa | bool | ✓ | true |
| canal | text | ✗ | `whatsapp`::text |
| email_template_id | uuid | ✓ | - |
| variables_guardadas | jsonb | ✓ | - |
| estado_destino_id | uuid | ✓ | - |
| seguimiento_semanas_espera | int4 | ✓ | 4 |
| seguimiento_hora_envio | text | ✓ | `10:00` |

**FK →** organizacion_id → `organizaciones.id` | plantilla_id → `whatsapp_plantillas_meta.id` | email_template_id → `email_templates.id` (ON DELETE SET NULL) | estado_destino_id → `estados_funnel.id` (ON DELETE CASCADE) |

**Constraints:** UNIQUE(`uq_automatizacion_nombre_org`) on organizacion_id | UNIQUE(`uq_automatizacion_nombre_org`) on nombre | CHECK `automatizaciones_whatsapp_canal_check`: `canal IN ('whatsapp','email')` | CHECK `automatizaciones_whatsapp_tipo_evento_check`: `tipo_evento IN ('cita_agendada','cita_cancelada','cita_recordatorio','cliente_nuevo','oportunidad_ganada','cita_agendada_con_abono','atencion_terminada','contacto_sin_respuesta','lead_calificado','cita_reagendada','ejecutivo_asignado','oportunidad_cambio_estado','formulario_enviado','cita_agendada_widget','boleta_emitida','honorario_emitido','link_pago_enviado','atencion_seguimiento')` (doc previamente desactualizada: no listaba `link_pago_enviado`, mig `20260923120000`) |

**Indexes:** partial `idx_auto_estado_destino` on `estado_destino_id` WHERE `estado_destino_id IS NOT NULL` (drives the in-memory filter for `oportunidad_cambio_estado` automations).

**Notes:**
- Despite the table name, `automatizaciones_whatsapp` now handles **both** WhatsApp and Email automations via the `canal` discriminator (added in `20260415120000_add_email_channel_to_automatizaciones.sql`).
- For `canal='whatsapp'`: `plantilla_id`, `plantilla_nombre`, `parametros_mapeo` drive the send. `email_template_id` + `variables_guardadas` are NULL.
- For `canal='email'`: `email_template_id` + `variables_guardadas` drive the send. `plantilla_id`/`plantilla_nombre`/`parametros_mapeo` are unused (and `plantilla_nombre` is now nullable to support this).
- `variables_guardadas` shape for email: `{ variable_sources: { varName: source_field | "manual" }, manualVars: { varName: literal } }`. Shared with `campanas.variables_guardadas` so resolver helpers can be reused.
- Execution rows land in `automatizaciones_ejecuciones` (see [flows-automations.md](flows-automations.md)) which also has a `canal` column + nullable `plantilla_nombre`.

`seguimiento_semanas_espera` / `seguimiento_hora_envio` (mig `20260927101500`) — **solo aplican a `tipo_evento='atencion_seguimiento'`** (18º valor, mig `20260927101000`): recordatorio de "próxima sesión" N semanas después de una atención, enviado a la hora indicada. Lo dispara el cron **`recordatorio-proxima-sesion`** (09:00 diario, mig `20260927102000`) que invoca `<supabase_functions_url>/cron-recordatorio-proxima-sesion`; es auto-guardado — hace short-circuit si ninguna org tiene una automatización `atencion_seguimiento` **activa**.

⚠️ **Estado real de `atencion_seguimiento` (post-revert):** el pre-seed masivo (`20260927102500`) y el alta automática en `provision_organizacion` (`20260927103000`) fueron **revertidos** — `20260928140000` sacó el INSERT de la función de provisioning y `20260928140500` borró las filas sembradas que nadie había tocado (`activa=false`, sin plantilla, `veces_ejecutada=0`). Lo que **queda vivo**: el valor en el CHECK, las dos columnas, y el cron. O sea: la feature existe pero es **opt-in manual** — hoy ninguna org nace con ella y el cron no hace nada hasta que alguien cree y active una automatización a mano.

`estado_destino_id` (mig `20260615120000_oportunidad_cambio_estado_automatizacion.sql`) — UUID del estado_funnel al que reacciona la automatización. **Solo aplica cuando `tipo_evento = 'oportunidad_cambio_estado'`**, NULL en todos los demás casos. `trigger-automatizaciones` filtra in-memory las automatizaciones para ese evento comparando `auto.estado_destino_id === estado_nuevo_id` antes de dispatchar. ON DELETE CASCADE: si el admin borra un estado_funnel, todas las automatizaciones que reaccionaban a ese estado se borran también (no tiene sentido mantenerlas configuradas a un estado inexistente).

**Tipos de evento soportados** (16 eventos, al 2026-07-17):
| `tipo_evento` | Disparado por | Variables exclusivas |
|---|---|---|
| `cita_agendada` / `cita_cancelada` / `cita_reagendada` / `cita_recordatorio` / `cita_agendada_con_abono` | useCitas + manage-appointments | `cita.*`, `cita.link_meet` (Google Meet) |
| `cliente_nuevo` | ContactFormCRMService.processContactForm, ClienteCreationModal | `cliente.*` |
| `atencion_terminada` | useAtenciones + manage-atenciones | `atencion.*` |
| `oportunidad_ganada` | useMoveOportunidad cuando llega a estado final ganado | `oportunidad.*` |
| `oportunidad_cambio_estado` ⭐ | useMoveOportunidad / OportunidadesService / cascada mover_funnel / nodo crear_oportunidad de flujos / useContactoAssignment | `oportunidad.estado_anterior`, `oportunidad.estado_nuevo`, `oportunidad.probabilidad`. **Filtrado por `estado_destino_id`** |
| `lead_calificado` | qualify-lead (VITA) | `calificacion.*` |
| `ejecutivo_asignado` | Asignación de ejecutivo a oportunidad | `ejecutivo.*` |
| `contacto_sin_respuesta` | check-contactos-sin-respuesta cron | `contacto.horas_sin_respuesta` |
| `formulario_enviado` ⭐ | ContactFormCRMService.**processWidgetFormSubmission** (usado por EmbedFormularioPage + widgetAgendamientoService — NO por landings vía processContactForm) | `formulario.mensaje`, `formulario.titulo`, `formulario.funnel`, `formulario.estado`, `formulario.etiqueta` |
| `cita_agendada_widget` ⭐ | widgetAgendamientoService.**submitWidgetBooking** — visitante anónimo auto-agenda desde el widget público (`EmbedAgendamientoPage`); separado de `cita_agendada` (CRM/MCP) para permitir copy distinto | mismas que `cita_agendada`: `cita.*`, `cliente.*`, `profesional.*`, `servicio.*` |

| `boleta_emitida` ⭐ | boleta electrónica de la org (`atenciones_boletas_electronicas`) llega a `sincronizada` con folio + pdf_url; claim atómico vía `whatsapp_notificado_at` (la boleta se sincroniza desde ~5 sitios distintos). El PDF se re-aloja en el bucket público `boletas-pdf` (la URL de Tupana expira ~1h) y se envía como plantilla WhatsApp con header DOCUMENT. Solo la boleta de la org, nunca la BHE | `boleta.*` (folio, pdf) |
| `honorario_emitido` ⭐ | BHE (DTE 80, `atenciones_boletas_honorarios`) llega a `sincronizada` CON pdf_url (solo si el profesional está enrolado en Tupana); mismo claim `whatsapp_notificado_at` + mismo bucket `boletas-pdf`. Destinatario configurable vía `destinatarios` (cliente/profesional/admin) | `boleta.*` + `profesional.*` |
| `link_pago_enviado` ⭐ | Se genera y envía un link de pago a un cliente (automatización, módulo manual o API), sin importar el origen. NO se dispara con el auto-checkout de la tienda pública | `link.*` |
| `atencion_seguimiento` ⭐ | `cron-recordatorio-proxima-sesion` (cron diario dedicado, NO `trigger-automatizaciones`) — recalcula cada corrida qué atenciones `estado='finalizada'` terminaron hace exactamente `seguimiento_semanas_espera` semanas (columnas propias `seguimiento_semanas_espera`/`seguimiento_hora_envio`, no `retraso_minutos` — tope de 7 días insuficiente). Recuerda al cliente agendar su próxima sesión, prioridad WhatsApp | `atencion.*`, `servicio.*` (primer consumo) |

⭐ = `oportunidad_cambio_estado` + `formulario_enviado` agregados 2026-05-27; `cita_agendada_widget` agregado 2026-05-29 (mig `20260618120000`); `boleta_emitida` agregado 2026-07 (mig `20260821120000`), `honorario_emitido` 2026-07 (mig `20260831120000`); `link_pago_enviado` (mig `20260923120000`); `atencion_seguimiento` 2026-09 (mig `20260927101000`).

