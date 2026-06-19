# Documents & AI

> 6 tables in this domain

### documents

| Column | Type | Null | Default |
|--------|------|------|---------|
| filename | text | ✗ | - |
| file_type | text | ✗ | - |
| content | text | ✓ | - |
| file_url | text | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| is_private | bool | ✗ | true |
| updated_at | timestamptz | ✓ | timezone(`utc`::text, now()) |
| created_at | timestamptz | ✓ | timezone(`utc`::text, now()) |
| file_size | int8 | ✓ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| metadata | jsonb | ✓ | `{}`::jsonb |

**FK →** organizacion_id → `organizaciones.id` |

### document_chunks

| Column | Type | Null | Default |
|--------|------|------|---------|
| document_id | uuid | ✓ | - |
| metadata | jsonb | ✓ | `{}`::jsonb |
| organizacion_id | uuid | ✓ | - |
| embedding | USER-DEFINED | ✓ | - |
| chunk_index | int4 | ✗ | - |
| content | text | ✗ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| created_at | timestamptz | ✓ | timezone(`utc`::text, now()) |

**FK →** document_id → `documents.id` | organizacion_id → `organizaciones.id` |

### mcp_tool_executions

| Column | Type | Null | Default |
|--------|------|------|---------|
| success | bool | ✓ | true |
| organizacion_id | uuid | ✓ | - |
| input_params | jsonb | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| client_metadata | jsonb | ✓ | - |
| execution_time_ms | int4 | ✓ | - |
| error_message | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| tool_name | text | ✗ | - |
| output_response | jsonb | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` |

### mcp_tool_stats

| Column | Type | Null | Default |
|--------|------|------|---------|
| successful | int8 | ✓ | - |
| max_time_ms | int4 | ✓ | - |
| avg_time_ms | int4 | ✓ | - |
| failed | int8 | ✓ | - |
| last_use | timestamptz | ✓ | - |
| first_use | timestamptz | ✓ | - |
| tool_name | text | ✓ | - |
| min_time_ms | int4 | ✓ | - |
| total_executions | int8 | ✓ | - |

### model_pricing

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| model_name | text | ✗ | - |
| provider | text | ✗ | - |
| output_price_per_million | numeric | ✗ | - |
| input_price_per_million | numeric | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |

**Constraints:** UNIQUE(`model_pricing_model_name_key`) on model_name |

### token_usage

| Column | Type | Null | Default |
|--------|------|------|---------|
| estimated_cost | numeric | ✓ | 0 |
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| task_used | text | ✓ | - |
| model_name | text | ✗ | - |
| metadata | jsonb | ✓ | - |
| output_tokens | int4 | ✗ | 0 |
| input_tokens | int4 | ✗ | 0 |

**FK →** organizacion_id → `organizaciones.id` |

