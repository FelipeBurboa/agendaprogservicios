import type { MetricTone, ScraperResult } from "../types.ts";

interface Props {
  results: ScraperResult;
  onRestart: () => void;
}

function getTitle(results: ScraperResult): string {
  switch (results.exportType) {
    case "all":
      return results.failures?.length
        ? "Exportacion completada con errores"
        : "Exportacion completa";
    case "services":
      return "Servicios exportados";
    case "products":
      return "Inventario exportado";
    case "professionals":
      return "Profesionales exportados";
    case "comisiones":
      return "Comisiones exportadas";
    case "bookings":
    default:
      return "Extraccion completada";
  }
}

function getDescription(results: ScraperResult): string {
  switch (results.exportType) {
    case "all":
      return results.failures?.length
        ? "Algunas exportaciones fallaron. Los archivos que si se generaron quedaron en la carpeta seleccionada."
        : "Todos los archivos ya quedaron listos en la carpeta seleccionada.";
    case "services":
      return "El catalogo de servicios ya quedo listo en la carpeta seleccionada.";
    case "products":
      return "El inventario de productos ya quedo listo en la carpeta seleccionada.";
    case "professionals":
      return results.files.some((file) => file.endsWith("sucursales.xlsx"))
        ? "Los archivos de profesionales y sucursales ya quedaron listos en la carpeta seleccionada."
        : "El archivo de profesionales ya quedo listo en la carpeta seleccionada.";
    case "comisiones":
      return "Las comisiones de servicios y productos ya quedaron listas en la carpeta seleccionada.";
    case "bookings":
    default:
      return "Los archivos exportados ya quedaron listos en la carpeta seleccionada.";
  }
}

function getMetricColorClass(tone: MetricTone): string {
  switch (tone) {
    case "green":
      return "text-brand-green";
    case "neutral":
      return "text-white/90";
    case "purple":
    default:
      return "text-brand-purple";
  }
}

function getGridClass(metricCount: number): string {
  if (metricCount >= 3) return "grid-cols-3";
  if (metricCount === 2) return "grid-cols-2";
  return "grid-cols-1";
}

// Every file lands in the same chosen folder, so show it once and list names.
function splitFolder(files: string[]): { folder: string; names: string[] } {
  const folder = files[0]?.replace(/[\\/][^\\/]*$/, "") ?? "";
  return {
    folder,
    names: files.map((file) => file.slice(file.search(/[^\\/]*$/))),
  };
}

export default function ResultsView({ results, onRestart }: Props) {
  const metrics = results.metrics.filter((metric) => Number.isFinite(metric.value));
  const { folder, names } = splitFolder(results.files);
  // Metrics and files sit side by side on wide windows when there are both.
  const twoColumns = metrics.length > 0 && names.length > 0;

  return (
    <div
      className={`w-full flex flex-col items-center gap-6 pt-12 ${
        twoColumns ? "max-w-md md:max-w-3xl" : "max-w-md"
      }`}
    >
      <div className="w-16 h-16 rounded-full bg-brand-green/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-brand-green"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white/90">
          {getTitle(results)}
        </h2>
        <p className="text-sm text-white/55 max-w-sm">{getDescription(results)}</p>
      </div>

      {results.failures && results.failures.length > 0 && (
        <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300 mb-2">No se pudo exportar:</p>
          <ul className="space-y-1.5">
            {results.failures.map((failure) => (
              <li key={failure} className="text-xs text-red-300/85 break-words">
                {failure}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`w-full grid gap-6 md:items-start ${twoColumns ? "md:grid-cols-2" : ""}`}
      >
        {metrics.length > 0 && (
          <div className={`w-full grid ${getGridClass(metrics.length)} gap-3`}>
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-surface rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${getMetricColorClass(metric.tone)}`}>
                  {metric.value}
                </p>
                <p className="text-xs text-white/50 mt-1">{metric.label}</p>
              </div>
            ))}
          </div>
        )}

        {names.length > 0 && (
          <div className="w-full bg-surface rounded-lg p-4">
            <p className="text-sm font-medium text-white/70">Archivos generados:</p>
            <p className="text-xs text-white/40 mt-1 mb-3 break-all">{folder}</p>
            <ul className="space-y-1.5">
              {names.map((file) => (
                <li
                  key={file}
                  className="text-xs text-brand-green/80 break-all flex items-start gap-2"
                >
                  <svg
                    className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onRestart}
        className="w-full max-w-md py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 cursor-pointer"
      >
        Nueva exportacion
      </button>
    </div>
  );
}
