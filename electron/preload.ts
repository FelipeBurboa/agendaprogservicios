import { contextBridge, ipcRenderer } from "electron";

export type ExportType =
  | "bookings"
  | "services"
  | "professionals"
  | "products"
  | "comisiones";
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

// ─── VentaPlay importer ───────────────────────────────────────────────────
// Types mirrored from src/ventaplay/types.ts. Keep preload.ts and
// renderer/src/types.ts in sync when changing any of these.

export type ImporterEntity =
  | "clientes"
  | "sucursales"
  | "servicios"
  | "productos"
  | "profesionales"
  | "comisiones"
  | "citas"
  | "bloqueos";

export type ImportStatus =
  | "idle"
  | "parsing"
  | "importing"
  | "done"
  | "cancelled"
  | "error";

export interface ImporterProgressPayload {
  entity: ImporterEntity | "atenciones";
  total: number;
  processed: number;
  successful: number;
  updated: number;
  skipped: number;
  errorCount: number;
  currentBatch: number;
  totalBatches: number;
  status: ImportStatus;
  message?: string;
}

export interface ImportRowError {
  row: number;
  sheet?: string;
  error: string;
  data?: string;
}

export interface ImportResult {
  summary: ImporterProgressPayload;
  errorsPreview: ImportRowError[];
  totalErrors: number;
}

export interface OrgSummary {
  id: string;
  nombre: string;
}

export type VpLoginResult =
  | {
      ok: true;
      user: { id: string; nombre: string; email: string };
      expiresAt: string;
    }
  | { ok: false; error: string; message: string };

export interface VpSessionStatus {
  loggedIn: boolean;
  email?: string;
  nombre?: string;
  expiresAt?: string;
}

export interface ImportOptions {
  usarStockPorSucursal?: boolean;
}

export interface ImporterRunParams {
  entity: ImporterEntity;
  filePath: string;
  organizacionId: string;
  options?: ImportOptions;
}

export interface AtencionesParams {
  organizacionId: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface SelectedFile {
  path: string;
  name: string;
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

  // ─── VentaPlay importer ─────────────────────────────────────────────────
  importerLogin: (creds: {
    email: string;
    password: string;
  }): Promise<VpLoginResult> => ipcRenderer.invoke("importer:login", creds),

  importerLogout: (): Promise<void> => ipcRenderer.invoke("importer:logout"),

  importerSessionStatus: (): Promise<VpSessionStatus> =>
    ipcRenderer.invoke("importer:session-status"),

  importerListOrgs: (): Promise<OrgSummary[]> =>
    ipcRenderer.invoke("importer:list-orgs"),

  importerSelectFile: (): Promise<SelectedFile | null> =>
    ipcRenderer.invoke("importer:select-file"),

  importerRun: (params: ImporterRunParams): Promise<ImportResult> =>
    ipcRenderer.invoke("importer:run", params),

  importerCancel: (): Promise<void> => ipcRenderer.invoke("importer:cancel"),

  importerAtencionesPreview: (
    params: AtencionesParams,
  ): Promise<{ count: number }> =>
    ipcRenderer.invoke("importer:atenciones-preview", params),

  importerAtencionesRun: (params: AtencionesParams): Promise<ImportResult> =>
    ipcRenderer.invoke("importer:atenciones-run", params),

  importerSaveErrorCsv: (): Promise<string | null> =>
    ipcRenderer.invoke("importer:save-error-csv"),

  onImporterProgress: (
    callback: (data: ImporterProgressPayload) => void,
  ): void => {
    ipcRenderer.on(
      "importer:progress",
      (_event, data: ImporterProgressPayload) => callback(data),
    );
  },

  removeImporterProgressListeners: (): void => {
    ipcRenderer.removeAllListeners("importer:progress");
  },
});
