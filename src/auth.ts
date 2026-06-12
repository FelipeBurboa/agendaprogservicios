import type { AuthOptions, MfaCodeRequest } from "./types.js";

const AUTH_BASE = "https://agendapro.com/authentication";
const ORIGIN = "https://app.agendapro.com";
const DEFAULT_MAX_MFA_ATTEMPTS = 3;

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Bad credentials, unexpected response, or a Cloudflare/non-JSON challenge. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Sign-in succeeded but the account needs an emailed 6-digit code. */
export class MfaRequiredError extends Error {
  session: string;
  constructor(session: string, message = "Two-factor authentication required") {
    super(message);
    this.name = "MfaRequiredError";
    this.session = session;
  }
}

/** The submitted MFA code was wrong/expired. Carries a fresh session if the API returned one. */
export class MfaCodeError extends Error {
  session?: string;
  constructor(message: string, session?: string) {
    super(message);
    this.name = "MfaCodeError";
    this.session = session;
  }
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: ORIGIN,
    referer: `${ORIGIN}/`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "accept-language": "es-419,es;q=0.9,en;q=0.8",
  };
}

async function postJson(
  pathSeg: string,
  payload: Record<string, unknown>
): Promise<{ res: Response; body: any }> {
  const res = await fetch(`${AUTH_BASE}/${pathSeg}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const text = await res.text().catch(() => "");
    throw new AuthError(
      `Unexpected non-JSON response from ${pathSeg} (status ${res.status}). ` +
        `This may be a Cloudflare challenge. First 120 chars: ${text.slice(0, 120)}`
    );
  }

  const body = await res.json().catch(() => undefined);
  return { res, body };
}

function looksLikeJwt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.replace(/^Bearer\s+/i, "").split(".").length === 3
  );
}

function stripBearer(value: string): string {
  return value.replace(/^Bearer\s+/i, "");
}

/**
 * Locate the JWT in an auth response. AgendaPro returns it in the `token` body
 * field (verified), but we also check the Authorization header and common
 * fallbacks so a backend tweak doesn't silently break login.
 */
function extractToken(res: Response, body: any): string {
  if (looksLikeJwt(body?.token)) return stripBearer(body.token);

  const header = res.headers.get("authorization");
  if (looksLikeJwt(header)) return stripBearer(header);

  const candidates = [body?.jwt, body?.access_token, body?.authorization];
  for (const c of candidates) if (looksLikeJwt(c)) return stripBearer(c);

  if (body && typeof body === "object") {
    for (const nested of [body.data, body.user]) {
      if (nested && typeof nested === "object") {
        for (const v of Object.values(nested)) {
          if (looksLikeJwt(v)) return stripBearer(v);
        }
      }
    }
  }

  const keys = body && typeof body === "object" ? Object.keys(body).join(", ") : typeof body;
  throw new AuthError(`Could not locate JWT in auth response. Body keys: ${keys}`);
}

function errorMessageFromBody(body: any, fallback: string): string {
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.message === "string") return body.message;
  if (Array.isArray(body?.errors) && body.errors.length) return String(body.errors[0]);
  return fallback;
}

// ─── Auth steps ────────────────────────────────────────────────────────────────

export type SignInResult =
  | { kind: "token"; token: string }
  | { kind: "mfa"; session: string };

/** POST sign_in. Returns a token (no MFA) or an MFA session blob (code emailed). */
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const { res, body } = await postJson("sign_in", { username: email, password });

  if (res.ok) {
    return { kind: "token", token: extractToken(res, body) };
  }

  if (res.status === 422 && typeof body?.session === "string") {
    return { kind: "mfa", session: body.session };
  }

  throw new AuthError(
    errorMessageFromBody(body, `Sign-in failed (status ${res.status}). Check credentials.`)
  );
}

/** POST sign_in_with_mfa_code. Returns the JWT, or throws MfaCodeError on a bad/expired code. */
export async function verifyMfaCode(
  email: string,
  password: string,
  code: string,
  session: string
): Promise<string> {
  const { res, body } = await postJson("sign_in_with_mfa_code", {
    username: email,
    password,
    code,
    session,
  });

  if (res.ok) {
    return extractToken(res, body);
  }

  const message = errorMessageFromBody(
    body,
    `Invalid or expired code (status ${res.status}).`
  );
  throw new MfaCodeError(
    message,
    typeof body?.session === "string" ? body.session : undefined
  );
}

/**
 * Log in and return a JWT.
 * - No MFA → returns the token directly.
 * - MFA + no `onMfaCodeRequest` → throws MfaRequiredError(session).
 * - MFA + callback → prompts for the code (up to maxMfaAttempts), supports resend.
 */
export async function loginAndGetToken(
  email: string,
  password: string,
  options: AuthOptions = {}
): Promise<string> {
  const result = await signIn(email, password);
  if (result.kind === "token") {
    return result.token;
  }

  let session = result.session;

  if (!options.onMfaCodeRequest) {
    throw new MfaRequiredError(session);
  }

  const maxAttempts = options.maxMfaAttempts ?? DEFAULT_MAX_MFA_ATTEMPTS;
  let previousError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resend = async (): Promise<void> => {
      const refreshed = await signIn(email, password);
      if (refreshed.kind === "mfa") {
        session = refreshed.session;
      } else {
        // Account stopped requiring MFA mid-flow — nothing to resend.
        throw new MfaCodeError("Sign-in no longer requires a code; please retry.");
      }
    };

    const request: MfaCodeRequest = { attempt, previousError, resend };
    const code = await options.onMfaCodeRequest(request);

    try {
      return await verifyMfaCode(email, password, code, session);
    } catch (err) {
      if (!(err instanceof MfaCodeError)) throw err;
      previousError = err.message;
      if (err.session) session = err.session;
    }
  }

  throw new MfaCodeError(`Failed to verify code after ${maxAttempts} attempts.`);
}

/**
 * Check JWT expiry. Throws if token expires in < 5 minutes.
 * Returns remaining seconds, or undefined if expiry couldn't be decoded.
 */
export function checkTokenExpiry(jwt: string): number | undefined {
  try {
    const payloadB64 = jwt.split(".")[1];
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, "base64url").toString("utf-8")
    );
    const exp: number | undefined = payload.exp;
    if (exp) {
      const remaining = exp - Date.now() / 1000;
      if (remaining < 300) {
        throw new Error(
          `Token expires in ${Math.round(remaining)}s (< 5 min). Aborting.`
        );
      }
      return remaining;
    }
    return undefined;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Token expires")) throw err;
    return undefined;
  }
}
