import { chromium } from "playwright";
import type { AuthState } from "./types.js";

/**
 * Launch a headless browser, log in to AgendaPro, and return the JWT token.
 * No file I/O — the storage state is extracted in-memory.
 */
export async function loginAndGetToken(
  email: string,
  password: string
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("https://app.agendapro.com/sign_in", {
      waitUntil: "networkidle",
    });

    const emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[name="user[email]"], input#user_email, input[placeholder*="mail"], input[placeholder*="correo"]'
      )
      .first();
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(password);

    const loginButton = page
      .locator(
        'button[type="submit"], input[type="submit"], button:has-text("Iniciar"), button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Ingresar")'
      )
      .first();
    await loginButton.click();

    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract storage state in-memory (no file path)
    const state = (await context.storageState()) as AuthState;
    const authCookie = state.cookies.find(
      (c) => c.name === "ap_cognito_authorization"
    );
    if (!authCookie) {
      throw new Error(
        "No authorization cookie found after login. Check credentials."
      );
    }
    return authCookie.value.replace(/^Bearer\s+/, "");
  } finally {
    await browser.close();
  }
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
