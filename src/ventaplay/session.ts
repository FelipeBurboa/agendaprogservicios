/**
 * VentaPlay session-token singleton (main process).
 *
 * Mirrors the web app's `sessionTokenStore`, minus localStorage: the token is
 * a credential, so it lives in memory only and dies with the process. Relaunch
 * means logging in again, which is cheap.
 *
 * Never log the token.
 */

interface SessionState {
  token: string | null;
  exp: number | null;
  sessionId: string | null;
  email: string | null;
  userId: string | null;
  nombre: string | null;
}

const state: SessionState = {
  token: null,
  exp: null,
  sessionId: null,
  email: null,
  userId: null,
  nombre: null,
};

export function getToken(): string | null {
  return state.token;
}

export function getExp(): number | null {
  return state.exp;
}

export function getUserId(): string | null {
  return state.userId;
}

export function setSession(params: {
  token: string;
  expiresAtIso: string;
  sessionId?: string | null;
  email: string;
  userId: string;
  nombre: string;
}): void {
  state.token = params.token;
  state.exp = Math.floor(new Date(params.expiresAtIso).getTime() / 1000);
  state.sessionId = params.sessionId ?? null;
  state.email = params.email;
  state.userId = params.userId;
  state.nombre = params.nombre;
}

export function clearSession(): void {
  state.token = null;
  state.exp = null;
  state.sessionId = null;
  state.email = null;
  state.userId = null;
  state.nombre = null;
}

export function isExpired(): boolean {
  if (!state.token) return true;
  if (state.exp === null) return false;
  return state.exp <= Math.floor(Date.now() / 1000);
}

export interface SessionStatus {
  loggedIn: boolean;
  email?: string;
  nombre?: string;
  expiresAt?: string;
}

export function getStatus(): SessionStatus {
  if (!state.token || isExpired()) {
    return { loggedIn: false };
  }
  return {
    loggedIn: true,
    email: state.email ?? undefined,
    nombre: state.nombre ?? undefined,
    expiresAt: state.exp ? new Date(state.exp * 1000).toISOString() : undefined,
  };
}
