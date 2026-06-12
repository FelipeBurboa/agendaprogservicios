/**
 * Probe AgendaPro auth endpoints to confirm request/response shapes.
 * Logs shapes only (header names, body keys, JWT-looking flags) — never secrets.
 *
 * Phase 1 (request MFA code, saves session to scripts/.probe-session):
 *   npx tsx scripts/probe-auth.ts <email> <password>
 *
 * Phase 2 (verify code from email, uses saved session):
 *   npx tsx scripts/probe-auth.ts <email> <password> <code>
 */
import * as fs from "fs";
import * as path from "path";

const AUTH_BASE = "https://agendapro.com/authentication";
const SESSION_FILE = path.join(__dirname, ".probe-session");

const [email, password, code] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npx tsx scripts/probe-auth.ts <email> <password> [code]");
  process.exit(1);
}

function authHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://app.agendapro.com",
    referer: "https://app.agendapro.com/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "accept-language": "es-419,es;q=0.9,en;q=0.8",
  };
}

function looksLikeJwt(value: unknown): boolean {
  return typeof value === "string" && value.replace(/^Bearer\s+/i, "").split(".").length === 3;
}

function describeValue(value: unknown): string {
  if (looksLikeJwt(value)) return `<JWT-like string, length ${(value as string).length}>`;
  if (typeof value === "string") return `<string, length ${value.length}>`;
  if (value === null) return "null";
  if (Array.isArray(value)) return `<array, ${value.length} items>`;
  if (typeof value === "object") return `{ ${Object.keys(value as object).join(", ")} }`;
  return `<${typeof value}>`;
}

async function dumpResponse(label: string, res: Response): Promise<any> {
  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log("Response header names:");
  for (const [name, value] of res.headers.entries()) {
    const flag = name.toLowerCase() === "authorization" ? `  <-- AUTHORIZATION (JWT-like: ${looksLikeJwt(value)})` : "";
    console.log(`  ${name}${flag}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!contentType.includes("json")) {
    console.log(`NON-JSON response (content-type: ${contentType || "none"}), first 300 chars:`);
    console.log(text.slice(0, 300));
    return undefined;
  }
  try {
    const body = JSON.parse(text);
    console.log("Body shape:");
    if (body && typeof body === "object" && !Array.isArray(body)) {
      for (const [key, value] of Object.entries(body)) {
        console.log(`  ${key}: ${describeValue(value)}`);
      }
    } else {
      console.log(`  ${describeValue(body)}`);
    }
    return body;
  } catch {
    console.log("JSON parse failed, first 300 chars:");
    console.log(text.slice(0, 300));
    return undefined;
  }
}

function findJwt(res: Response, body: any): string | undefined {
  const header = res.headers.get("authorization");
  if (looksLikeJwt(header)) return header!.replace(/^Bearer\s+/i, "");
  const candidates = [body?.token, body?.jwt, body?.access_token, body?.authorization];
  for (const c of candidates) if (looksLikeJwt(c)) return (c as string).replace(/^Bearer\s+/i, "");
  if (body && typeof body === "object") {
    for (const nested of [body.data, body.user]) {
      if (nested && typeof nested === "object") {
        for (const v of Object.values(nested)) if (looksLikeJwt(v)) return (v as string).replace(/^Bearer\s+/i, "");
      }
    }
  }
  return undefined;
}

async function probeApiCall(token: string): Promise<void> {
  const res = await fetch(
    "https://ap-api.agendapro.com/agenda-core-bff/v1/calendar/locations?per_page=8&search_key=&page=1",
    {
      headers: {
        accept: "application/json",
        authorization: token,
        origin: "https://app.agendapro.com",
        referer: "https://app.agendapro.com/",
      },
    }
  );
  console.log(`\n=== Token smoke test (locations API) ===`);
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const body = await res.json().catch(() => undefined);
    console.log(`Body shape: ${describeValue(body)}`);
    console.log("TOKEN WORKS.");
  } else {
    console.log((await res.text()).slice(0, 200));
  }
}

async function main(): Promise<void> {
  if (!code) {
    // Phase 1: sign_in
    const res = await fetch(`${AUTH_BASE}/sign_in`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ username: email, password }),
    });
    const body = await dumpResponse("POST /authentication/sign_in", res);

    if (res.status === 422 && typeof body?.session === "string") {
      fs.writeFileSync(SESSION_FILE, body.session, "utf-8");
      console.log(`\nMFA required. Session saved to ${SESSION_FILE}`);
      console.log("A 6-digit code was emailed. Re-run with the code:");
      console.log(`  npx tsx scripts/probe-auth.ts <email> <password> <code>`);
      return;
    }
    const token = findJwt(res, body);
    if (token) {
      console.log("\nNo MFA — token found directly.");
      await probeApiCall(token);
    } else {
      console.log("\nUnexpected response — no MFA session and no token found.");
    }
    return;
  }

  // Phase 2: sign_in_with_mfa_code
  if (!fs.existsSync(SESSION_FILE)) {
    console.error(`No saved session at ${SESSION_FILE}. Run phase 1 first.`);
    process.exit(1);
  }
  const session = fs.readFileSync(SESSION_FILE, "utf-8").trim();
  const res = await fetch(`${AUTH_BASE}/sign_in_with_mfa_code`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username: email, password, code, session }),
  });
  const body = await dumpResponse("POST /authentication/sign_in_with_mfa_code", res);
  const token = findJwt(res, body);
  if (token) {
    console.log("\nJWT located. Source: " + (looksLikeJwt(res.headers.get("authorization")) ? "Authorization response header" : "response body"));
    await probeApiCall(token);
  } else {
    console.log("\nNO JWT FOUND in header or common body fields — inspect shape above.");
  }
}

main().catch((err) => {
  console.error("Probe failed:", (err as Error).message);
  process.exit(1);
});
