import { useEffect, useRef, useState } from "react";

interface Props {
  attempt: number;
  error?: string;
  /** Bumped by the parent when a fresh code is sent, to restart the countdown. */
  resendNonce: number;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
}

const CODE_TTL_SECONDS = 14 * 60; // codes expire ~14 min

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MfaPrompt({
  attempt,
  error,
  resendNonce,
  onSubmit,
  onResend,
  onCancel,
}: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(CODE_TTL_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input + submitting whenever a new attempt arrives (e.g. wrong code).
  useEffect(() => {
    setCode("");
    setSubmitting(false);
    inputRef.current?.focus();
  }, [attempt, error]);

  // Restart the countdown on first mount, each new attempt, and each resend.
  useEffect(() => {
    setRemaining(CODE_TTL_SECONDS);
    const id = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [attempt, resendNonce]);

  const expired = remaining === 0;
  const valid = /^\d{6}$/.test(code);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting || expired) return;
    setSubmitting(true);
    onSubmit(code);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md flex flex-col items-center gap-5 pt-10"
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
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-white/90">
          Autenticacion de dos factores
        </h1>
        <p className="text-sm text-white/50">
          Ingresa el codigo de 6 digitos enviado a tu email.
        </p>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full px-4 py-3 rounded-lg bg-surface-light border border-border text-white text-center text-2xl tracking-[0.5em] placeholder-white/30 outline-none focus:border-brand-purple transition-colors"
      />

      <p className="text-xs text-white/40">
        {expired
          ? "El codigo expiro. Solicita uno nuevo."
          : `El codigo expira en ${formatMmSs(remaining)}`}
      </p>

      {error && (
        <div className="w-full bg-surface rounded-lg p-3">
          <p className="text-sm text-red-400/90 break-words">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || submitting || expired}
        className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? "Verificando..." : "Verificar"}
      </button>

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={onResend}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-lg font-medium text-white/80 bg-surface-light border border-border hover:border-brand-purple transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Reenviar codigo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg font-medium text-white/60 bg-transparent border border-border hover:text-white/90 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
