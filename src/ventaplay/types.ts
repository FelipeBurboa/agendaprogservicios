import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** Full error list. Kept main-side for the CSV export; stripped before IPC. */
  allErrors: ImportRowError[];
}

export interface ImportOptions {
  /**
   * Productos only. When on, stock is read from per-sucursal `Stock {nombre}`
   * columns and a file missing them is rejected outright. AgendaPro product
   * exports include those columns, so this defaults on.
   */
  usarStockPorSucursal?: boolean;
}

export interface ImportContext {
  supabase: SupabaseClient;
  organizacionId: string;
  onProgress: (progress: ImporterProgressPayload) => void;
  signal: AbortSignal;
  options?: ImportOptions;
}

/** Thrown when ctx.signal aborts mid-run; the IPC layer turns it into a cancelled result. */
export class ImportAbortedError extends Error {
  constructor() {
    super("IMPORT_CANCELLED");
    this.name = "ImportAbortedError";
  }
}

export const BATCH_SIZE = 500;
export const BATCH_DELAY_MS = 100;
export const MAX_RETRIES = 3;

/**
 * Progress bookkeeping shared by every importer. Mirrors the React progress
 * state the web hooks keep, minus React.
 */
export class ProgressTracker {
  private readonly errors: ImportRowError[] = [];
  private lastEmit = 0;

  readonly state: ImporterProgressPayload;

  constructor(
    entity: ImporterEntity | "atenciones",
    private readonly emit: (p: ImporterProgressPayload) => void,
  ) {
    this.state = {
      entity,
      total: 0,
      processed: 0,
      successful: 0,
      updated: 0,
      skipped: 0,
      errorCount: 0,
      currentBatch: 0,
      totalBatches: 0,
      status: "idle",
    };
  }

  patch(changes: Partial<ImporterProgressPayload>, force = false): void {
    Object.assign(this.state, changes);
    // Throttle to ~10 updates/sec; terminal states always go through.
    const now = Date.now();
    const terminal =
      this.state.status === "done" ||
      this.state.status === "cancelled" ||
      this.state.status === "error";
    if (force || terminal || now - this.lastEmit >= 100) {
      this.lastEmit = now;
      this.emit({ ...this.state });
    }
  }

  addError(error: ImportRowError): void {
    this.errors.push(error);
    this.state.errorCount = this.errors.length;
  }

  getErrors(): ImportRowError[] {
    return this.errors;
  }

  toResult(status: ImportStatus = "done"): ImportResult {
    this.patch({ status }, true);
    return {
      summary: { ...this.state },
      errorsPreview: this.errors.slice(0, 50),
      totalErrors: this.errors.length,
      allErrors: this.errors,
    };
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new ImportAbortedError();
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
