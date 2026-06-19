# Stock & Inventory

> 5 tables in this domain

### movimientos_stock

| Column | Type | Null | Default |
|--------|------|------|---------|
| producto_id | uuid | ✗ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| variante_id | uuid | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| cantidad | int4 | ✗ | - |
| cantidad_anterior | int4 | ✓ | - |
| cantidad_posterior | int4 | ✓ | - |
| referencia_id | uuid | ✓ | - |
| usuario_id | uuid | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| sucursal_id | uuid | ✓ | - |
| notas | text | ✓ | - |
| referencia_tipo | varchar | ✓ | - |
| razon | text | ✓ | - |
| tipo_movimiento | varchar | ✗ | - |
| factura_numero | varchar(80) | ✓ | - |
| factura_monto | numeric(14,2) | ✓ | - |
| documento_tipo | varchar(30) | ✓ | - |
| documento_numero | varchar(80) | ✓ | - |

**FK →** sucursal_id → `sucursales.id` | producto_id → `productos_stock.id` | organizacion_id → `organizaciones.id` | variante_id → `variantes_producto.id` |

**Constraints:** CHECK `movimientos_stock_documento_tipo_check` — `documento_tipo IS NULL OR documento_tipo IN ('factura', 'guia_despacho')`.

**Indexes:** `idx_movimientos_stock_ultima_compra` on `(producto_id, organizacion_id, created_at DESC)` WHERE `referencia_tipo = 'compra'` — optimizes "last purchase" lookups per producto.

**Notes:**
- `factura_numero` and `factura_monto` apply only when `referencia_tipo = 'compra'` (proveedor purchase). Added 2026-04-23.
- `documento_tipo` / `documento_numero` (mig `20260426130000_movimientos_stock_documento_compra.sql`) generalize purchase-document storage beyond invoices: `factura` (boleta/factura) or `guia_despacho`. Backfilled from legacy `factura_numero`: rows where `factura_numero` was set get `documento_tipo='factura'` + `documento_numero=btrim(factura_numero)`. Older rows that were never normalized may still have only `factura_numero` set — read both for compatibility.

### preparacion_stock

> ⚠️ Table not found in schema dump
### stock_por_ubicacion

| Column | Type | Null | Default |
|--------|------|------|---------|
| updated_at | timestamptz | ✓ | now() |
| ubicacion_codigo | text | ✓ | - |
| notas | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| variante_id | uuid | ✓ | - |
| producto_id | uuid | ✗ | - |
| sucursal_id | uuid | ✓ | - |
| cantidad | int4 | ✗ | 0 |
| created_at | timestamptz | ✓ | now() |
| id | uuid | ✗ | uuid_generate_v4() |
| ubicacion_nombre | text | ✗ | - |

**FK →** variante_id → `variantes_producto.id` | sucursal_id → `sucursales.id` | producto_id → `productos_stock.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`stock_por_ubicacion_producto_id_variante_id_ubicacion_nombr_key`) on organizacion_id | UNIQUE(`stock_por_ubicacion_producto_id_variante_id_ubicacion_nombr_key`) on ubicacion_nombre | UNIQUE(`stock_por_ubicacion_producto_id_variante_id_ubicacion_nombr_key`) on producto_id | UNIQUE(`stock_por_ubicacion_producto_id_variante_id_ubicacion_nombr_key`) on variante_id |

### proveedores_stock

| Column | Type | Null | Default |
|--------|------|------|---------|
| rut | text | ✓ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| organizacion_id | uuid | ✗ | - |
| activo | bool | ✓ | true |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| codigo_postal | text | ✓ | - |
| pais | text | ✓ | - |
| ciudad | text | ✓ | - |
| direccion | text | ✓ | - |
| empresa | text | ✓ | - |
| contacto_telefono | text | ✓ | - |
| contacto_email | text | ✓ | - |
| contacto_nombre | text | ✓ | - |
| nombre | text | ✗ | - |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`proveedores_stock_organizacion_id_nombre_key`) on nombre | UNIQUE(`proveedores_stock_organizacion_id_nombre_key`) on organizacion_id |

### relaciones_productos_proveedores

| Column | Type | Null | Default |
|--------|------|------|---------|
| proveedor_id | uuid | ✗ | - |
| producto_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| activa | bool | ✗ | true |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| notas | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| precio_compra | numeric | ✗ | - |
| tiempo_entrega_dias | int4 | ✓ | - |
| es_proveedor_principal | bool | ✗ | false |

**FK →** organizacion_id → `organizaciones.id` | producto_id → `productos_stock.id` | proveedor_id → `proveedores_stock.id` |

