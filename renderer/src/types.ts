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

export interface MfaRequiredData {
  attempt: number;
  error?: string;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
