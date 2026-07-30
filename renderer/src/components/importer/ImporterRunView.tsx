import { useState } from "react";
import type {
  ImportResult,
  ImporterEntity,
  ImporterProgressPayload,
  SelectedFile,
} from "../../types.ts";
import { useEnterAnimation } from "../../hooks/useEnterAnimation.ts";
import ImportSummary from "./ImportSummary.tsx";

interface Props {
  entity: ImporterEntity;
  label: string;
  organizacionId: string;
  orgNombre: string;
  progress: ImporterProgressPayload | null;
  onBack: () => void;
}

/** Destructive importers get an extra confirmation step before running. */
const CONFIRM_COPY: Partial<Record<ImporterEntity, string>> = {
  comisiones:
    "Esto reemplaza por completo la configuracion de comisiones de todos los profesionales de la organizacion. Lo que exista se pierde.",
};

export default function ImporterRunView({
  entity,
  label,
  organizacionId,
  orgNombre,
  progress,
  onBack,
}: Props) {
  const containerRef = useEnterAnimation<HTMLDivElement>(entity);
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stockPorSucursal, setStockPorSucursal] = useState(true);

  const confirmCopy = CONFIRM_COPY[entity];
  const needsConfirm = Boolean(confirmCopy) && !confirmed;

  const handlePickFile = async () => {
    const picked = await window.electronAPI.importerSelectFile();
    if (picked) {
      setFile(picked);
      setResult(null);
      setError("");
    }
  };

  const handleRun = async () => {
    if (!file) return;

    setRunning(true);
    setError("");
    setResult(null);

    try {
      const runResult = await window.electronAPI.importerRun({
        entity,
        filePath: file.path,
        organizacionId,
        options: entity === "productos" ? { usarStockPorSucursal: stockPorSucursal } : undefined,
      });
      setResult(runResult);
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
            Importar {label.toLowerCase()}
          </h2>
          <p className="text-xs text-white/40 truncate">{orgNombre}</p>
        </div>
      </div>

      {confirmCopy && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-200/90">{confirmCopy}</p>
          {!confirmed && (
            <button
              onClick={() => setConfirmed(true)}
              className="text-xs font-semibold text-amber-300 hover:text-amber-100 transition-colors cursor-pointer"
            >
              Entiendo, continuar
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
        <button
          onClick={handlePickFile}
          disabled={running || needsConfirm}
          className="w-full py-2.5 rounded-lg border border-border bg-surface-light text-sm text-white/80 hover:border-brand-purple transition-colors disabled:opacity-40 cursor-pointer"
        >
          {file ? "Cambiar archivo" : "Seleccionar archivo"}
        </button>

        {file && (
          <p className="text-xs text-brand-green/80 break-all">{file.name}</p>
        )}

        {entity === "productos" && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stockPorSucursal}
              onChange={(e) => setStockPorSucursal(e.target.checked)}
              disabled={running}
              className="mt-0.5 accent-[#8C00FF]"
            />
            <span className="text-xs text-white/55 leading-snug">
              El archivo trae columnas <code>Stock {"{sucursal}"}</code> por
              sucursal. Desmarcalo si el archivo solo tiene una columna Stock.
            </span>
          </label>
        )}
      </div>

      {running && progress && (
        <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
          <div className="flex justify-between text-xs text-white/50">
            <span>{progress.message ?? "Importando..."}</span>
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
          <div className="grid grid-cols-4 gap-2 text-center">
            <Counter label="Nuevos" value={progress.successful} tone="green" />
            <Counter
              label="Actualizados"
              value={progress.updated}
              tone="purple"
            />
            <Counter label="Omitidos" value={progress.skipped} tone="neutral" />
            <Counter label="Errores" value={progress.errorCount} tone="red" />
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
          disabled={!file || needsConfirm}
          className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 disabled:opacity-40 cursor-pointer"
        >
          {result ? "Importar de nuevo" : "Iniciar importacion"}
        </button>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "purple" | "neutral" | "red";
}) {
  const color =
    tone === "green"
      ? "text-brand-green"
      : tone === "purple"
        ? "text-brand-purple"
        : tone === "red"
          ? "text-red-400"
          : "text-white/80";

  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/40">{label}</p>
    </div>
  );
}
