# Communications - Chat

> 5 tables in this domain

### chat_sessions

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✓ | timezone(`utc`::text, now()) |
| organizacion_id | uuid | ✓ | - |
| title | text | ✓ | - |
| updated_at | timestamptz | ✓ | timezone(`utc`::text, now()) |
| user_id | uuid | ✓ | - |
| id | uuid | ✗ | uuid_generate_v4() |

**FK →** user_id → `usuarios.id` | organizacion_id → `organizaciones.id` |

### chat_messages

| Column | Type | Null | Default |
|--------|------|------|---------|
| metadata | jsonb | ✓ | `{}`::jsonb |
| content | text | ✗ | - |
| role | text | ✗ | - |
| session_id | uuid | ✓ | - |
| id | uuid | ✗ | uuid_generate_v4() |
| organizacion_id | uuid | ✓ | - |
| created_at | timestamptz | ✓ | timezone(`utc`::text, now()) |

**FK →** session_id → `chat_sessions.id` | organizacion_id → `organizaciones.id` |

### conversations

| Column | Type | Null | Default |
|--------|------|------|---------|
| owner_id | uuid | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| id | uuid | ✗ | gen_random_uuid() |
| created_at | timestamptz | ✓ | now() |
| updated_at | timestamptz | ✓ | now() |
| type | text | ✗ | - |
| name | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | owner_id → `usuarios.id` |

### conversation_messages

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| usuario_id | uuid | ✗ | - |
| conversation_id | uuid | ✗ | - |
| created_at | timestamptz | ✓ | now() |
| content | text | ✗ | - |
| updated_at | timestamptz | ✓ | now() |

**FK →** usuario_id → `usuarios.id` | conversation_id → `conversations.id` |

### conversation_participants

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| conversation_id | uuid | ✗ | - |
| usuario_id | uuid | ✗ | - |
| joined_at | timestamptz | ✓ | now() |
| last_read_at | timestamptz | ✓ | now() |

**FK →** conversation_id → `conversations.id` | usuario_id → `usuarios.id` |

**Constraints:** UNIQUE(`conversation_participants_conversation_id_usuario_id_key`) on conversation_id | UNIQUE(`conversation_participants_conversation_id_usuario_id_key`) on usuario_id |

