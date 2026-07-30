import { useState } from "react";
import type { ImportResult, ImporterProgressPayload } from "../../types.ts";
import { useEnterAnimation } from "../../hooks/useEnterAnimation.ts";
import ImportSummary from "./ImportSummary.tsx";

interface Props {
  organizacionId: string;
  orgNombre: string;
  progress: ImporterProgressPayload | null;
  onBack: () => void;
}

export default function GenerarAtencionesView({
  organizacionId,
  orgNombre,
  progress,
  onBack,
}: Props) {
  const containerRef = useEnterAnimation<HTMLDivElement>("atenciones");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const rangeReady = Boolean(fechaInicio && fechaFin && fechaInicio <= fechaFin);

  const handlePreview = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { count } = await window.electronAPI.importerAtencionesPreview({
        organizacionId,
        fechaInicio,
        fechaFin,
      });
      setPreview(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const runResult = await window.electronAPI.importerAtencionesRun({
        organizacionId,
        fechaInicio,
        fechaFin,
      });
      setResult(runResult);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  return (
    <div
      ref={containerRef}
      data-anim
      className="w-full max-w-md flex flex-col gap-5 pt-6"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          disabled={running}
          className="text-white/40 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white/90">
            Generar atenciones
          </h2>
          <p className="text-xs text-white/40 truncate">{orgNombre}</p>
        </div>
      </div>

      <p className="text-sm text-white/55">
        Crea atenciones y consumos a partir de las citas completadas dentro del
        rango. Importa las citas primero.
      </p>

      <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={running}
              className="px-3 py-2 rounded-lg bg-surface-light border border-border text-white text-sm outline-none focus:border-brand-purple transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={running}
              className="px-3 py-2 rounded-lg bg-surface-light border border-border text-white text-sm outline-none focus:border-brand-purple transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={!rangeReady || busy || running}
          className="w-full py-2.5 rounded-lg border border-border bg-surface-light text-sm text-white/80 hover:border-brand-purple transition-colors disabled:opacity-40 cursor-pointer"
        >
          {busy ? "Contando..." : "Previsualizar"}
        </button>

        {preview !== null && (
          <p className="text-sm text-brand-green/85">
            {preview === 0
              ? "No hay citas completadas pendientes en ese rango."
              : `${preview} citas generaran atenciones.`}
          </p>
        )}
      </div>

      {running && progress && (
        <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
          <div className="flex justify-between text-xs text-white/50">
            <span>{progress.message ?? "Generando..."}</span>
            <span>
              {progress.processed}/{progress.total}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-light overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-green transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300 break-words">{error}</p>
        </div>
      )}

      {result && <ImportSummary result={result} />}

      {running ? (
        <button
          onClick={() => void window.electronAPI.importerCancel()}
          className="w-full py-3 rounded-lg font-semibold text-white/70 border border-border hover:border-red-500/50 hover:text-red-300 transition-all duration-300 cursor-pointer"
        >
          Cancelar
        </button>
      ) : (
        <button
          onClick={handleRun}
          disabled={!rangeReady}
          className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 disabled:opacity-40 cursor-pointer"
        >
          Generar atenciones
        </button>
      )}
    </div>
  );
}
