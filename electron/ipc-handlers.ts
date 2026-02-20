import { ipcMain, dialog, BrowserWindow } from "electron";
import * as path from "path";
import { scrapeBookings } from "../src/scraper.js";
import { generateWorkbookFile } from "../src/excel.js";
import type { ScraperParams, ScraperResult, ProgressData } from "./preload";

export function registerIpcHandlers(): void {
  // ── Folder picker ────────────────────────────────────────────────────────
  ipcMain.handle("scraper:select-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Seleccionar carpeta de destino",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── Run scraper ──────────────────────────────────────────────────────────
  ipcMain.handle(
    "scraper:run",
    async (event, params: ScraperParams): Promise<ScraperResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) throw new Error("No window found");

      // Intercept console.log to parse progress and forward to renderer
      const originalLog = console.log;
      const progressRegex = /\[(\d+)\/(\d+)\]\s+(.+)/;

      console.log = (...args: unknown[]) => {
        originalLog(...args);
        const msg = args.map(String).join(" ");
        const match = msg.match(progressRegex);
        if (match) {
          const data: ProgressData = {
            current: parseInt(match[1], 10),
            total: parseInt(match[2], 10),
            message: match[3].trim(),
          };
          win.webContents.send("scraper:progress", data);
        }
      };

      try {
        // Run the scraper
        const result = await scrapeBookings({
          email: params.email,
          password: params.password,
          months: params.months,
        });

        const files: string[] = [];
        let reservedCount = 0;
        let blockedCount = 0;

        // Count totals
        for (const rows of result.reserved.values()) reservedCount += rows.length;
        for (const rows of result.blocked.values()) blockedCount += rows.length;

        // Generate Excel files based on booking type
        if (params.bookingType === "all" || params.bookingType === "reserved") {
          if (reservedCount > 0) {
            const filePath = path.join(params.savePath, "bookings-reserved.xlsx");
            await generateWorkbookFile(
              "reserved",
              result.locations,
              result.reserved,
              filePath
            );
            files.push(filePath);
          }
        }

        if (params.bookingType === "all" || params.bookingType === "blocked") {
          if (blockedCount > 0) {
            const filePath = path.join(params.savePath, "bookings-blocked.xlsx");
            await generateWorkbookFile(
              "blocked",
              result.locations,
              result.blocked,
              filePath
            );
            files.push(filePath);
          }
        }

        return { reserved: reservedCount, blocked: blockedCount, files };
      } finally {
        // Always restore original console.log
        console.log = originalLog;
      }
    }
  );
}
