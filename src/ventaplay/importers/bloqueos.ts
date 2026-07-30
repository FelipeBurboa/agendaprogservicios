import {
  findByWordSubset,
  getFlexibleColumnValue,
  normalizeForComparison,
  resolveSucursalFromSheetName,
  sleep,
  toChileTimestamptz,
} from "../import-utils.js";
import {
  BATCH_DELAY_MS,
  BATCH_SIZE,
  MAX_RETRIES,
  ProgressTracker,
  throwIfAborted,
  type ImportContext,
  type ImportResult,
  type ImportRowError,
} from "../types.js";
import { parseFileAllSheets } from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkBloqueosImport.ts.
 *
 * Multi-sheet importer: every sheet is one sucursal, resolved from the sheet
 * name. The web tab exposes this as a checkbox defaulting to false; the
 * Electron UI has no toggle and always feeds AgendaPro exports, which are
 * always tabbed per sucursal, so the mode is pinned on here.
 *
 * The non-obvious part is the merge pass: AgendaPro emits one row per day for
 * a multi-day block, all sharing an `Event ID`. Consecutive full-day rows in
 * the same event are collapsed into a single contiguous bloqueo before any
 * insert happens.
 */

/** Sheet-name -> sucursal resolution, always on. See the note above. */
const USE_SUCURSAL_MODE = true;

interface MergedBloqueoEntry {
  profesionalName: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  sheetName: string;
  sucursalId: string | null;
  rowIndices: number[];
  eventId: string;
}

interface ProfesionalLookup {
  id: string;
  nombre: string;
  sucursal_id: string | null;
}

interface SucursalLookup {
  id: string;
  nombre: string;
}

interface Lookups {
  profesionalMap: Map<string, ProfesionalLookup>;
  sucursalMap: Map<string, SucursalLookup>;
}

interface FlatRow {
  row: Record<string, any>;
  sheetName: string;
  sucursalId: string | null;
  globalIdx: number;
}

const findProfessionalByWordSubset = (
  excelName: string,
  profesionalMap: Map<string, ProfesionalLookup>,
): ProfesionalLookup | null => {
  return findByWordSubset(excelName, profesionalMap);
};

const getColumnValue = (
  row: Record<string, any>,
  ...columnNames: string[]
): any => {
  return getFlexibleColumnValue(row, ...columnNames);
};

const parseDateTime = (value: any): { fecha: string; hora: string } | null => {
  if (!value) return null;
  const str = String(value).trim();

  // ISO format: "2026-02-09T10:30:00"
  if (str.includes("T")) {
    const [fecha, hora] = str.split("T");
    if (fecha && hora) {
      const horaPart = hora.split(".")[0];
      return { fecha, hora: horaPart.length === 5 ? horaPart + ":00" : horaPart };
    }
  }

  // Space-separated: "2026-02-09 10:30:00"
  if (str.includes(" ")) {
    const [fecha, hora] = str.split(" ");
    if (fecha && hora) {
      const horaPart = hora.split(".")[0];
      return { fecha, hora: horaPart.length === 5 ? horaPart + ":00" : horaPart };
    }
  }

  // Excel serial date number
  const num = Number(value);
  if (!isNaN(num) && num > 1000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mm = String(date.getUTCMinutes()).padStart(2, "0");
      const ss = String(date.getUTCSeconds()).padStart(2, "0");
      return { fecha: `${y}-${m}-${d}`, hora: `${hh}:${mm}:${ss}` };
    }
  }

  return null;
};

/** Check if a parsed time is a full-day boundary (00:00 start, 23:59 end) */
const isFullDayStart = (hora: string): boolean => hora.startsWith("00:00");
const isFullDayEnd = (hora: string): boolean => hora.startsWith("23:59");

/** Add 1 day to a YYYY-MM-DD string */
const addOneDay = (fecha: string): string => {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export async function importBloqueos(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("bloqueos", ctx.onProgress);

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);
  const parsed = parseFileAllSheets(filePath);

  if (parsed.totalRows === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  tracker.patch(
    { status: "importing", message: "Cargando datos existentes..." },
    true,
  );
  const lookups = await preloadLookups(ctx, USE_SUCURSAL_MODE);

  // Build flat list of rows with sheet context
  const allRows: FlatRow[] = [];
  let globalIdx = 0;

  for (const sheet of parsed.sheets) {
    const resolvedSucursal = USE_SUCURSAL_MODE
      ? resolveSucursalFromSheetName(sheet.name, lookups.sucursalMap)
      : null;
    const sucursalId = resolvedSucursal?.id ?? null;

    for (const row of sheet.rows) {
      allRows.push({ row, sheetName: sheet.name, sucursalId, globalIdx });
      globalIdx += 1;
    }
  }

  const totalOriginalRows = allRows.length;

  throwIfAborted(ctx.signal);

  tracker.patch(
    { status: "importing", message: "Agrupando bloqueos consecutivos..." },
    true,
  );
  const { entries, mergedRowCount } = mergeConsecutiveEntries(allRows);

  const totalBatches = Math.ceil(entries.length / BATCH_SIZE);
  tracker.patch(
    {
      total: entries.length,
      totalBatches,
      status: "importing",
      message: `Importando bloqueos (${totalOriginalRows} filas, ${mergedRowCount} fusionadas)...`,
    },
    true,
  );

  let successful = 0;
  let skipped = 0;

  const duplicateCache = new Set<string>();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    throwIfAborted(ctx.signal);

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, entries.length);
    const batchEntries = entries.slice(startIdx, endIdx);

    tracker.patch({ currentBatch: batchIndex + 1 });

    for (let i = 0; i < batchEntries.length; i += 1) {
      throwIfAborted(ctx.signal);

      const entry = batchEntries[i];

      // If sucursal mode and no sucursal matched for this sheet, skip
      if (USE_SUCURSAL_MODE && !entry.sucursalId) {
        skipped += 1;
        tracker.addError({
          row: entry.rowIndices[0] + 2,
          sheet: entry.sheetName,
          error: `Sucursal no encontrada para sheet: "${entry.sheetName}"`,
          data: entry.profesionalName,
        });
      } else {
        const res = await processEntry(entry, ctx, lookups, duplicateCache);

        if (res.success) {
          successful += 1;
        } else if (res.skipped) {
          skipped += 1;
        }

        if (res.error) {
          tracker.addError(res.error);
        }
      }

      tracker.patch({
        processed: startIdx + i + 1,
        successful,
        skipped,
      });
    }

    if (batchIndex < totalBatches - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return tracker.toResult();
}

async function preloadLookups(
  ctx: ImportContext,
  useSucursalMode: boolean,
): Promise<Lookups> {
  const [profResult, sucResult] = await Promise.all([
    ctx.supabase
      .from("profesionales")
      .select("id, nombre, nombre_unaccented, sucursal_id")
      .eq("organizacion_id", ctx.organizacionId),
    useSucursalMode
      ? ctx.supabase
          .from("sucursales")
          .select("id, nombre, nombre_unaccented")
          .eq("organizacion_id", ctx.organizacionId)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (profResult.error) {
    throw new Error(`Error cargando profesionales: ${profResult.error.message}`);
  }
  if (sucResult.error) {
    throw new Error(
      `Error cargando sucursales: ${(sucResult.error as any).message}`,
    );
  }

  const profesionalMap = new Map<string, ProfesionalLookup>();
  for (const p of profResult.data || []) {
    const raw = p as any;
    const entry: ProfesionalLookup = {
      id: raw.id,
      nombre: raw.nombre,
      sucursal_id: raw.sucursal_id ?? null,
    };
    profesionalMap.set(normalizeForComparison(raw.nombre || ""), entry);
    if (raw.nombre_unaccented) {
      profesionalMap.set(normalizeForComparison(raw.nombre_unaccented), entry);
    }
  }

  const sucursalMap = new Map<string, SucursalLookup>();
  if (useSucursalMode) {
    for (const s of sucResult.data || []) {
      const raw = s as any;
      const entry: SucursalLookup = { id: raw.id, nombre: raw.nombre };
      sucursalMap.set(normalizeForComparison(raw.nombre || ""), entry);
      if (raw.nombre_unaccented) {
        sucursalMap.set(normalizeForComparison(raw.nombre_unaccented), entry);
      }
    }
  }

  return { profesionalMap, sucursalMap };
}

/**
 * Collapse consecutive full-day rows sharing an `Event ID` into one block.
 * Rows without an Event ID are never merged. Timestamps go through
 * toChileTimestamptz so DST is handled -- never local Date math.
 */
function mergeConsecutiveEntries(allRows: FlatRow[]): {
  entries: MergedBloqueoEntry[];
  mergedRowCount: number;
} {
  // Group by Event ID
  const eventGroups = new Map<string, FlatRow[]>();
  const noEventRows: FlatRow[] = [];

  for (const item of allRows) {
    const eventId = String(
      getColumnValue(item.row, "Event ID", "event_id", "EVENT ID", "EventID") ??
        "",
    ).trim();
    if (eventId) {
      if (!eventGroups.has(eventId)) eventGroups.set(eventId, []);
      eventGroups.get(eventId)!.push(item);
    } else {
      noEventRows.push(item);
    }
  }

  const entries: MergedBloqueoEntry[] = [];
  let mergedRowCount = 0;

  // Process groups with Event ID
  for (const [eventId, groupRows] of eventGroups) {
    // Parse dates and sort
    const parsed = groupRows
      .map((item) => {
        const inicioRaw = getColumnValue(
          item.row,
          "Inicio",
          "inicio",
          "INICIO",
          "Start",
        );
        const finRaw = getColumnValue(item.row, "Fin", "fin", "FIN", "End");
        const inicio = parseDateTime(inicioRaw);
        const fin = parseDateTime(finRaw);
        return { ...item, inicio, fin };
      })
      .sort((a, b) => {
        if (!a.inicio || !b.inicio) return 0;
        return (a.inicio.fecha + a.inicio.hora).localeCompare(
          b.inicio.fecha + b.inicio.hora,
        );
      });

    // Walk through sorted rows and merge consecutive full-day entries
    let chainStart: (typeof parsed)[0] | null = null;
    let chainEndFecha: string | null = null;
    let chainEndHora: string | null = null;
    let chainIndices: number[] = [];

    const flushChain = () => {
      if (!chainStart || !chainStart.inicio) return;
      const profName = String(
        getColumnValue(
          chainStart.row,
          "Profesional",
          "profesional",
          "PROFESIONAL",
        ) ?? "",
      ).trim();
      const titulo = String(
        getColumnValue(chainStart.row, "Titulo", "titulo", "TITULO", "Title") ??
          "",
      ).trim();
      const descripcion = String(
        getColumnValue(
          chainStart.row,
          "Descripcion",
          "descripcion",
          "DESCRIPCION",
          "Description",
        ) ?? "",
      ).trim();
      const motivo = titulo || descripcion || "BLOQUEO";

      entries.push({
        profesionalName: profName,
        motivo,
        fechaInicio: toChileTimestamptz(
          chainStart.inicio.fecha,
          chainStart.inicio.hora,
        ),
        fechaFin: toChileTimestamptz(chainEndFecha!, chainEndHora!),
        sheetName: chainStart.sheetName,
        sucursalId: chainStart.sucursalId,
        rowIndices: chainIndices,
        eventId,
      });

      if (chainIndices.length > 1) {
        mergedRowCount += chainIndices.length - 1;
      }
    };

    for (const item of parsed) {
      if (!item.inicio || !item.fin) {
        // Can't parse dates, flush and skip
        flushChain();
        chainStart = null;
        chainEndFecha = null;
        chainEndHora = null;
        chainIndices = [];
        continue;
      }

      const isCurrentFullDay =
        isFullDayStart(item.inicio.hora) && isFullDayEnd(item.fin.hora);

      if (chainStart && chainStart.inicio && chainEndFecha && chainEndHora) {
        const wasChainFullDay =
          isFullDayStart(chainStart.inicio.hora) && isFullDayEnd(chainEndHora);
        // Check if current row continues the chain: both full-day, current start = chain end date + 1 day
        if (
          isCurrentFullDay &&
          wasChainFullDay &&
          item.inicio.fecha === addOneDay(chainEndFecha)
        ) {
          // Extend chain
          chainEndFecha = item.fin.fecha;
          chainEndHora = item.fin.hora;
          chainIndices.push(item.globalIdx);
          continue;
        }
      }

      // Flush previous chain and start new one
      flushChain();
      chainStart = item;
      chainEndFecha = item.fin.fecha;
      chainEndHora = item.fin.hora;
      chainIndices = [item.globalIdx];
    }

    // Flush remaining chain
    flushChain();
  }

  // Process rows without Event ID (no merging)
  for (const item of noEventRows) {
    const inicioRaw = getColumnValue(
      item.row,
      "Inicio",
      "inicio",
      "INICIO",
      "Start",
    );
    const finRaw = getColumnValue(item.row, "Fin", "fin", "FIN", "End");
    const inicio = parseDateTime(inicioRaw);
    const fin = parseDateTime(finRaw);

    if (!inicio || !fin) continue;

    const profName = String(
      getColumnValue(item.row, "Profesional", "profesional", "PROFESIONAL") ??
        "",
    ).trim();
    const titulo = String(
      getColumnValue(item.row, "Titulo", "titulo", "TITULO", "Title") ?? "",
    ).trim();
    const descripcion = String(
      getColumnValue(
        item.row,
        "Descripcion",
        "descripcion",
        "DESCRIPCION",
        "Description",
      ) ?? "",
    ).trim();
    const motivo = titulo || descripcion || "BLOQUEO";

    entries.push({
      profesionalName: profName,
      motivo,
      fechaInicio: toChileTimestamptz(inicio.fecha, inicio.hora),
      fechaFin: toChileTimestamptz(fin.fecha, fin.hora),
      sheetName: item.sheetName,
      sucursalId: item.sucursalId,
      rowIndices: [item.globalIdx],
      eventId: "",
    });
  }

  return { entries, mergedRowCount };
}

async function processEntry(
  entry: MergedBloqueoEntry,
  ctx: ImportContext,
  lookups: Lookups,
  duplicateCache: Set<string>,
): Promise<{ success: boolean; skipped: boolean; error?: ImportRowError }> {
  const rowLabel =
    entry.rowIndices.length === 1
      ? entry.rowIndices[0] + 2
      : `${entry.rowIndices[0] + 2}-${entry.rowIndices[entry.rowIndices.length - 1] + 2}`;

  const makeError = (msg: string): ImportRowError => ({
    row: typeof rowLabel === "number" ? rowLabel : entry.rowIndices[0] + 2,
    sheet: entry.sheetName,
    error: entry.rowIndices.length > 1 ? `[Filas ${rowLabel}] ${msg}` : msg,
    data: entry.profesionalName,
  });

  // 1. Match profesional
  if (!entry.profesionalName) {
    return { success: false, skipped: true, error: makeError("Profesional vacio") };
  }

  const normalizedProfName = normalizeForComparison(entry.profesionalName);
  const prof =
    lookups.profesionalMap.get(normalizedProfName) ??
    findProfessionalByWordSubset(entry.profesionalName, lookups.profesionalMap);
  if (!prof) {
    return {
      success: false,
      skipped: true,
      error: makeError(`Profesional no encontrado: "${entry.profesionalName}"`),
    };
  }

  // 2. Validate prof<->sucursal (warn only)
  let warningMsg: string | null = null;
  if (
    entry.sucursalId &&
    prof.sucursal_id &&
    prof.sucursal_id !== entry.sucursalId
  ) {
    warningMsg = `Profesional "${entry.profesionalName}" pertenece a otra sucursal (se usara la del sheet)`;
  }

  // 3. Validate motivo
  if (entry.motivo.length < 3) {
    return {
      success: false,
      skipped: true,
      error: makeError(
        `Motivo muy corto: "${entry.motivo}" (minimo 3 caracteres)`,
      ),
    };
  }

  // 4. Check in-memory duplicate
  const dupeKey = `${prof.id}|${entry.fechaInicio}|${entry.fechaFin}`;
  if (duplicateCache.has(dupeKey)) {
    return {
      success: false,
      skipped: true,
      error: makeError("Bloqueo duplicado (ya importado en esta sesion)"),
    };
  }

  // 5. Check DB duplicate
  const { data: existingBloqueos } = await ctx.supabase
    .from("profesional_bloqueos")
    .select("id")
    .eq("profesional_id", prof.id)
    .eq("fecha_inicio", entry.fechaInicio)
    .eq("fecha_fin", entry.fechaFin)
    .limit(1);

  if (existingBloqueos && existingBloqueos.length > 0) {
    duplicateCache.add(dupeKey);
    return {
      success: false,
      skipped: true,
      error: makeError("Bloqueo duplicado (ya existe en DB)"),
    };
  }

  // 6. Insert
  const bloqueoRecord = {
    profesional_id: prof.id,
    organizacion_id: ctx.organizacionId,
    motivo: entry.motivo,
    fecha_inicio: entry.fechaInicio,
    fecha_fin: entry.fechaFin,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const { error: insertErr } = await ctx.supabase
      .from("profesional_bloqueos")
      .insert(bloqueoRecord as any);

    if (!insertErr) {
      duplicateCache.add(dupeKey);
      if (warningMsg) {
        return { success: true, skipped: false, error: makeError(warningMsg) };
      }
      return { success: true, skipped: false };
    }

    if (attempt === MAX_RETRIES - 1) {
      return {
        success: false,
        skipped: false,
        error: makeError(`Error insertando bloqueo: ${insertErr.message}`),
      };
    }
    await sleep(100 * (attempt + 1));
  }

  return { success: false, skipped: false };
}
