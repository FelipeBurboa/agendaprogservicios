import { contextBridge, ipcRenderer } from "electron";

export type ExportType = "bookings" | "services" | "professionals";
export type BookingType = "all" | "reserved" | "blocked";
export type MetricTone = "purple" | "green" | "neutral";

export interface ScraperParams {
  email: string;
  password: string;
  months: number;
  pastMonths?: number;
  bookingType: BookingType;
  exportType: ExportType;
  savePath: string;
}

export interface ResultMetric {
  label: string;
  value: number;
  tone: MetricTone;
}

export interface ScraperResult {
  exportType: ExportType;
  metrics: ResultMetric[];
  files: string[];
}

export interface ProgressData {
  current: number;
  total: number;
  message: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
  selectSaveFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("scraper:select-folder"),

  runScraper: (params: ScraperParams): Promise<ScraperResult> =>
    ipcRenderer.invoke("scraper:run", params),

  onProgress: (callback: (data: ProgressData) => void): void => {
    ipcRenderer.on("scraper:progress", (_event, data: ProgressData) =>
      callback(data)
    );
  },

  removeProgressListeners: (): void => {
    ipcRenderer.removeAllListeners("scraper:progress");
  },
});
