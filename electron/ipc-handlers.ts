import { BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import {
  prepareBookingsScrape,
  scrapeBookingsWithContext,
  scrapeProfessionals,
  scrapeServices,
} from "../src/scraper.js";
import {
  calculateBookingsEstimatedMs,
  formatDurationMs,
} from "../src/bookings-runtime.js";
import { fmtDate } from "../src/dates.js";
import {
  generateProfessionalsWorkbookFile,
  generateServicesWorkbookFile,
  generateSucursalesWorkbookFile,
  generateWorkbookFile,
} from "../src/excel.js";
import type { BookingsScrapeContext } from "../src/scraper.js";
import type {
  ProgressData,
  ResultMetric,
  ScraperParams,
  ScraperResult,
} from "./preload";

function emitProgress(
  win: BrowserWindow,
  current: number,
  total: number,
  message: string
): void {
  const data: ProgressData = { current, total, message };
  win.webContents.send("scraper:progress", data);
}

function metric(
  label: string,
  value: number,
  tone: ResultMetric["tone"]
): ResultMetric {
  return { label, value, tone };
}

function buildBookingsEstimateMessage(context: BookingsScrapeContext): string {
  const totalRequests = context.locations.length * context.days.length;
  const estimatedDuration = formatDurationMs(
    calculateBookingsEstimatedMs(totalRequests)
  );

  return [
    `Rango ${fmtDate(context.rangeStart)} a ${fmtDate(context.rangeEnd)}`,
    `${context.days.length} dias`,
    `${context.locations.length} sucursales`,
    `${totalRequests} solicitudes`,
    `Aprox. ${estimatedDuration}`,
  ].join(" | ");
}

async function runBookingsExport(
  win: BrowserWindow,
  params: ScraperParams
): Promise<ScraperResult> {
  emitProgress(win, 0, 1, "Iniciando sesion y calculando carga de exportacion...");

  const context = await prepareBookingsScrape({
    email: params.email,
    password: params.password,
    months: params.months,
    past_months: params.pastMonths,
  });

  const totalRequests = context.locations.length * context.days.length;
  const progressTotal = Math.max(totalRequests, 1);
  emitProgress(win, 0, progressTotal, buildBookingsEstimateMessage(context));

  const result = await scrapeBookingsWithContext(context);

  emitProgress(
    win,
    progressTotal,
    progressTotal,
    "Generando archivos Excel..."
  );

  const files: string[] = [];
  let reservedCount = 0;
  let blockedCount = 0;

  for (const rows of result.reserved.values()) reservedCount += rows.length;
  for (const rows of result.blocked.values()) blockedCount += rows.length;

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

  return {
    exportType: "bookings",
    metrics: [
      metric("Reservas", reservedCount, "purple"),
      metric("Bloqueos", blockedCount, "green"),
    ],
    files,
  };
}

async function runServicesExport(
  win: BrowserWindow,
  params: ScraperParams
): Promise<ScraperResult> {
  emitProgress(win, 1, 3, "Iniciando sesion y extrayendo servicios...");
  const rows = await scrapeServices({
    email: params.email,
    password: params.password,
  });

  emitProgress(win, 2, 3, `Servicios encontrados: ${rows.length}`);
  const filePath = path.join(params.savePath, "services.xlsx");
  await generateServicesWorkbookFile(rows, filePath);
  emitProgress(win, 3, 3, "services.xlsx generado");

  return {
    exportType: "services",
    metrics: [metric("Servicios", rows.length, "purple")],
    files: [filePath],
  };
}

async function runProfessionalsExport(
  win: BrowserWindow,
  params: ScraperParams
): Promise<ScraperResult> {
  emitProgress(win, 1, 4, "Iniciando sesion y extrayendo profesionales...");
  const result = await scrapeProfessionals({
    email: params.email,
    password: params.password,
  });

  emitProgress(
    win,
    2,
    4,
    `Profesionales: ${result.professionals.length} | Sucursales: ${result.sucursales.length}`
  );

  const files: string[] = [];
  const professionalsFilePath = path.join(params.savePath, "professionals.xlsx");
  emitProgress(win, 3, 4, "Generando professionals.xlsx...");
  await generateProfessionalsWorkbookFile(result.sheets, professionalsFilePath);
  files.push(professionalsFilePath);

  if (result.hasMultipleSucursales) {
    const sucursalesFilePath = path.join(params.savePath, "sucursales.xlsx");
    emitProgress(win, 4, 4, "Generando sucursales.xlsx...");
    await generateSucursalesWorkbookFile(result.sucursales, sucursalesFilePath);
    files.push(sucursalesFilePath);
  } else {
    emitProgress(win, 4, 4, "Exportacion finalizada");
  }

  return {
    exportType: "professionals",
    metrics: [
      metric("Profesionales", result.professionals.length, "purple"),
      metric("Sucursales", result.sucursales.length, "green"),
    ],
    files,
  };
}

export function registerIpcHandlers(): void {
  ipcMain.handle("scraper:select-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Seleccionar carpeta de destino",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "scraper:run",
    async (event, params: ScraperParams): Promise<ScraperResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) throw new Error("No window found");

      const originalLog = console.log;
      const progressRegex = /\[(\d+)\/(\d+)\]\s+(.+)/;

      console.log = (...args: unknown[]) => {
        originalLog(...args);
        const msg = args.map(String).join(" ");
        const match = msg.match(progressRegex);
        if (match) {
          emitProgress(
            win,
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            match[3].trim()
          );
        }
      };

      try {
        switch (params.exportType) {
          case "services":
            return await runServicesExport(win, params);
          case "professionals":
            return await runProfessionalsExport(win, params);
          case "bookings":
          default:
            return await runBookingsExport(win, params);
        }
      } finally {
        console.log = originalLog;
      }
    }
  );
}
