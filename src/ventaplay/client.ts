import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getToken } from "./session.js";

export const SUPABASE_URL =
  process.env.VENTAPLAY_SUPABASE_URL ||
  "https://uklfdugabopbuqmpoiao.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.VENTAPLAY_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbGZkdWdhYm9wYnVxbXBvaWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDc5MDMsImV4cCI6MjA2NDM4MzkwM30.rArjcO4rYsD5kSWiWBtFpaltYiREE7i6hrWaYri7vzQ";

/**
 * Tier 1c: every REST/RPC request carries the opaque session token in the
 * X-Session-Token header. PostgREST exposes incoming headers via the
 * per-transaction `request.headers` GUC, which `get_current_custom_user_id()`
 * reads to derive the caller's user_id from `user_sessions`.
 *
 * The token is read at request time (not client-creation time) so the client
 * survives login/logout without being recreated.
 *
 * Headers must be MERGED — supabase-js sets apikey/authorization/prefer here.
 */
const sessionAwareFetch: typeof fetch = (input, init) => {
  const token = getToken();
  const headers = new Headers(init?.headers);

  // Edge Functions don't go through PostgREST and reject the header at CORS
  // preflight. Importers never call them, but the guard mirrors the web app.
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const isEdgeFunctionCall = url.includes("/functions/v1/");

  if (token && !isEdgeFunctionCall) {
    headers.set("X-Session-Token", token);
  }

  return fetch(input, { ...(init || {}), headers });
};

// Untyped on purpose: the web app's generated Database types are ~500 KB and
// the importers only touch a handful of tables. See ./types.ts.
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { fetch: sessionAwareFetch },
  },
);
