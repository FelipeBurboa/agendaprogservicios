# Subscriptions

> 6 tables in this domain

### suscripciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| dia_cobro | int4 | ✓ | - |
| external_subscription_id | varchar | ✓ | - |
| external_customer_id | varchar | ✓ | - |
| fecha_inicio | date | ✓ | - |
| estado_pago | varchar | ✓ | `al_dia`::character varying |
| fecha_proximo_cobro | date | ✓ | - |
| metadata | jsonb | ✓ | - |
| payment_url | text | ✓ | - |
| moneda | varchar | ✓ | `CLP`::character varying |
| id | uuid | ✗ | gen_random_uuid() |
| estado | varchar | ✗ | `pendiente`::character varying |
| fecha_cancelacion | timestamptz | ✓ | - |
| plataforma_id | uuid | ✗ | - |
| producto_id | uuid | ✗ | - |
| monto | int4 | ✗ | - |
| payment_url_expires_at | timestamptz | ✓ | - |
| cliente_suscripcion_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| organizacion_id | uuid | ✗ | - |
| updated_at | timestamptz | ✓ | now() |

**FK →** cliente_suscripcion_id → `clientes_suscripcion.id` | producto_id → `productos.id` | plataforma_id → `plataformas_suscripcion.id` | organizacion_id → `organizaciones.id` |

### clientes_suscripcion

| Column | Type | Null | Default |
|--------|------|------|---------|
| nombre | varchar | ✗ | - |
| organizacion_suscrita_id | uuid | ✓ | - |
| email | varchar | ✗ | - |
| cliente_id | uuid | ✓ | - |
| plataforma_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| updated_at | timestamptz | ✓ | now() |
| created_at | timestamptz | ✓ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| metadata | jsonb | ✓ | - |
| external_customer_id | varchar | ✓ | - |
| government_id | varchar | ✗ | - |
| telefono | varchar | ✗ | - |
| tipo | varchar | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` | organizacion_suscrita_id → `organizaciones.id` | plataforma_id → `plataformas_suscripcion.id` | cliente_id → `clientes.id` |

### pagos_suscripcion

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✗ | - |
| suscripcion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| fecha_vencimiento | date | ✓ | - |
| external_transaction_id | varchar | ✓ | - |
| response_json | jsonb | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| external_invoice_id | varchar | ✓ | - |
| error_code | varchar | ✓ | - |
| estado | varchar | ✗ | `pendiente`::character varying |
| fecha_pago | timestamptz | ✓ | - |
| monto | int4 | ✗ | - |
| error_message | text | ✓ | - |
| moneda | varchar | ✓ | `CLP`::character varying |
| created_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` | suscripcion_id → `suscripciones.id` |

### plataformas_suscripcion

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| codigo | varchar | ✗ | - |
| updated_at | timestamptz | ✓ | now() |
| nombre | varchar | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| config_schema | jsonb | ✓ | - |
| activo | bool | ✓ | true |

**Constraints:** UNIQUE(`plataformas_suscripcion_codigo_key`) on codigo |

### configuracion_suscripcion

| Column | Type | Null | Default |
|--------|------|------|---------|
| account_key | varchar | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| plataforma_id | uuid | ✗ | - |
| config_extra | jsonb | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| activo | bool | ✓ | false |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| toku_portal_slug | varchar | ✓ | - |
| toku_acc_id | varchar | ✓ | - |
| webhook_secret | varchar | ✓ | - |

**FK →** plataforma_id → `plataformas_suscripcion.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`configuracion_suscripcion_organizacion_id_plataforma_id_key`) on organizacion_id | UNIQUE(`configuracion_suscripcion_organizacion_id_plataforma_id_key`) on plataforma_id |

### producto_codigos_suscripcion

| Column | Type | Null | Default |
|--------|------|------|---------|
| codigo | varchar | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✓ | now() |
| producto_id | uuid | ✗ | - |

**FK →** producto_id → `productos.id` |

**Constraints:** UNIQUE(`producto_codigos_suscripcion_producto_id_key`) on producto_id | UNIQUE(`producto_codigos_suscripcion_codigo_key`) on codigo |

