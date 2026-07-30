import { useState } from "react";
import type { VpLoginResult } from "../../types.ts";
import { useEnterAnimation } from "../../hooks/useEnterAnimation.ts";

interface Props {
  onSuccess: (session: { email: string; nombre: string }) => void;
}

export default function VentaPlayLogin({ onSuccess }: Props) {
  const containerRef = useEnterAnimation<HTMLDivElement>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      const result: VpLoginResult = await window.electronAPI.importerLogin({
        email: email.trim(),
        password,
      });

      if (result.ok) {
        onSuccess({ email: result.user.email, nombre: result.user.nombre });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      data-anim
      className="w-full max-w-md flex flex-col items-center gap-6 pt-10"
    >
      <div className="w-16 h-16 rounded-full bg-brand-purple/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-brand-purple"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 11c0-1.105.895-2 2-2h4a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h4m2 0V7a4 4 0 00-8 0v2"
          />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white/90">
          Conectar con VentaPlay
        </h2>
        <p className="text-sm text-white/55 max-w-sm">
          Inicia sesion con una cuenta de super administrador para importar
          datos a una organizacion.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            placeholder="admin@ventaplay.cl"
            className="px-4 py-2.5 rounded-lg bg-surface-light border border-border text-white placeholder-white/40 outline-none focus:border-brand-purple transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50">Contrasena</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="********"
            className="px-4 py-2.5 rounded-lg bg-surface-light border border-border text-white placeholder-white/40 outline-none focus:border-brand-purple transition-colors"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Verificando..." : "Iniciar sesion"}
        </button>
      </form>
    </div>
  );
}
