import { supabase } from "./client.js";
import { clearSession, setSession } from "./session.js";

export type LoginErrorCode =
  | "invalid"
  | "disabled"
  | "inactive"
  | "not_superadmin"
  | "no_session"
  | "network";

export type LoginResult =
  | {
      ok: true;
      user: { id: string; nombre: string; email: string };
      expiresAt: string;
    }
  | { ok: false; error: LoginErrorCode; message: string };

interface LoginUserRow {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  deshabilitado?: boolean;
  organizacion_id?: string | null;
  session_token?: string | null;
  expires_at?: string | null;
  session_id?: string | null;
}

/**
 * Replicates the web app's login flow (AuthContext.login), restricted to
 * super admins. Check order matters: `deshabilitado` is a permanent admin
 * block and outranks `activo === false`, which is just the password-reset
 * intermediate state.
 *
 * The session token must be stored BEFORE the role lookup — that query needs
 * the X-Session-Token header or RLS returns nothing.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResult> {
  let rows: LoginUserRow[] | null;

  try {
    const { data, error } = await supabase.rpc("login_user", {
      user_email: email,
      user_password: password,
      remember_me: false,
    });

    if (error) {
      return {
        ok: false,
        error: "network",
        message: "No se pudo conectar con VentaPlay. Revisa tu conexion.",
      };
    }
    rows = data as LoginUserRow[] | null;
  } catch {
    return {
      ok: false,
      error: "network",
      message: "No se pudo conectar con VentaPlay. Revisa tu conexion.",
    };
  }

  if (!rows || rows.length === 0) {
    return {
      ok: false,
      error: "invalid",
      message: "Credenciales invalidas.",
    };
  }

  const user = rows[0];

  if (user.deshabilitado === true) {
    return {
      ok: false,
      error: "disabled",
      message: "Usuario deshabilitado. Contacta a un administrador.",
    };
  }

  if (user.activo === false) {
    return {
      ok: false,
      error: "inactive",
      message: "Usuario inactivo. Debes restablecer tu contrasena.",
    };
  }

  if (!user.session_token || !user.expires_at) {
    return {
      ok: false,
      error: "no_session",
      message: "VentaPlay no entrego una sesion valida. Intenta nuevamente.",
    };
  }

  setSession({
    token: user.session_token,
    expiresAtIso: user.expires_at,
    sessionId: user.session_id ?? null,
    email: user.email,
    userId: user.id,
    nombre: user.nombre,
  });

  const isSuperAdmin = await hasSuperAdminRole(user.id);
  if (!isSuperAdmin) {
    clearSession();
    return {
      ok: false,
      error: "not_superadmin",
      message: "Acceso solo para super administradores.",
    };
  }

  return {
    ok: true,
    user: { id: user.id, nombre: user.nombre, email: user.email },
    expiresAt: user.expires_at,
  };
}

async function hasSuperAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", userId);

  if (error || !data) return false;

  return (data as Array<{ role: { name?: string } | null }>).some(
    (row) => row.role?.name === "super_admin",
  );
}

export function logout(): void {
  clearSession();
}
