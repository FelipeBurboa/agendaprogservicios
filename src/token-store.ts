import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { checkTokenExpiry } from "./auth.js";

/**
 * JWT cache shared by the Electron app, express server, and CLI.
 *
 * Backed by an in-memory map plus a best-effort JSON file under the user's home
 * directory, so a token survives process restarts until it expires. This keeps
 * AgendaPro from emailing a fresh MFA code on every export. All disk access is
 * wrapped in try/catch — cache I/O must never break a scrape.
 */

const STORE_DIR = path.join(os.homedir(), ".agendapro-scraper");
const STORE_FILE = path.join(STORE_DIR, "tokens.json");

const memory = new Map<string, string>();

function keyOf(email: string): string {
  return email.trim().toLowerCase();
}

function isUsable(token: string): boolean {
  try {
    checkTokenExpiry(token); // throws if < 5 min left
    return true;
  } catch {
    return false;
  }
}

function readDisk(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeDisk(data: Record<string, string>): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(data), "utf-8");
  } catch {
    // Best-effort: a missing cache just means the next login re-authenticates.
  }
}

/** Return a still-valid cached token for this email, or null. Evicts expired tokens. */
export function getToken(email: string): string | null {
  const key = keyOf(email);

  const cached = memory.get(key);
  if (cached && isUsable(cached)) return cached;
  if (cached) memory.delete(key);

  const disk = readDisk();
  const token = disk[key];
  if (token && isUsable(token)) {
    memory.set(key, token);
    return token;
  }
  if (token) {
    delete disk[key];
    writeDisk(disk);
  }
  return null;
}

/** Persist a token for this email in memory and on disk. */
export function saveToken(email: string, token: string): void {
  const key = keyOf(email);
  memory.set(key, token);
  const disk = readDisk();
  disk[key] = token;
  writeDisk(disk);
}

/** Remove any cached token for this email (e.g. on logout or a 401). */
export function clearToken(email: string): void {
  const key = keyOf(email);
  memory.delete(key);
  const disk = readDisk();
  if (key in disk) {
    delete disk[key];
    writeDisk(disk);
  }
}
