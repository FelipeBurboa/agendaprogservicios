import { useState } from "react";
import type { ExportType, ProgressData, ScraperParams, ScraperResult } from "./types.ts";
import ErrorView from "./components/ErrorView.tsx";
import LoginForm from "./components/LoginForm.tsx";
import ProgressView from "./components/ProgressView.tsx";
import ResultsView from "./components/ResultsView.tsx";

type AppView = "form" | "progress" | "results" | "error";

function getInitialProgressMessage(exportType: ExportType): string {
  switch (exportType) {
    case "services":
      return "Preparando exportación de servicios...";
    case "professionals":
      return "Preparando exportación de profesionales...";
    case "bookings":
    default:
      return "Iniciando sesión...";
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
  const [formData, setFormData] = useState<Omit<ScraperParams, "savePath">>({
    email: "",
    password: "",
    months: 1,
    bookingType: "all",
    exportType: "bookings",
  });

  const handleStart = async (data: Omit<ScraperParams, "savePath">) => {
    setFormData(data);

    const savePath = await window.electronAPI.selectSaveFolder();
    if (!savePath) return;

    setView("progress");
    setProgress({
      current: 0,
      total: 0,
      message: getInitialProgressMessage(data.exportType),
    });

    window.electronAPI.removeProgressListeners();
    window.electronAPI.onProgress((nextProgress) => setProgress(nextProgress));

    try {
      const result = await window.electronAPI.runScraper({
        ...data,
        savePath,
      });
      setResults(result);
      setView("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setView("error");
    } finally {
      window.electronAPI.removeProgressListeners();
    }
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
      {view === "progress" && <ProgressView progress={progress} />}
      {view === "results" && results && (
        <ResultsView results={results} onRestart={handleRestart} />
      )}
      {view === "error" && (
        <ErrorView message={error} onRetry={handleRestart} />
      )}
    </div>
  );
}


