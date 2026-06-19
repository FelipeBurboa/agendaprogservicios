# Funnels & Opportunities

> 7 tables in this domain

### funnels

| Column | Type | Null | Default |
|--------|------|------|---------|
| palette_id | text | ✓ | - |
| descripcion | text | ✓ | - |
| nombre | text | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| created_at | timestamptz | ✗ | now() |
| organizacion_id | uuid | ✗ | - |
| palette_type | USER-DEFINED | ✓ | `predefined`::palette_source_type |
| tipificacion_config | jsonb | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** organizacion_id → `organizaciones.id` |

### estados_funnel

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| orden | int4 | ✗ | - |
| funnel_id | uuid | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| es_final | bool | ✗ | false |
| nombre | text | ✗ | - |
| color | varchar | ✓ | `#3B82F6`::character varying |

**FK →** funnel_id → `funnels.id` |

### oportunidades

| Column | Type | Null | Default |
|--------|------|------|---------|
| responsable_id | uuid | ✓ | - |
| fecha_cierre | date | ✓ | - |
| probabilidad | int4 | ✓ | - |
| valor_estimado | numeric | ✓ | - |
| fecha_ultimo_cambio | timestamptz | ✗ | now() |
| fecha_creacion | timestamptz | ✗ | now() |
| tipificacion_observaciones | text | ✓ | - |
| tipificacion_razon | text | ✓ | - |
| origen | text | ✓ | `manual`::text |
| descripcion | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| estado_id | uuid | ✗ | - |
| funnel_id | uuid | ✗ | - |
| empresa_id | uuid | ✓ | - |
| cliente_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** empresa_id → `empresas.id` | estado_id → `estados_funnel.id` | funnel_id → `funnels.id` | organizacion_id → `organizaciones.id` | responsable_id → `usuarios.id` | responsable_id → `usuarios.id` | cliente_id → `clientes.id` |

### historial_oportunidades

| Column | Type | Null | Default |
|--------|------|------|---------|
| accion | text | ✗ | - |
| usuario_id | uuid | ✗ | - |
| fecha | timestamptz | ✗ | now() |
| datos_nuevos | jsonb | ✓ | - |
| datos_previos | jsonb | ✓ | - |
| oportunidad_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |

**FK →** oportunidad_id → `oportunidades.id` | usuario_id → `usuarios.id` |

### actividades_oportunidad

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| tipo | varchar | ✗ | - |
| descripcion | text | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| oportunidad_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| datos_adicionales | jsonb | ✓ | - |

**FK →** usuario_id → `usuarios.id` | usuario_id → `usuarios.id` | oportunidad_id → `oportunidades.id` |

### oportunidad_tags

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| nombre | varchar(100) | ✗ | - |
| color | varchar(7) | ✗ | `#6B7280`::varchar |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` (CASCADE) |

**Constraints:** UNIQUE(nombre, organizacion_id) |

**Notes:** Mirrors `cliente_tags` pattern. Tags are per-organization.

### oportunidad_tag_asociaciones

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| oportunidad_id | uuid | ✗ | - |
| tag_id | uuid | ✗ | - |
| created_at | timestamptz | ✗ | now() |

**FK →** oportunidad_id → `oportunidades.id` (CASCADE) | tag_id → `oportunidad_tags.id` (CASCADE) |

**Constraints:** UNIQUE(oportunidad_id, tag_id) |

