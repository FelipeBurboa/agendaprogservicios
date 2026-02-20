export interface ScraperParams {
  email: string;
  password: string;
  months: number;
  bookingType: "all" | "reserved" | "blocked";
  savePath: string;
}

export interface ScraperResult {
  reserved: number;
  blocked: number;
  files: string[];
}

export interface ProgressData {
  current: number;
  total: number;
  message: string;
}

export interface ElectronAPI {
  selectSaveFolder: () => Promise<string | null>;
  runScraper: (params: ScraperParams) => Promise<ScraperResult>;
  onProgress: (callback: (data: ProgressData) => void) => void;
  removeProgressListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
