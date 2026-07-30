import { useState } from "react";
import type {
  ExportType,
  MfaRequiredData,
  ProgressData,
  ScraperParams,
  ScraperResult,
} from "./types.ts";
import ErrorView from "./components/ErrorView.tsx";
import LoginForm from "./components/LoginForm.tsx";
import MfaPrompt from "./components/MfaPrompt.tsx";
import ProgressView from "./components/ProgressView.tsx";
import ResultsView from "./components/ResultsView.tsx";

type AppView = "form" | "progress" | "mfa" | "results" | "error";

function getInitialProgress(exportType: ExportType): ProgressData {
  switch (exportType) {
    case "services":
      return {
        current: 0,
        total: 1,
        message: "Preparando exportacion de servicios...",
      };
    case "professionals":
      return {
        current: 0,
        total: 1,
        message: "Preparando exportacion de profesionales...",
      };
    case "products":
      return {
        current: 0,
        total: 1,
        message: "Preparando exportacion de inventario...",
      };
    case "comisiones":
      return {
        current: 0,
        total: 1,
        message: "Preparando exportacion de comisiones...",
      };
    case "bookings":
    default:
      return {
        current: 0,
        total: 1,
        message: "Iniciando sesion y calculando carga de exportacion...",
      };
  }
}

export default function App() {
  const [view, setView] = useState<AppView>("form");
  const [progress, setProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    message: "",
  });
  const [results, setResults] = useState<ScraperResult | null>(null);
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState<MfaRequiredData>({ attempt: 1 });
  const [resendNonce, setResendNonce] = useState(0);
  const [formData, setFormData] = useState<Omit<ScraperParams, "savePath">>({
    email: "",
    password: "",
    months: 1,
    pastMonths: undefined,
    bookingType: "all",
    exportType: "bookings",
  });

  const handleStart = async (data: Omit<ScraperParams, "savePath">) => {
    setFormData(data);

    const savePath = await window.electronAPI.selectSaveFolder();
    if (!savePath) return;

    setView("progress");
    setProgress(getInitialProgress(data.exportType));

    window.electronAPI.removeProgressListeners();
    window.electronAPI.onProgress((nextProgress) => setProgress(nextProgress));

    window.electronAPI.removeMfaListeners();
    window.electronAPI.onMfaRequired((mfaData) => {
      setMfa(mfaData);
      setView("mfa");
    });
    window.electronAPI.onMfaResent(() => setResendNonce((n) => n + 1));

    try {
      const result = await window.electronAPI.runScraper({
        ...data,
        savePath,
      });
      setResults(result);
      setView("results");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("MFA_CANCELLED")) {
        setView("form");
      } else if (message.includes("MFA_TIMEOUT")) {
        setError("El codigo de verificacion expiro. Vuelve a intentarlo.");
        setView("error");
      } else {
        setError(message);
        setView("error");
      }
    } finally {
      window.electronAPI.removeProgressListeners();
      window.electronAPI.removeMfaListeners();
    }
  };

  const handleSubmitMfa = (code: string) => {
    setView("progress");
    void window.electronAPI.submitMfaCode(code).catch(() => {});
  };

  const handleRestart = () => {
    setView("form");
    setResults(null);
    setError("");
    setProgress({ current: 0, total: 0, message: "" });
  };

  return (
    <div className="min-h-screen w-full bg-bg flex flex-col items-center px-6 pt-4 pb-6">
      {view === "form" && (
        <LoginForm initialData={formData} onSubmit={handleStart} />
      )}
      {view === "progress" && (
        <ProgressView progress={progress} exportType={formData.exportType} />
      )}
      {view === "mfa" && (
        <MfaPrompt
          attempt={mfa.attempt}
          error={mfa.error}
          resendNonce={resendNonce}
          onSubmit={handleSubmitMfa}
          onResend={() => void window.electronAPI.resendMfaCode().catch(() => {})}
          onCancel={() => void window.electronAPI.cancelMfa().catch(() => {})}
        />
      )}
      {view === "results" && results && (
        <ResultsView results={results} onRestart={handleRestart} />
      )}
      {view === "error" && (
        <ErrorView message={error} onRetry={handleRestart} />
      )}
    </div>
  );
}
