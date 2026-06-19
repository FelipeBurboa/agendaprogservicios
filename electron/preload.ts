import { contextBridge, ipcRenderer } from "electron";

export type ExportType = "bookings" | "services" | "professionals" | "products";
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

export interface MfaRequiredData {
  attempt: number;
  error?: string;
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

  // ─── MFA (two-factor) ───────────────────────────────────────────────────
  onMfaRequired: (callback: (data: MfaRequiredData) => void): void => {
    ipcRenderer.on("scraper:mfa-required", (_event, data: MfaRequiredData) =>
      callback(data)
    );
  },

  onMfaResent: (callback: () => void): void => {
    ipcRenderer.on("scraper:mfa-resent", () => callback());
  },

  onMfaTimeout: (callback: () => void): void => {
    ipcRenderer.on("scraper:mfa-timeout", () => callback());
  },

  submitMfaCode: (code: string): Promise<void> =>
    ipcRenderer.invoke("scraper:mfa-submit", code),

  resendMfaCode: (): Promise<void> => ipcRenderer.invoke("scraper:mfa-resend"),

  cancelMfa: (): Promise<void> => ipcRenderer.invoke("scraper:mfa-cancel"),

  removeMfaListeners: (): void => {
    ipcRenderer.removeAllListeners("scraper:mfa-required");
    ipcRenderer.removeAllListeners("scraper:mfa-resent");
    ipcRenderer.removeAllListeners("scraper:mfa-timeout");
  },
});
