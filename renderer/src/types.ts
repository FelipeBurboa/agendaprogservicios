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

// ─── VentaPlay importer ─────────────────────────────────────────────────
// Mirrored from electron/preload.ts. Keep both in sync.

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

export interface ElectronAPI {
  selectSaveFolder: () => Promise<string | null>;
  runScraper: (params: ScraperParams) => Promise<ScraperResult>;
  onProgress: (callback: (data: ProgressData) => void) => void;
  removeProgressListeners: () => void;
  onMfaRequired: (callback: (data: MfaRequiredData) => void) => void;
  onMfaResent: (callback: () => void) => void;
  onMfaTimeout: (callback: () => void) => void;
  submitMfaCode: (code: string) => Promise<void>;
  resendMfaCode: () => Promise<void>;
  cancelMfa: () => Promise<void>;
  removeMfaListeners: () => void;

  importerLogin: (creds: {
    email: string;
    password: string;
  }) => Promise<VpLoginResult>;
  importerLogout: () => Promise<void>;
  importerSessionStatus: () => Promise<VpSessionStatus>;
  importerListOrgs: () => Promise<OrgSummary[]>;
  importerSelectFile: () => Promise<SelectedFile | null>;
  importerRun: (params: ImporterRunParams) => Promise<ImportResult>;
  importerCancel: () => Promise<void>;
  importerAtencionesPreview: (
    params: AtencionesParams,
  ) => Promise<{ count: number }>;
  importerAtencionesRun: (params: AtencionesParams) => Promise<ImportResult>;
  importerSaveErrorCsv: () => Promise<string | null>;
  onImporterProgress: (
    callback: (data: ImporterProgressPayload) => void,
  ) => void;
  removeImporterProgressListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
