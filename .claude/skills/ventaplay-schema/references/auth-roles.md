# Auth & Roles

> 7 tables in this domain

### usuarios

| Column | Type | Null | Default |
|--------|------|------|---------|
| ver_todos_contactos | bool | ✗ | false |
| activo | bool | ✗ | true |
| temp_password_expires_at | timestamptz | ✓ | - |
| rol | USER-DEFINED | ✓ | - |
| nombre | text | ✗ | - |
| email | text | ✗ | - |
| contraseña_hash | text | ✗ | - |
| telefono | text | ✓ | - |
| temp_password_code | text | ✓ | - |
| landing_subdomain | text | ✓ | - |
| organizacion_id | uuid | ✓ | - |
| created_at | timestamptz | ✗ | now() |
| professional_id | uuid | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| puede_gestionar_bloqueos | bool | ✓ | false |

**FK →** professional_id → `profesionales.id` | organizacion_id → `organizaciones.id` |

**Constraints:** UNIQUE(`usuarios_professional_id_unique`) on professional_id |

**Realtime publication (Tier 1c, 2026-05-12):** `usuarios` is in `supabase_realtime` publication with `REPLICA IDENTITY FULL`. AuthContext subscribes to `postgres_changes` UPDATE events filtered by `id=eq.${userId}` to detect mid-session disable (`deshabilitado=true`) or password-reset trigger (`activo=false`). REPLICA IDENTITY FULL is required so `payload.new` carries those columns — default REPLICA IDENTITY only ships PKs. Migration: `20260527120000_usuarios_realtime_publication.sql`.

### user_sessions

Tier 1c session store. Opaque 256-bit tokens issued by `login_user` (returned plaintext to client one time, never persisted plaintext server-side). Token is hashed via SHA256 hex and stored in `token_hash`. Frontend sends plaintext as `X-Session-Token` HTTP header on every PostgREST request; `get_current_custom_user_id()` reads that header from the per-transaction `request.headers` GUC and looks up the row.

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| user_id | uuid | ✗ | - |
| organizacion_id | uuid | ✓ | - (snapshot at login; NULL for super_admin) |
| token_hash | text | ✗ | - (SHA256 hex of opaque token, UNIQUE) |
| created_at | timestamptz | ✗ | now() |
| last_seen_at | timestamptz | ✗ | now() |
| expires_at | timestamptz | ✗ | - (now() + 24h, slid by bump_session_last_seen) |
| revoked_at | timestamptz | ✓ | - |
| revoked_reason | text | ✓ | - |
| ip | inet | ✓ | - |
| user_agent | text | ✓ | - |

**FK →** user_id → `usuarios.id` (ON DELETE CASCADE) | organizacion_id → `organizaciones.id` (ON DELETE SET NULL, added 2026-05-12 in `20260529120000`) |

**Constraints:** UNIQUE(`token_hash`) | CHECK `expires_at > created_at` | `revoked_reason` is free text but produced only as one of `'logout'|'admin_disable'|'password_reset'|'admin_revoke'|'expired'` by the canonical RPC paths |

**Indexes:** Partial `idx_user_sessions_token_active` on (token_hash) WHERE revoked_at IS NULL — hot lookup per request | Partial `idx_user_sessions_user_active` on (user_id) WHERE revoked_at IS NULL — bulk revoke by user | Partial `idx_user_sessions_expires` on (expires_at) WHERE revoked_at IS NULL — pg_cron sweep | Partial `idx_user_sessions_organizacion_active` on (organizacion_id) WHERE revoked_at IS NULL AND organizacion_id IS NOT NULL — supports super-admin Sesiones page org filter |

**RLS:** enabled. Policy `user_sessions_select_all` SELECT USING (`true`) — **permissive by design** (changed in `20260531120000`). The original restrictive `user_sessions_select_own` policy (`user_id = get_current_custom_user_id() OR is_super_admin()`) filtered out Supabase Realtime broadcasts (which evaluate SELECT as the **anon** role — Tier 1c keeps WebSocket auth on anon since opaque tokens can't be passed via WebSocket headers). With the restrictive policy, the per-session revoke kick was inconsistent because the broadcast never reached the affected device. Identity gate now lives entirely at the REST/RPC layer via the `X-Session-Token` header. When Tier 2 (JWT) ships, this can flip back to restrictive AND `realtime.setAuth(jwt)` together.

**Notes:**
- No UNIQUE on user_id → **multi-device by design**. Same user can have N concurrent sessions.
- `organizacion_id` is a **login-time snapshot** AND a real FK (added 2026-05-12). FK is required for PostgREST embed `organizaciones:organizacion_id (...)` used by the super-admin Sesiones page. On hard org-delete the column nullifies (`ON DELETE SET NULL`) but the session row survives for audit (the user_id audit trail is preserved).
- 24h sliding window: `bump_session_last_seen()` extends `expires_at = greatest(expires_at, now() + 24h)`. Frontend debounces ≤1×/min via 5-min interval + visibility-change.
- pg_cron job `sweep-user-sessions` (migration `20260526120100`) hourly DELETEs rows where `revoked_at < now() - interval '7 days'` OR `expires_at < now() - interval '7 days'` (7-day forensics retention).
- Token rotation: NOT implemented in Tier 1c. Tier 2 (JWT) replaces this with stateless verification.

**Canonical RPCs (all granted to `anon, authenticated`):**
- `login_user(email, password, ip, user_agent)` — INSERT new session, return plaintext token + session_id + expires_at. **`ip` and `user_agent` auto-derived from `request.headers` (`x-forwarded-for` + `user-agent`) when caller passes NULL** — frontend only sends `(email, password)`, headers fill the rest server-side. See migration `20260601120000`.
- `validate_session()` → `(valid, reason, user_id)` — used by AuthContext.enforceSessionStatus
- `revoke_current_session()` — logout
- `revoke_all_sessions_for_user(uuid, text)` — admin disable / mass revoke
- `revoke_session_by_id(uuid, text)` — single-session revoke (super-admin Sesiones page); idempotent (returns false if already revoked); auth gate is `super_admin OR same-org` (migration `20260528120000`)
- `bump_session_last_seen()` — sliding window extension
- `_current_session_token()` STABLE — internal helper, reads X-Session-Token header
- `hash_session_token(text)` IMMUTABLE — SHA256 hex helper

**Realtime publication:** `user_sessions` is in `supabase_realtime` with `REPLICA IDENTITY FULL` (migration `20260530120000`). AuthContext subscribes to UPDATE events filtered by `user_id` via the `user-sessions-${userId}` channel — when a row's `revoked_at` flips to non-null AND `payload.new.id === sessionTokenStore.getSessionId()`, the handler short-circuits directly to `logout()` without round-tripping through `validate_session` (single-frame deterministic kick).

See migrations `20260525120000_user_sessions_phase1.sql` (table + RPCs + transition `get_current_custom_user_id`), `20260526120000_user_sessions_phase2_finalize.sql` (drop GUC fallback + drop `set_current_user_id`), `20260526120100_user_sessions_cron.sql` (sweep), `20260527120000_usuarios_realtime_publication.sql` (usuarios publication for disable-detection channel), `20260528120000_add_revoke_session_by_id_rpc.sql`, `20260529120000_user_sessions_org_fk.sql`, `20260530120000_user_sessions_realtime_publication.sql`, `20260531120000_user_sessions_rls_permissive_for_realtime.sql`, `20260601120000_login_user_derive_ip_ua.sql`. Rollback at repo root: `rollback_tier1c_sessions.sql`.

### roles

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| description | text | ✓ | - |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| organization_id | uuid | ✓ | - |
| name | varchar | ✗ | - |
| display_name | varchar(100) | ✓ | - |

**FK →** organization_id → `organizaciones.id` |

**Notes:**
- `display_name` (added 2026-05-11 in `20260511174648`) holds a custom Spanish-language label per role. NULL → frontend resolver falls back to the canonical Spanish label keyed off `name` (e.g. `name='receptionist'` → "Recepcionista"). Migration `20260511175036` cleaned up an earlier mistaken backfill that copied `name` into `display_name`.

### user_roles

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| user_id | uuid | ✗ | - |
| role_id | uuid | ✗ | - |

**FK →** user_id → `usuarios.id` | role_id → `roles.id` |

### permissions

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| updated_at | timestamptz | ✗ | now() |
| name | varchar | ✗ | - |
| description | text | ✓ | - |

**Constraints:** UNIQUE(`permissions_name_key`) on name |

**Recent additions (2026-05-11/12):**
- `chat.view` — internal-conversations module access (migration `20260524120000`)
- `restaurantes.view`, `restaurantes.atender`, `restaurantes.cobrar`, `restaurantes.cancelar`, `restaurantes.cocina`, `restaurantes.menu`, `restaurantes.platos`, `restaurantes.admin` — granular Restaurant-module gates (migration `20260511184628`). Wired through PermissionsService for role-based UI visibility + RPC guards on the `/restaurantes/*` and `/cocina` flows.

### role_permissions

| Column | Type | Null | Default |
|--------|------|------|---------|
| created_at | timestamptz | ✗ | now() |
| permission_id | uuid | ✗ | - |
| updated_at | timestamptz | ✗ | now() |
| id | uuid | ✗ | gen_random_uuid() |
| role_id | uuid | ✗ | - |

**FK →** permission_id → `permissions.id` | role_id → `roles.id` |

**Constraints:** UNIQUE(`role_permissions_role_permission_unique`) on permission_id | UNIQUE(`role_permissions_role_permission_unique`) on role_id |

### autorizaciones_otp

OTP codes used to authorize sensitive actions via WhatsApp (6-digit codes, bcrypt-hashed, 5-min expiry).

| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | ✗ | gen_random_uuid() |
| organizacion_id | uuid | ✗ | - |
| codigo_hash | text | ✗ | - |
| destinatario_telefono | text | ✗ | - |
| accion | text | ✗ | - |
| estado | text | ✗ | `pendiente`::text |
| intentos_fallidos | int4 | ✗ | 0 |
| max_intentos | int4 | ✗ | 3 |
| expira_en | timestamptz | ✗ | - |
| verificado_en | timestamptz | ✓ | - |
| metadata | jsonb | ✓ | - |
| solicitado_por | uuid | ✓ | - |
| created_at | timestamptz | ✓ | now() |

**FK →** organizacion_id → `organizaciones.id` (ON DELETE CASCADE) | solicitado_por → `usuarios.id` (ON DELETE SET NULL) |

**Constraints:** CHECK `estado IN ('pendiente','verificado','expirado','fallido')` |

**Indexes:** `idx_otp_org_estado` on (organizacion_id, estado) | `idx_otp_expira` on (expira_en) |

**RLS:** enabled. Permissive policies `otp_select_own_org` (SELECT), `otp_insert` (INSERT), `otp_update` (UPDATE). Edge function uses service role; frontend access allowed for org-scoped visibility.

**Notes:**
- `accion` is a free-form label describing what the OTP authorizes (e.g. `anular_boleta`, `eliminar_servicio`).
- `metadata` carries context-specific payload for the authorized action (ids, amounts, etc.).
- Canonical caller: `useOTP` hook (see recent migration `20260413200000_create_autorizaciones_otp.sql`).

---

## Identity helpers (Tier 1c, post-2026-05-12)

These functions back every RLS policy and any RPC that needs the calling user. After Tier 1c they read identity from the `X-Session-Token` HTTP header, NOT the spoofable `app.current_user_id` GUC.

### `get_current_custom_user_id() RETURNS uuid`
STABLE SECURITY DEFINER. Reads `_current_session_token()` → looks up `user_sessions` (not revoked AND not expired) → returns `user_id`. Returns sentinel `00000000-0000-0000-0000-000000000000` if no/invalid token. **Phase 2 (`20260526120000`) removed the legacy GUC fallback** — token is the only source of truth now.

### `get_current_custom_user_organization() RETURNS uuid`
STABLE SECURITY DEFINER. SELECT `organizacion_id FROM usuarios WHERE id = get_current_custom_user_id()`. Returns sentinel UUID if user not found. **Body unchanged across Tier 1c** — automatically inherits the new identity source via `get_current_custom_user_id()`. All ~50 RLS policies using this helper kept working without rewrites.

### `is_super_admin() RETURNS boolean`
STABLE SECURITY DEFINER SQL. `SELECT COALESCE(rol = 'super_admin', false) FROM usuarios WHERE id = get_current_custom_user_id()`. Same — automatically inherits new identity source.

### `set_current_user_id(uuid) — DROPPED 2026-05-12`
Removed by `20260526120000_user_sessions_phase2_finalize.sql`. **Calling it from frontend or SQL throws `function does not exist`.** This was intentional: it was the spoof attack vector (no validation of input uuid). One stale internal caller — `login_public_user` at `20260411210000:86-91` — wraps the call in `BEGIN/EXCEPTION/END` so it just emits `RAISE NOTICE` log noise and continues normally.

### Realtime publication: `usuarios`
Migration `20260527120000_usuarios_realtime_publication.sql` adds `usuarios` to `supabase_realtime` publication and sets `REPLICA IDENTITY FULL`. Required for the AuthContext disable-detection channel `supabase.channel('usuario-status-${userId}').on('postgres_changes', ...)` to deliver `payload.new.deshabilitado` / `payload.new.activo` columns. Without `REPLICA IDENTITY FULL`, only PKs are shipped on UPDATE.

### Spoof attack closed
Pre-Tier-1c: setting `localStorage.ventaplay_user = '{"id":"<admin>",...}'` + reload was full impersonation (no password, no token). Post-Tier-1c: the AuthContext rehydration branch detects the JSON-without-token state and forces re-login with toast `"Por seguridad, hemos actualizado el sistema de sesiones..."`. Public-modal users (`localStorage.public_session = 'true'`) are exempted to preserve the public landing flow.
