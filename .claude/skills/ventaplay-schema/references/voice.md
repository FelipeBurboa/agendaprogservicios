# Communications - Voice

> 3 tables in this domain

### voice_calls

| Column | Type | Null | Default |
|--------|------|------|---------|
| metadata | text | ✓ | - |
| ended_at | timestamp | ✓ | - |
| duration_seconds | int4 | ✓ | - |
| created_at | timestamp | ✓ | now() |
| host_id | uuid | ✗ | - |
| contacto_id | uuid | ✗ | - |
| organizacion_id | uuid | ✗ | - |
| started_at | timestamp | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| updated_at | timestamp | ✓ | now() |
| room_id | text | ✗ | - |
| status | varchar | ✗ | `pending`::character varying |

**FK →** contacto_id → `contactos.id` | host_id → `usuarios.id` |

**Constraints:** UNIQUE(`voice_calls_room_id_key`) on room_id |

### voice_call_events

| Column | Type | Null | Default |
|--------|------|------|---------|
| participant_name | text | ✓ | - |
| event_type | varchar | ✗ | - |
| created_at | timestamp | ✓ | now() |
| call_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| data | text | ✓ | - |

**FK →** call_id → `voice_calls.id` |

### voice_call_participants

| Column | Type | Null | Default |
|--------|------|------|---------|
| metadata | text | ✓ | - |
| duration_seconds | int4 | ✓ | - |
| left_at | timestamp | ✓ | - |
| joined_at | timestamp | ✓ | now() |
| user_id | uuid | ✓ | - |
| call_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| participant_name | text | ✗ | - |

**FK →** call_id → `voice_calls.id` |

