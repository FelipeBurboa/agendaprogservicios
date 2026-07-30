import {
  generateProfessionalPlaceholderEmail,
  generateProfessionalPlaceholderPhone,
  getFlexibleColumnValue,
  normalizeForComparison,
  resolveSucursalFromSheetName,
  sleep,
} from "../import-utils.js";
import {
  BATCH_DELAY_MS,
  BATCH_SIZE,
  MAX_RETRIES,
  ProgressTracker,
  errorMessage,
  throwIfAborted,
  type ImportContext,
  type ImportResult,
  type ImportRowError,
} from "../types.js";
import { parseFileAllSheets } from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkProfesionalesImport.ts.
 *
 * Multi-sheet importer: every sheet is one sucursal, resolved from the sheet
 * name. The web tab exposes this as a checkbox ("El archivo tiene tabs por
 * sucursal") defaulting to false; the Electron UI has no toggle and always
 * feeds AgendaPro exports, which are always tabbed per sucursal, so the mode
 * is pinned on here.
 *
 * Match strategy: normalized name against both `nombre` and the generated
 * `nombre_unaccented` column, scoped to the sheet's sucursal. More than one
 * match is skipped as ambiguous rather than guessed at.
 */

/** Sheet-name -> sucursal resolution, always on. See the note above. */
const USE_SUCURSAL_MODE = true;

interface ProfesionalLookup {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  sucursal_id: string | null;
}

interface SucursalLookup {
  id: string;
  nombre: string;
}

interface Lookups {
  profesionalLookup: Map<string, ProfesionalLookup[]>;
  sucursalMap: Map<string, SucursalLookup>;
}

interface FlatRow {
  row: Record<string, any>;
  sheetName: string;
  sucursalId: string | null;
  sucursalNombre: string | null;
  globalIdx: number;
}

const addProfesionalToLookup = (
  lookup: Map<string, ProfesionalLookup[]>,
  entry: ProfesionalLookup,
  aliases: Array<string | null | undefined>,
): void => {
  aliases
    .filter((alias): alias is string => Boolean(alias && alias.trim()))
    .forEach((alias) => {
      const key = normalizeForComparison(alias);
      const existing = lookup.get(key) ?? [];
      lookup.set(key, [...existing, entry]);
    });
};

const parseOptionalString = (value: any): string | null => {
  const parsed = String(value ?? "").trim();
  return parsed.length > 0 ? parsed : null;
};

/**
 * In sucursal mode the candidate set is narrowed to the sheet's sucursal
 * first, so the same professional name may legitimately exist once per
 * sucursal without being reported as ambiguous.
 */
const resolveExistingProfessional = (
  lookup: Map<string, ProfesionalLookup[]>,
  nombre: string,
  useSucursalMode: boolean,
  sucursalId: string | null,
): { existing: ProfesionalLookup | null; ambiguous: boolean } => {
  const matches = lookup.get(normalizeForComparison(nombre)) ?? [];

  if (useSucursalMode) {
    const sameSucursal = matches.filter(
      (item) => item.sucursal_id === sucursalId,
    );
    if (sameSucursal.length > 1) {
      return { existing: null, ambiguous: true };
    }
    return { existing: sameSucursal[0] ?? null, ambiguous: false };
  }

  if (matches.length > 1) {
    return { existing: null, ambiguous: true };
  }

  return { existing: matches[0] ?? null, ambiguous: false };
};

export async function importProfesionales(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("profesionales", ctx.onProgress);

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

  // A single-sheet file is treated as "no sucursal split", so an unresolved
  // sheet name is tolerated there but fatal per row on multi-sheet files.
  const requireResolvedSucursal = USE_SUCURSAL_MODE && parsed.sheets.length > 1;

  const allRows: FlatRow[] = [];
  let globalIdx = 0;

  for (const sheet of parsed.sheets) {
    const resolvedSucursal = USE_SUCURSAL_MODE
      ? resolveSucursalFromSheetName(sheet.name, lookups.sucursalMap)
      : null;

    for (const row of sheet.rows) {
      allRows.push({
        row,
        sheetName: sheet.name,
        sucursalId: resolvedSucursal?.id ?? null,
        sucursalNombre: resolvedSucursal?.nombre ?? null,
        globalIdx,
      });
      globalIdx += 1;
    }
  }

  const totalBatches = Math.ceil(allRows.length / BATCH_SIZE);
  tracker.patch(
    {
      total: allRows.length,
      totalBatches,
      status: "importing",
      message: "Importando profesionales...",
    },
    true,
  );

  let successful = 0;
  let updated = 0;
  let skipped = 0;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    throwIfAborted(ctx.signal);

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, allRows.length);
    const batchRows = allRows.slice(startIdx, endIdx);

    tracker.patch({ currentBatch: batchIndex + 1 });

    for (let index = 0; index < batchRows.length; index += 1) {
      throwIfAborted(ctx.signal);

      const item = batchRows[index];

      if (requireResolvedSucursal && !item.sucursalId) {
        skipped += 1;
        tracker.addError({
          row: item.globalIdx + 2,
          sheet: item.sheetName,
          error: `Sucursal no encontrada para sheet: "${item.sheetName}"`,
          data: String(
            getFlexibleColumnValue(item.row, "nombre", "Nombre", "NOMBRE") ?? "",
          ),
        });
      } else {
        const rowResult = await processRow(
          item.row,
          item.globalIdx,
          item.sheetName,
          ctx,
          USE_SUCURSAL_MODE,
          item.sucursalId,
          item.sucursalNombre,
          lookups,
        );

        if (rowResult.success) {
          if (rowResult.updated) {
            updated += 1;
          } else {
            successful += 1;
          }
        } else if (rowResult.skipped) {
          skipped += 1;
        }

        if (rowResult.error) {
          tracker.addError(rowResult.error);
        }
      }

      tracker.patch({
        processed: startIdx + index + 1,
        successful,
        updated,
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
  const [profesionalesResult, sucursalesResult] = await Promise.all([
    ctx.supabase
      .from("profesionales")
      .select("id, nombre, nombre_unaccented, email, telefono, sucursal_id")
      .eq("organizacion_id", ctx.organizacionId),
    useSucursalMode
      ? ctx.supabase
          .from("sucursales")
          .select("id, nombre, nombre_unaccented")
          .eq("organizacion_id", ctx.organizacionId)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (profesionalesResult.error) {
    throw new Error(
      `Error cargando profesionales: ${profesionalesResult.error.message}`,
    );
  }

  if (sucursalesResult.error) {
    throw new Error(
      `Error cargando sucursales: ${(sucursalesResult.error as any).message}`,
    );
  }

  const profesionalLookup = new Map<string, ProfesionalLookup[]>();
  for (const item of profesionalesResult.data || []) {
    const raw = item as any;
    const entry: ProfesionalLookup = {
      id: raw.id,
      nombre: raw.nombre,
      email: raw.email,
      telefono: raw.telefono,
      sucursal_id: raw.sucursal_id ?? null,
    };
    addProfesionalToLookup(profesionalLookup, entry, [
      raw.nombre,
      raw.nombre_unaccented,
    ]);
  }

  const sucursalMap = new Map<string, SucursalLookup>();
  if (useSucursalMode) {
    for (const item of sucursalesResult.data || []) {
      const raw = item as any;
      const entry: SucursalLookup = { id: raw.id, nombre: raw.nombre };
      sucursalMap.set(normalizeForComparison(raw.nombre || ""), entry);
      if (raw.nombre_unaccented) {
        sucursalMap.set(normalizeForComparison(raw.nombre_unaccented), entry);
      }
    }
  }

  return { profesionalLookup, sucursalMap };
}

async function processRow(
  row: Record<string, any>,
  rowIndex: number,
  sheetName: string,
  ctx: ImportContext,
  useSucursalMode: boolean,
  sucursalId: string | null,
  sucursalNombre: string | null,
  lookups: Lookups,
): Promise<{
  success: boolean;
  skipped: boolean;
  updated?: boolean;
  error?: ImportRowError;
}> {
  const nombre = String(
    getFlexibleColumnValue(row, "nombre", "Nombre", "NOMBRE") ?? "",
  ).trim();
  const providerId = parseOptionalString(
    getFlexibleColumnValue(
      row,
      "agenda_pro_provider_id",
      "Agenda Pro Provider ID",
      "provider_id",
    ),
  );
  const fotoUrl = parseOptionalString(
    getFlexibleColumnValue(row, "foto_url", "Foto URL", "foto url"),
  );
  const rowSucursal = parseOptionalString(
    getFlexibleColumnValue(row, "sucursal", "Sucursal", "SUCURSAL"),
  );

  const makeError = (message: string): ImportRowError => ({
    row: rowIndex + 2,
    sheet: sheetName,
    error: message,
    data: nombre,
  });

  if (!nombre) {
    return { success: false, skipped: true, error: makeError("Nombre vacio") };
  }

  const resolved = resolveExistingProfessional(
    lookups.profesionalLookup,
    nombre,
    useSucursalMode,
    sucursalId,
  );
  if (resolved.ambiguous) {
    return {
      success: false,
      skipped: true,
      error: makeError(
        `No se puede resolver univocamente el profesional "${nombre}"`,
      ),
    };
  }

  // The sheet is authoritative: a disagreeing `sucursal` column is recorded as
  // a warning but never overrides the sheet-derived sucursal.
  let warningMessage: string | null = null;
  if (useSucursalMode && sucursalNombre && rowSucursal) {
    const sheetSucursalNormalized = normalizeForComparison(sucursalNombre);
    const rowSucursalNormalized = normalizeForComparison(rowSucursal);
    if (sheetSucursalNormalized !== rowSucursalNormalized) {
      warningMessage = `La columna sucursal (${rowSucursal}) no coincide con el sheet; se uso ${sucursalNombre}`;
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      if (resolved.existing) {
        const updatePayload: Record<string, any> = {
          nombre,
          foto_url: fotoUrl,
        };

        if (useSucursalMode) {
          updatePayload.sucursal_id = sucursalId;
        }

        const { error } = await ctx.supabase
          .from("profesionales")
          .update(updatePayload)
          .eq("id", resolved.existing.id)
          .eq("organizacion_id", ctx.organizacionId);

        if (error) {
          throw error;
        }

        if (warningMessage) {
          return {
            success: true,
            skipped: false,
            updated: true,
            error: makeError(warningMessage),
          };
        }

        return { success: true, skipped: false, updated: true };
      }

      // Placeholders are generated only on insert, and are stable for a given
      // provider id so re-running the import does not churn them.
      const { data, error } = await ctx.supabase
        .from("profesionales")
        .insert({
          nombre,
          organizacion_id: ctx.organizacionId,
          email: generateProfessionalPlaceholderEmail(nombre, providerId),
          telefono: generateProfessionalPlaceholderPhone(providerId, nombre),
          descripcion: "",
          foto_url: fotoUrl,
          sucursal_id: useSucursalMode ? sucursalId : null,
        })
        .select("id, nombre, email, telefono, sucursal_id")
        .single();

      if (error) {
        throw error;
      }

      addProfesionalToLookup(
        lookups.profesionalLookup,
        {
          id: data.id,
          nombre: data.nombre,
          email: data.email,
          telefono: data.telefono,
          sucursal_id: data.sucursal_id ?? null,
        },
        [data.nombre],
      );

      if (warningMessage) {
        return {
          success: true,
          skipped: false,
          updated: false,
          error: makeError(warningMessage),
        };
      }

      return { success: true, skipped: false, updated: false };
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        return {
          success: false,
          skipped: false,
          error: makeError(`Error de BD: ${errorMessage(error)}`),
        };
      }

      await sleep(100 * (attempt + 1));
    }
  }

  return { success: false, skipped: false };
}
