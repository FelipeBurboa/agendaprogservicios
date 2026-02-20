import { contextBridge, ipcRenderer } from "electron";

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
