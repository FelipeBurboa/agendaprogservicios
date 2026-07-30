import { BrowserWindow, dialog, ipcMain } from "electron";
import * as fs from "fs";
import { loginUser, logout } from "../src/ventaplay/auth.js";
import { supabase } from "../src/ventaplay/client.js";
import { listOrganizaciones } from "../src/ventaplay/orgs.js";
import { getStatus, isExpired, getToken } from "../src/ventaplay/session.js";
import {
  ImportAbortedError,
  errorMessage,
  type ImportContext,
  type ImportOptions,
  type ImportResult,
  type ImportRowError,
  type ImporterEntity,
  type ImporterProgressPayload,
} from "../src/ventaplay/types.js";
import { importSucursales } from "../src/ventaplay/importers/sucursales.js";
import { importServicios } from "../src/ventaplay/importers/servicios.js";
import { importProductos } from "../src/ventaplay/importers/productos.js";
import { importClientes } from "../src/ventaplay/importers/clientes.js";
import { importProfesionales } from "../src/ventaplay/importers/profesionales.js";
import { importComisiones } from "../src/ventaplay/importers/comisiones.js";
import { importCitas } from "../src/ventaplay/importers/citas.js";
import { importBloqueos } from "../src/ventaplay/importers/bloqueos.js";
import {
  generarAtenciones,
  previewAtenciones,
} from "../src/ventaplay/importers/generar-atenciones.js";

type FileImporter = (
  filePath: string,
  ctx: ImportContext,
) => Promise<ImportResult>;

const IMPORTERS: Record<ImporterEntity, FileImporter> = {
  sucursales: importSucursales,
  servicios: importServicios,
  productos: importProductos,
  clientes: importClientes,
  profesionales: importProfesionales,
  comisiones: importComisiones,
  citas: importCitas,
  bloqueos: importBloqueos,
};

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

/**
 * One import at a time, mirroring the scraper's pendingMfa singleton. The
 * importers hold big in-memory lookup maps and write to shared tables, so
 * concurrent runs would collide.
 */
let currentRun: { controller: AbortController; entity: string } | null = null;

/** Full error list stays here; only the first 50 ever cross IPC. */
let lastRunErrors: { entity: string; errors: ImportRowError[] } | null = null;

/**
 * Last payload seen from the running importer. Importers signal cancellation
 * by throwing, which discards their tracker, so this is how a cancelled run
 * still reports how many rows it actually got through.
 */
let lastProgress: ImporterProgressPayload | null = null;

function sendProgress(progress: ImporterProgressPayload): void {
  lastProgress = progress;
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send("importer:progress", progress);
  }
}

function requireSession(): void {
  if (!getToken() || isExpired()) {
    throw new Error(
      "SESSION_EXPIRED: La sesion de VentaPlay expiro. Vuelve a iniciar sesion.",
    );
  }
}

function buildContext(
  organizacionId: string,
  signal: AbortSignal,
  options?: ImportOptions,
): ImportContext {
  return {
    supabase,
    organizacionId,
    onProgress: sendProgress,
    signal,
    options,
  };
}

function cancelledResult(
  entity: ImporterEntity | "atenciones",
  errors: ImportRowError[],
): ImportResult {
  const partial = lastProgress?.entity === entity ? lastProgress : null;
  const summary: ImporterProgressPayload = {
    entity,
    total: partial?.total ?? 0,
    processed: partial?.processed ?? 0,
    successful: partial?.successful ?? 0,
    updated: partial?.updated ?? 0,
    skipped: partial?.skipped ?? 0,
    errorCount: partial?.errorCount ?? errors.length,
    currentBatch: partial?.currentBatch ?? 0,
    totalBatches: partial?.totalBatches ?? 0,
    status: "cancelled",
    message: "Importacion cancelada. Las filas ya procesadas quedaron guardadas.",
  };
  sendProgress(summary);
  return {
    summary,
    errorsPreview: errors.slice(0, 50),
    totalErrors: errors.length,
    allErrors: errors,
  };
}

/** The renderer never needs the full error list — it would bloat the IPC payload. */
function stripFullErrors(result: ImportResult): Omit<ImportResult, "allErrors"> {
  const { allErrors: _allErrors, ...rest } = result;
  return rest;
}

async function runGuarded(
  entity: ImporterEntity | "atenciones",
  organizacionId: string,
  run: (ctx: ImportContext) => Promise<ImportResult>,
  options?: ImportOptions,
): Promise<Omit<ImportResult, "allErrors">> {
  requireSession();

  if (!organizacionId) {
    throw new Error("Debes seleccionar una organizacion.");
  }

  if (currentRun) {
    throw new Error(
      `IMPORT_IN_PROGRESS: Ya hay una importacion en curso (${currentRun.entity}).`,
    );
  }

  const controller = new AbortController();
  currentRun = { controller, entity };
  lastRunErrors = { entity, errors: [] };

  try {
    const ctx = buildContext(organizacionId, controller.signal, options);
    const result = await run(ctx);
    lastRunErrors = { entity, errors: result.allErrors };
    return stripFullErrors(result);
  } catch (error) {
    if (error instanceof ImportAbortedError) {
      return stripFullErrors(
        cancelledResult(entity, lastRunErrors?.errors ?? []),
      );
    }
    sendProgress({
      entity,
      total: 0,
      processed: 0,
      successful: 0,
      updated: 0,
      skipped: 0,
      errorCount: 0,
      currentBatch: 0,
      totalBatches: 0,
      status: "error",
      message: errorMessage(error),
    });
    throw error;
  } finally {
    currentRun = null;
  }
}

function toCsv(errors: ImportRowError[]): string {
  const headers = ["Fila", "Hoja", "Error", "Dato"];
  const escape = (value: string): string =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const lines = [
    headers.join(","),
    ...errors.map((item) =>
      [
        String(item.row),
        item.sheet ?? "",
        item.error ?? "",
        item.data ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ];

  // BOM so Excel opens UTF-8 correctly.
  return "﻿" + lines.join("\n");
}

function timestampSlug(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

export function registerImporterIpcHandlers(): void {
  ipcMain.handle(
    "importer:login",
    async (_event, creds: { email: string; password: string }) =>
      loginUser(creds.email, creds.password),
  );

  ipcMain.handle("importer:logout", () => {
    logout();
  });

  ipcMain.handle("importer:session-status", () => getStatus());

  ipcMain.handle("importer:list-orgs", async () => {
    requireSession();
    return listOrganizaciones();
  });

  ipcMain.handle("importer:select-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Excel / CSV", extensions: ["xlsx", "xls", "csv"] },
        { name: "Todos los archivos", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    return { path: filePath, name: filePath.split(/[\\/]/).pop() ?? filePath };
  });

  ipcMain.handle("importer:run", async (_event, params: ImporterRunParams) => {
    const importer = IMPORTERS[params.entity];
    if (!importer) {
      throw new Error(`Importador desconocido: ${params.entity}`);
    }

    return runGuarded(
      params.entity,
      params.organizacionId,
      (ctx) => importer(params.filePath, ctx),
      params.options,
    );
  });

  ipcMain.handle("importer:cancel", () => {
    currentRun?.controller.abort();
  });

  ipcMain.handle(
    "importer:atenciones-preview",
    async (_event, params: AtencionesParams) => {
      requireSession();
      if (!params.organizacionId) {
        throw new Error("Debes seleccionar una organizacion.");
      }
      const controller = new AbortController();
      const ctx = buildContext(params.organizacionId, controller.signal);
      const count = await previewAtenciones(
        ctx,
        params.fechaInicio,
        params.fechaFin,
      );
      return { count };
    },
  );

  ipcMain.handle(
    "importer:atenciones-run",
    async (_event, params: AtencionesParams) =>
      runGuarded("atenciones", params.organizacionId, (ctx) =>
        generarAtenciones(ctx, params.fechaInicio, params.fechaFin),
      ),
  );

  ipcMain.handle("importer:save-error-csv", async () => {
    if (!lastRunErrors || lastRunErrors.errors.length === 0) return null;

    const result = await dialog.showSaveDialog({
      defaultPath: `errores-${lastRunErrors.entity}-${timestampSlug()}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (result.canceled || !result.filePath) return null;

    fs.writeFileSync(result.filePath, toCsv(lastRunErrors.errors), "utf8");
    return result.filePath;
  });
}
