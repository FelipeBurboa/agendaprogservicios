# All Foreign Key Relationships

> 275 FK relationships across 134 tables

**actividades_oportunidad:** usuario_id → `usuarios.id` | usuario_id → `usuarios.id` | oportunidad_id → `oportunidades.id`

**agenda_disponibilidad:** profesional_id → `profesionales.id` | servicio_id → `servicios.id`

**atencion_plato_componentes:** producto_id → `productos_stock.id` | plato_origen_id → `platos.id` | atencion_plato_id → `atencion_platos.id`

**atencion_platos:** plato_id → `platos.id` | organizacion_id → `organizaciones.id` | atencion_id → `atenciones.id`

**atenciones:** cita_id → `citas.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` | cliente_id → `clientes.id` | venta_externa_origen_id → `ventas_externas.id` (SET NULL) | cotizacion_origen_id → `cotizaciones.id` (SET NULL)

**atenciones_boletas_electronicas:** organizacion_id → `organizaciones.id` | cuenta_facturacion_id → `cuentas_facturacion_electronica.id` | atencion_id → `atenciones.id`

**atenciones_boletas_honorarios:** atencion_id → `atenciones.id` (CASCADE) | organizacion_id → `organizaciones.id` (CASCADE) | profesional_id → `profesionales.id` (RESTRICT)

**atenciones_logs:** atencion_id → `atenciones.id`

**automatizaciones_ejecuciones:** organizacion_id → `organizaciones.id` | automatizacion_id → `automatizaciones_whatsapp.id`

**automatizaciones_whatsapp:** organizacion_id → `organizaciones.id` | plantilla_id → `whatsapp_plantillas_meta.id`

**autopago_configs:** organizacion_id → `organizaciones.id` (CASCADE) | pos_device_id → `pos_devices.id` (SET NULL) | sucursal_id → `sucursales.id` (SET NULL) | mesa_id → `profesionales.id` (SET NULL)

**availability_api_logs:** organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` | appointment_id → `citas.id` | tag_id → `servicio_tags.id`

**bug_report_comments:** bug_report_id → `bug_reports.id` | user_id → `usuarios.id`

**bug_reports:** organizacion_id → `organizaciones.id` | user_id → `usuarios.id` | deleted_by → `usuarios.id`

**campana_estado:** organizacion_id → `organizaciones.id` | campana_id → `campanas.id`

**campanas:** whatsapp_plantillas_meta_id → `whatsapp_plantillas_meta.id` | organizacion_id → `organizaciones.id` | created_by → `usuarios.id`

**campanas_criterios:** id_campana → `campanas.id` ON DELETE CASCADE _(targeting v3, replaces campanas_targets)_

**campanas_duplicate:** whatsapp_plantillas_meta_id → `whatsapp_plantillas_meta.id` | organizacion_id → `organizaciones.id` | created_by → `usuarios.id`

**campanas_targets:** id_campana → `campanas.id` | id_estado → `estados_funnel.id` | id_tag → `cliente_tags.id` _(⚠️ DEPRECATED — replaced by campanas_criterios)_

**canjes:** ingreso_id → `ingresos.id` | atencion_id → `atenciones.id` | organizacion_id → `organizaciones.id`

**categorias_productos:** parent_id → `categorias_productos.id` | organizacion_id → `organizaciones.id`

**categorias_profesionales:** organizacion_id → `organizaciones.id`

**chat_messages:** session_id → `chat_sessions.id` | organizacion_id → `organizaciones.id`

**chat_sessions:** user_id → `usuarios.id` | organizacion_id → `organizaciones.id`

**citas:** sucursal_id → `sucursales.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id` | cliente_id → `clientes.id` | cita_original_id → `citas.id` | vendedor_id → `usuarios.id`

**cliente_empresa:** empresa_id → `empresas.id` | cliente_id → `clientes.id`

**cliente_interacciones:** cliente_id → `clientes.id` | organizacion_id → `organizaciones.id` | usuario_id → `usuarios.id`

**cliente_tag_asociaciones:** tag_id → `cliente_tags.id` | cliente_id → `clientes.id`

**cliente_tags:** organizacion_id → `organizaciones.id`

**clientes:** organizacion_id → `organizaciones.id` | contacto_id → `contactos.id` | contacto_id → `contactos.id`

**clientes_suscripcion:** organizacion_id → `organizaciones.id` | organizacion_suscrita_id → `organizaciones.id` | plataforma_id → `plataformas_suscripcion.id` | cliente_id → `clientes.id`

**configuracion_link_pago:** organizacion_id → `organizaciones.id`

**configuracion_email:** organizacion_id → `organizaciones.id`

**configuracion_suscripcion:** plataforma_id → `plataformas_suscripcion.id` | organizacion_id → `organizaciones.id`

**configuracion_tickets:** organizacion_id → `organizaciones.id` (CASCADE, UNIQUE)

**configuracion_whatsapp_business:** organizacion_id → `organizaciones.id`

**configuraciones_agenda:** organizacion_id → `organizaciones.id`

**consumos:** servicio_id → `servicios.id` | profesional_id → `profesionales.id` | atencion_id → `atenciones.id`

**consumo_ayudantes:** consumo_id → `consumos.id` (CASCADE) | profesional_id → `profesionales.id` (no CASCADE — protege historial de comisiones) | organizacion_id → `organizaciones.id` (CASCADE)

**contacto_mensajes:** contacto_id → `contactos.id`

**contacto_respuesta:** organizacion_id → `organizaciones.id` | typeform_id → `typeform.id` | respuesta_id → `typeform_response.id` | contacto_id → `contactos.id`

**contactos:** organizacion_id → `organizaciones.id` | a_cargo → `usuarios.id`

**conversation_messages:** usuario_id → `usuarios.id` | conversation_id → `conversations.id`

**conversation_participants:** conversation_id → `conversations.id` | usuario_id → `usuarios.id`

**conversations:** organizacion_id → `organizaciones.id` | owner_id → `usuarios.id`

**cuentas_facturacion_electronica:** organizacion_id → `organizaciones.id`

**document_chunks:** document_id → `documents.id` | organizacion_id → `organizaciones.id`

**documents:** organizacion_id → `organizaciones.id`

**email_logs:** organizacion_id → `organizaciones.id` | sent_by_id → `usuarios.id`

**email_templates:** organizacion_id → `organizaciones.id` | created_by → `usuarios.id`

**empresa_tag_asociaciones:** empresa_id → `empresas.id` | tag_id → `empresa_tags.id`

**empresa_tags:** organizacion_id → `organizaciones.id`

**empresas:** organizacion_id → `organizaciones.id`

**estados_funnel:** funnel_id → `funnels.id`

**excepcion_servicios:** excepcion_id → `profesional_excepciones.id` | servicio_id → `servicios.id`

**fichas_medicas:** profesional_id → `profesionales.id` | atencion_id → `atenciones.id`

**flujos_ejecuciones:** flujo_configuracion_id → `flujos_configuracion.id` | contacto_id → `contactos.id`

**flujos_pasos_ejecucion:** ejecucion_id → `flujos_ejecuciones.id`

**funnels:** organizacion_id → `organizaciones.id`

**giftcards:** organizacion_id → `organizaciones.id` | ingreso_id → `ingresos.id` | atencion_id → `atenciones.id`

**historial_oportunidades:** oportunidad_id → `oportunidades.id` | usuario_id → `usuarios.id`

**ingreso_atenciones:** ingreso_id → `ingresos.id` | atencion_id → `atenciones.id`

**ingresos:** cita_id → `citas.id` | venta_externa_id → `ventas_externas.id` | pos_device_id → `pos_devices.id` | organizacion_id → `organizaciones.id` | medio_pago_id → `medios_pago.id` | ingreso_original_id → `ingresos.id` | atencion_id → `atenciones.id` | usuario_id → `usuarios.id` | anulado_por_usuario_id → `usuarios.id`

**link_pagos:** atencion_id → `atenciones.id` | cita_id → `citas.id` | usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id` | contacto_id → `contactos.id`

**mcp_tool_executions:** organizacion_id → `organizaciones.id`

**medios_pago:** organizacion_id → `organizaciones.id`

**metas_comerciales:** organizacion_id → `organizaciones.id`

**movimientos_stock:** sucursal_id → `sucursales.id` | producto_id → `productos_stock.id` | organizacion_id → `organizaciones.id` | variante_id → `variantes_producto.id`

**notas:** oportunidad_id → `oportunidades.id` | usuario_id → `usuarios.id`

**oportunidades:** empresa_id → `empresas.id` | estado_id → `estados_funnel.id` | funnel_id → `funnels.id` | organizacion_id → `organizaciones.id` | responsable_id → `usuarios.id` | responsable_id → `usuarios.id` | cliente_id → `clientes.id`

**organizaciones:** default_estado_funnel → `estados_funnel.id`

**organizaciones_facturacion:** organizacion_id → `organizaciones.id`

**organization_clean_logs:** target_org_id → `organizaciones.id`

**organization_clone_logs:** target_org_id → `organizaciones.id` | source_org_id → `organizaciones.id`

**pagos_suscripcion:** organizacion_id → `organizaciones.id` | suscripcion_id → `suscripciones.id`

**paletas_personalizadas:** organizacion_id → `organizaciones.id` | created_by → `usuarios.id`

**paletas_sistema:** created_by → `usuarios.id`

**planillas:** organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id`

**plato_ingredientes:** preparacion_origen_id → `platos.id` | producto_id → `productos_stock.id` | plato_id → `platos.id`

**plato_toppings:** plato_id → `platos.id` | producto_id → `productos_stock.id`

**platos:** categoria_id → `categorias_productos.id` | organizacion_id → `organizaciones.id`

**pos_audit_log:** organizacion_id → `organizaciones.id` | pos_token_id → `pos_tokens.id` | pos_device_id → `pos_devices.id` | performed_by → `usuarios.id`

**pos_devices:** token_id → `pos_tokens.id` | created_by → `usuarios.id` | organizacion_id → `organizaciones.id`

**pos_tokens:** organizacion_id → `organizaciones.id` | created_by → `usuarios.id` | regenerated_by → `usuarios.id`

**producto_codigos_suscripcion:** producto_id → `productos.id`

**producto_servicio:** servicio_id → `servicios.id` | producto_id → `productos.id`

**productos:** organizacion_destino_id → `organizaciones.id` | organizacion_id → `organizaciones.id`

**productos_stock:** proveedor_id → `proveedores_stock.id` | subcategoria_id → `categorias_productos.id` | organizacion_id → `organizaciones.id` | categoria_id → `categorias_productos.id`

**profesional_bloqueos:** created_by → `usuarios.id` | organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id` | cita_origen_id → `citas.id`

**profesional_bloqueos_recurrentes:** created_by → `usuarios.id` | organizacion_id → `organizaciones.id` | profesional_id → `profesionales.id`

**profesional_bloqueos_recurrentes_overrides:** profesional_id → `profesionales.id` | bloqueo_recurrente_id → `profesional_bloqueos_recurrentes.id` | organizacion_id → `organizaciones.id` | created_by → `usuarios.id`

**profesional_categorias:** profesional_id → `profesionales.id` | categoria_id → `categorias_profesionales.id`

**profesional_excepciones:** created_by → `usuarios.id` | profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id`

**profesional_servicio:** profesional_id → `profesionales.id` | servicio_id → `servicios.id`

**profesionales:** organizacion_id → `organizaciones.id` | sucursal_id → `sucursales.id`

**propinas:** organizacion_id → `organizaciones.id` | ingreso_id → `ingresos.id` | profesional_id → `profesionales.id`

**proveedores_stock:** organizacion_id → `organizaciones.id`

**reglas_agenda:** profesional_id → `profesionales.id` | organizacion_id → `organizaciones.id`

**relaciones_productos_proveedores:** organizacion_id → `organizaciones.id` | producto_id → `productos_stock.id` | proveedor_id → `proveedores_stock.id`

**role_permissions:** permission_id → `permissions.id` | role_id → `roles.id`

**roles:** organization_id → `organizaciones.id`

**email_events:** organizacion_id → `organizaciones.id`

**servicio_producto:** servicio_id → `servicios.id` | producto_id → `productos_stock.id`

**servicio_tag_asociaciones:** tag_id → `servicio_tags.id` | servicio_id → `servicios.id`

**servicio_tags:** organizacion_id → `organizaciones.id`

**servicios:** organizacion_id → `organizaciones.id`

**stock_por_ubicacion:** variante_id → `variantes_producto.id` | sucursal_id → `sucursales.id` | producto_id → `productos_stock.id` | organizacion_id → `organizaciones.id`

**sucursales:** organizacion_id → `organizaciones.id`

**suscripciones:** cliente_suscripcion_id → `clientes_suscripcion.id` | producto_id → `productos.id` | plataforma_id → `plataformas_suscripcion.id` | organizacion_id → `organizaciones.id`

**tareas:** usuario_id → `usuarios.id` | oportunidad_id → `oportunidades.id` | asignado_id → `usuarios.id`

**token_usage:** organizacion_id → `organizaciones.id`

**typeform:** usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id`

**typeform_response:** typeform_id → `typeform.id`

**user_roles:** user_id → `usuarios.id` | role_id → `roles.id`

**usuario_profesionales:** usuario_id → `usuarios.id` | profesional_id → `profesionales.id`

**usuarios:** professional_id → `profesionales.id` | organizacion_id → `organizaciones.id`

**variantes_producto:** producto_id → `productos_stock.id`

**venta_productos_interna:** usuario_id → `usuarios.id` | profesional_id → `profesionales.id` | producto_id → `productos_stock.id` | sucursal_id → `sucursales.id` | organizacion_id → `organizaciones.id` | devuelto_por_usuario_id → `usuarios.id`

**ventas_externas:** cancelada_por_usuario_id → `usuarios.id` | organizacion_id → `organizaciones.id` | usuario_id → `usuarios.id` | sucursal_id → `sucursales.id`

**ventas_externas_boletas_electronicas:** organizacion_id → `organizaciones.id` | venta_externa_id → `ventas_externas.id` | cuenta_facturacion_id → `cuentas_facturacion_electronica.id`

**ventas_externas_items:** venta_externa_id → `ventas_externas.id` | producto_id → `productos_stock.id` (nullable, RESTRICT) | plato_id → `platos.id` (RESTRICT) — XOR producto/plato (autopago vende platos)

**voice_call_events:** call_id → `voice_calls.id`

**voice_call_participants:** call_id → `voice_calls.id`

**voice_calls:** contacto_id → `contactos.id` | host_id → `usuarios.id`

**whatsapp_message_errors:** organizacion_id → `organizaciones.id`

**whatsapp_message_statuses:** organizacion_id → `organizaciones.id`

