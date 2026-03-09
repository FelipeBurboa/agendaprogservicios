import type { MetricTone, ScraperResult } from "../types.ts";

interface Props {
  results: ScraperResult;
  onRestart: () => void;
}

function getTitle(exportType: ScraperResult["exportType"]): string {
  switch (exportType) {
    case "services":
      return "Servicios exportados";
    case "professionals":
      return "Profesionales exportados";
    case "bookings":
    default:
      return "Extraccion completada";
  }
}

function getDescription(results: ScraperResult): string {
  switch (results.exportType) {
    case "services":
      return "El catalogo de servicios ya quedo listo en la carpeta seleccionada.";
    case "professionals":
      return results.files.some((file) => file.endsWith("sucursales.xlsx"))
        ? "Los archivos de profesionales y sucursales ya quedaron listos en la carpeta seleccionada."
        : "El archivo de profesionales ya quedo listo en la carpeta seleccionada.";
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

export default function ResultsView({ results, onRestart }: Props) {
  const metrics = results.metrics.filter((metric) => Number.isFinite(metric.value));

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 pt-12">
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
          {getTitle(results.exportType)}
        </h2>
        <p className="text-sm text-white/55 max-w-sm">{getDescription(results)}</p>
      </div>

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

      {results.files.length > 0 && (
        <div className="w-full bg-surface rounded-lg p-4">
          <p className="text-sm font-medium text-white/70 mb-2">
            Archivos generados:
          </p>
          <ul className="space-y-1.5">
            {results.files.map((file) => (
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

      <button
        onClick={onRestart}
        className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 cursor-pointer"
      >
        Nueva exportacion
      </button>
    </div>
  );
}
