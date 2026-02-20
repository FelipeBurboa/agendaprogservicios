import { useState } from "react";
import type { ScraperParams, ScraperResult, ProgressData } from "./types.ts";
import LoginForm from "./components/LoginForm.tsx";
import ProgressView from "./components/ProgressView.tsx";
import ResultsView from "./components/ResultsView.tsx";
import ErrorView from "./components/ErrorView.tsx";

type AppView = "form" | "progress" | "results" | "error";

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
  });

  const handleStart = async (data: Omit<ScraperParams, "savePath">) => {
    setFormData(data);

    // Ask user to pick save folder first
    const savePath = await window.electronAPI.selectSaveFolder();
    if (!savePath) return; // User cancelled

    setView("progress");
    setProgress({ current: 0, total: 0, message: "Iniciando sesión..." });

    // Listen for progress updates
    window.electronAPI.removeProgressListeners();
    window.electronAPI.onProgress((p) => setProgress(p));

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
    <div className="min-h-screen bg-bg flex flex-col items-center px-6 pt-8 pb-10">
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
