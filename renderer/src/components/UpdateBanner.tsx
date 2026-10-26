import { useEffect, useState } from "react";

type UpdateState =
  | { kind: "none" }
  | { kind: "available"; version: string; downloadUrl: string } // mac: manual download
  | { kind: "downloaded"; version: string }; // win: ready to install

/**
 * Update notice pinned above the mode switch. Windows arrives here with the
 * update already downloaded (installs on click or on next quit); mac only
 * gets a download link because unsigned builds can't self-install.
 */
interface Props {
  /** A scrape is running; restarting now would kill it. */
  busy?: boolean;
}

export default function UpdateBanner({ busy = false }: Props) {
  const [state, setState] = useState<UpdateState>({ kind: "none" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI.removeUpdaterListeners();
    window.electronAPI.onUpdaterAvailable(({ version, downloadUrl }) =>
      setState({ kind: "available", version, downloadUrl }),
    );
    window.electronAPI.onUpdaterDownloaded(({ version }) =>
      setState({ kind: "downloaded", version }),
    );

    return () => window.electronAPI.removeUpdaterListeners();
  }, []);

  if (state.kind === "none" || dismissed) return null;

  const isDownloaded = state.kind === "downloaded";
  const installBlocked = isDownloaded && busy;

  return (
    <div className="w-full max-w-md mb-3">
      <div className="flex items-center gap-3 rounded-xl border border-brand-purple/40 bg-brand-purple/10 px-4 py-2.5">
        <span className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0" />
        <p className="text-xs text-white/80 flex-1 min-w-0">
          {isDownloaded
            ? `Actualizacion lista (v${state.version})`
            : `Nueva version disponible (v${state.version})`}
        </p>
        <button
          onClick={() =>
            isDownloaded
              ? void window.electronAPI.updaterInstall()
              : void window.electronAPI.updaterOpenDownload(state.downloadUrl)
          }
          disabled={installBlocked}
          title={installBlocked ? "Disponible al terminar la exportacion" : undefined}
          className="text-xs font-semibold text-brand-purple hover:text-white transition-colors cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-brand-purple"
        >
          {isDownloaded ? "Reiniciar ahora" : "Descargar"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="text-white/35 hover:text-white transition-colors cursor-pointer flex-shrink-0"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
