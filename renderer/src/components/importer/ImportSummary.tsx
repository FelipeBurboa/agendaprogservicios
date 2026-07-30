import { useState } from "react";
import type { ImportResult } from "../../types.ts";

interface Props {
  result: ImportResult;
}

export default function ImportSummary({ result }: Props) {
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const { summary } = result;
  const cancelled = summary.status === "cancelled";

  const handleSaveCsv = async () => {
    const path = await window.electronAPI.importerSaveErrorCsv();
    if (path) setSavedPath(path);
  };

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            cancelled ? "bg-amber-400" : "bg-brand-green"
          }`}
        />
        <p className="text-sm font-semibold text-white/85">
          {cancelled ? "Importacion cancelada" : "Importacion completada"}
        </p>
      </div>

      {summary.message && (
        <p className="text-xs text-white/50">{summary.message}</p>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Nuevos" value={summary.successful} tone="green" />
        <Stat label="Actualizados" value={summary.updated} tone="purple" />
        <Stat label="Omitidos" value={summary.skipped} tone="neutral" />
        <Stat label="Errores" value={result.totalErrors} tone="red" />
      </div>

      {result.errorsPreview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">
              Primeros {result.errorsPreview.length} de {result.totalErrors}
            </p>
            <button
              onClick={handleSaveCsv}
              className="text-xs font-semibold text-brand-purple hover:text-white transition-colors cursor-pointer"
            >
              Guardar CSV de errores
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-[#3D3550]">
            {result.errorsPreview.map((item, index) => (
              <div key={index} className="px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] text-white/35">
                  <span>Fila {item.row}</span>
                  {item.sheet && <span>Hoja: {item.sheet}</span>}
                  {item.data && <span className="truncate">{item.data}</span>}
                </div>
                <p className="text-xs text-red-300/85 break-words">
                  {item.error}
                </p>
              </div>
            ))}
          </div>

          {savedPath && (
            <p className="text-xs text-brand-green/80 break-all">
              Guardado en {savedPath}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
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
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}
