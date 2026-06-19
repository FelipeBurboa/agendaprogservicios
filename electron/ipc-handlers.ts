import { BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import {
  prepareBookingsScrape,
  scrapeBookingsWithContext,
  scrapeProducts,
  scrapeProfessionals,
  scrapeServices,
} from "../src/scraper.js";
import {
  calculateBookingsEstimatedMs,
  formatDurationMs,
} from "../src/bookings-runtime.js";
import { fmtDate } from "../src/dates.js";
import {
  generateProductsWorkbookFile,
  generateProfessionalsWorkbookFile,
  generateServicesWorkbookFile,
  generateSucursalesWorkbookFile,
  generateWorkbookFile,
} from "../src/excel.js";
import type { BookingsScrapeContext } from "../src/scraper.js";
import type { MfaCodeCallback } from "../src/types.js";
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

// ─── Interactive MFA (single concurrent run) ───────────────────────────────────
// A scrape's login may need a 6-digit code from the user. We park the
// onMfaCodeRequest promise here and resolve/reject it from renderer IPC calls.

const MFA_WAIT_MS = 14 * 60 * 1000; // codes expire ~14 min

interface PendingMfa {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout | null;
  resend: () => Promise<void>;
  win: BrowserWindow;
}

let pendingMfa: PendingMfa | null = null;

function clearPendingMfa(): void {
  if (pendingMfa?.timer) clearTimeout(pendingMfa.timer);
  pendingMfa = null;
}

function armMfaTimer(): void {
  if (!pendingMfa) return;
  if (pendingMfa.timer) clearTimeout(pendingMfa.timer);
  pendingMfa.timer = setTimeout(() => {
    const p = pendingMfa;
    pendingMfa = null;
    if (p) {
      p.win.webContents.send("scraper:mfa-timeout");
      p.reject(new Error("MFA_TIMEOUT"));
    }
  }, MFA_WAIT_MS);
}

function buildMfaCallback(win: BrowserWindow): MfaCodeCallback {
  return (request) =>
    new Promise<string>((resolve, reject) => {
      clearPendingMfa(); // supersede any stale request
      pendingMfa = { resolve, reject, timer: null, resend: request.resend, win };
      armMfaTimer();
      win.webContents.send("scraper:mfa-required", {
        attempt: request.attempt,
        error: request.previousError,
      });
    });
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

  const context = await prepareBookingsScrape(
    {
      email: params.email,
      password: params.password,
      months: params.months,
      past_months: params.pastMonths,
    },
    { onMfaCodeRequest: buildMfaCallback(win) }
  );

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
  const rows = await scrapeServices(
    {
      email: params.email,
      password: params.password,
    },
    { onMfaCodeRequest: buildMfaCallback(win) }
  );

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
  const result = await scrapeProfessionals(
    {
      email: params.email,
      password: params.password,
    },
    { onMfaCodeRequest: buildMfaCallback(win) }
  );

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

  const sucursalesFilePath = path.join(params.savePath, "sucursales.xlsx");
  emitProgress(win, 4, 4, "Generando sucursales.xlsx...");
  await generateSucursalesWorkbookFile(result.sucursales, sucursalesFilePath);
  files.push(sucursalesFilePath);

  return {
    exportType: "professionals",
    metrics: [
      metric("Profesionales", result.professionals.length, "purple"),
      metric("Sucursales", result.sucursales.length, "green"),
    ],
    files,
  };
}

async function runProductsExport(
  win: BrowserWindow,
  params: ScraperParams
): Promise<ScraperResult> {
  emitProgress(win, 1, 3, "Iniciando sesion y extrayendo inventario...");
  const { rows, locationNames } = await scrapeProducts(
    {
      email: params.email,
      password: params.password,
    },
    { onMfaCodeRequest: buildMfaCallback(win) }
  );

  emitProgress(win, 2, 3, `Productos encontrados: ${rows.length}`);
  const filePath = path.join(params.savePath, "productos.xlsx");
  await generateProductsWorkbookFile(rows, locationNames, filePath);
  emitProgress(win, 3, 3, "productos.xlsx generado");

  return {
    exportType: "products",
    metrics: [
      metric("Productos", rows.length, "purple"),
      metric("Sucursales", locationNames.length, "green"),
    ],
    files: [filePath],
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

  ipcMain.handle("scraper:mfa-submit", (_event, code: string) => {
    if (!pendingMfa) return;
    const p = pendingMfa;
    clearPendingMfa();
    p.resolve(code);
  });

  ipcMain.handle("scraper:mfa-resend", async () => {
    if (!pendingMfa) return;
    const p = pendingMfa;
    try {
      await p.resend(); // fresh sign_in → new emailed code + rotated session
      if (pendingMfa === p) {
        armMfaTimer(); // reset the 14-min window; promise stays pending
        p.win.webContents.send("scraper:mfa-resent");
      }
    } catch (err) {
      if (pendingMfa === p) clearPendingMfa();
      p.reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  ipcMain.handle("scraper:mfa-cancel", () => {
    if (!pendingMfa) return;
    const p = pendingMfa;
    clearPendingMfa();
    p.reject(new Error("MFA_CANCELLED"));
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
          case "products":
            return await runProductsExport(win, params);
          case "professionals":
            return await runProfessionalsExport(win, params);
          case "bookings":
          default:
            return await runBookingsExport(win, params);
        }
      } finally {
        console.log = originalLog;
        clearPendingMfa();
      }
    }
  );
}
