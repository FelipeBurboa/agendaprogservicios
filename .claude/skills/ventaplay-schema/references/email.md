# Communications - Email

> 5 tables in this domain

### configuracion_email

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| verified_sender_name | text | ✓ | `VentaPlay`::text |
| id | uuid | ✗ | gen_random_uuid() |
| verified_sender_email | text | ✗ | `notificaciones@ventaplay.com`::text |
| organizacion_id | uuid | ✗ | - |
| is_enabled | bool | ✗ | true |
| email_domain_id | uuid | ✓ | - |
| updated_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` | email_domain_id → `email_domains.id` (ON DELETE SET NULL) |

**Constraints:** UNIQUE(`configuracion_email_org_unique`) on organizacion_id |

**Notes:** When `email_domain_id` is set, this org sends from a Resend-verified dedicated domain. When null, it falls back to the default sender handled in `send-email` edge function. The `verified_sender_email` string is the source of truth for the `from` header; `email_domain_id` is for audit/assignment UI.

### email_templates

| Column | Type | Null | Default |
|--------|------|------|---------|
| organizacion_id | uuid | ✓ | - |
| subject_template | text | ✗ | - |
| category | text | ✓ | - |
| preview_text | text | ✓ | - |
| name | text | ✗ | - |
| thumbnail_url | text | ✓ | - |
| updated_at | timestamptz | ✓ | now() |
| plain_content | text | ✓ | - |
| created_at | timestamptz | ✓ | now() |
| html_content | text | ✗ | - |
| created_by | uuid | ✓ | - |
| is_active | bool | ✓ | true |
| variables | jsonb | ✓ | - |
| editor_json | jsonb | ✓ | - |
| template_type | text | ✗ | `builder`::text |
| id | uuid | ✗ | uuid_generate_v4() |
| description | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | created_by → `usuarios.id` |

**Constraints:** CHECK `template_type IN ('builder', 'raw_html')` |

**Notes:** `template_type` discriminates two authoring modes. `builder` = block-based EmailBuilder with variables and `editor_json`. `raw_html` = user-pasted full HTML with no variables; unsubscribe footer is auto-appended at send time by `send-email`. Raw rows have `editor_json`, `variables`, and `plain_content` set to null.

### email_logs

| Column | Type | Null | Default |
|--------|------|------|---------|
| to_name | text | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| to_email | text | ✗ | - |
| recipient_id | uuid | ✓ | - |
| sent_at | timestamptz | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| template_id | text | ✓ | - |
| resend_id | text | ✓ | - |
| status | text | ✗ | `pending`::text |
| id | uuid | ✗ | gen_random_uuid() |
| sent_by_id | uuid | ✓ | - |
| error_message | text | ✓ | - |
| attachment_count | int4 | ✓ | 0 |
| clicked_at | timestamptz | ✓ | - |
| template_data | jsonb | ✓ | - |
| opened_at | timestamptz | ✓ | - |
| subject | text | ✗ | - |
| delivered_at | timestamptz | ✓ | - |
| recipient_type | text | ✓ | - |
| html_content | text | ✓ | - |
| attachment_metadata | jsonb | ✓ | - |
| plain_content | text | ✓ | - |

**FK →** organizacion_id → `organizaciones.id` | sent_by_id → `usuarios.id` |

**Indexes:**
- `idx_email_logs_batch_id` — **partial functional index** on `((template_data->>'batch_id'))` `WHERE template_data ? 'batch_id'`. Added in `20260414130000_campana_delivery_aggregates.sql`. This is the canonical join key for email-campaign delivery reconciliation: `email_logs.template_data->>'batch_id' = campana_envios.message_id` (email rows only) AND `email_logs.to_email = campana_envios.contacto_numero`. The partial predicate keeps the index small — only campaign-batch rows are indexed, not every transactional log. Turns the `campana_delivery_counts` RPC's `email_logs` scan from sequential into an index scan.

**Notes:** The `template_data` jsonb carries per-send metadata. For rows produced by the `send-email` batch path, `template_data->>'batch_id'` is the idempotency correlation id returned by `send-email` and persisted on `campana_envios.message_id` for matching campaign envios with delivery events. Single-recipient transactional sends don't set `batch_id`, which is why the functional index is partial.

### email_events

| Column | Type | Null | Default |
|--------|------|------|---------|
| status | text | ✓ | - |
| attempt | text | ✓ | - |
| response | text | ✓ | - |
| organizacion_id | uuid | ✗ | - |
| reason | text | ✓ | - |
| url | text | ✓ | - |
| raw_event | jsonb | ✗ | - |
| user_agent | text | ✓ | - |
| resend_email_id | text | ✗ | - |
| event_id | text | ✗ | - |
| timestamp | timestamptz | ✗ | - |
| event_type | text | ✗ | - |
| email | text | ✗ | - |
| ip | inet | ✓ | - |
| id | uuid | ✗ | gen_random_uuid() |
| category | ARRAY | ✓ | - |
| processed_at | timestamptz | ✗ | now() |

**FK →** organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`email_events_event_id_unique`) on event_id |

### email_domains

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| resend_domain_id | text | ✗ | - |
| name | text | ✗ | - |
| status | text | ✗ | `not_started`::text |
| region | text | ✗ | - |
| dns_records | jsonb | ✗ | `[]`::jsonb |
| dns_mode | text | ✗ | `manual`::text |
| route53_provisioned | bool | ✗ | false |
| route53_change_id | text | ✓ | - |
| last_verified_at | timestamptz | ✓ | - |
| created_by | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |

**FK →** created_by → `usuarios.id` (ON DELETE SET NULL) |

**Constraints:**
- UNIQUE on `resend_domain_id`
- UNIQUE on `name`
- CHECK `status IN ('not_started','pending','verified','failed','temporary_failure')`
- CHECK `dns_mode IN ('route53','manual')`

**Indexes:** `idx_email_domains_status`, `idx_email_domains_resend_id`

**Notes:** Global registry of Resend sending domains managed via the superadmin Dominios tab in `src/pages/Emails.tsx`. Not org-scoped — one domain is shared across the platform, with per-org assignment happening through `configuracion_email.email_domain_id`.

- `dns_mode = 'route53'` → DNS auto-provisioned by the `email-domain-manager` edge function via `@aws-sdk/client-route-53` into the `ventaplay.com` hosted zone. Only domains matching `*.ventaplay.com` are eligible.
- `dns_mode = 'manual'` → customer manages DNS in their own panel. Records stored in `dns_records` and surfaced in the `DnsRecordsModal` for copy/paste. Status flips to `verified` automatically via the `resend-webhook` edge function on `domain.updated` events.
- `status` is backfilled by the `resend-webhook` edge function when Resend fires `domain.created` / `domain.updated`. `last_verified_at` is set when status transitions to `verified`.
- `route53_change_id` stores the AWS ChangeBatch id for debugging DNS propagation in the route53 path.

