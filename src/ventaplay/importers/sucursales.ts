import {
  getFlexibleColumnValue,
  normalizeForComparison,
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
import { parseFile } from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkSucursalesImport.ts.
 *
 * Match strategy: normalized name against both `nombre` and the generated
 * `nombre_unaccented` column. Exactly one match updates, zero inserts, more
 * than one is skipped as ambiguous rather than guessed at.
 */

interface SucursalLookup {
  id: string;
  nombre: string;
}

const addSucursalToLookup = (
  lookup: Map<string, SucursalLookup[]>,
  entry: SucursalLookup,
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

const parseOptionalNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function importSucursales(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("sucursales", ctx.onProgress);

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);
  const { rows } = parseFile(filePath);

  if (rows.length === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  tracker.patch(
    { status: "importing", message: "Cargando sucursales existentes..." },
    true,
  );
  const lookup = await preloadLookups(ctx);

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  tracker.patch(
    {
      total: rows.length,
      totalBatches,
      status: "importing",
      message: "Importando sucursales...",
    },
    true,
  );

  let successful = 0;
  let updated = 0;
  let skipped = 0;

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    throwIfAborted(ctx.signal);

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, rows.length);
    const batchRows = rows.slice(startIdx, endIdx);

    tracker.patch({ currentBatch: batchIndex + 1 });

    for (let index = 0; index < batchRows.length; index += 1) {
      throwIfAborted(ctx.signal);

      const rowResult = await processRow(
        batchRows[index],
        startIdx + index,
        ctx,
        lookup,
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
): Promise<Map<string, SucursalLookup[]>> {
  const { data, error } = await ctx.supabase
    .from("sucursales")
    .select("id, nombre, nombre_unaccented")
    .eq("organizacion_id", ctx.organizacionId);

  if (error) {
    throw new Error(`Error cargando sucursales: ${error.message}`);
  }

  const lookup = new Map<string, SucursalLookup[]>();

  for (const item of data || []) {
    const raw = item as any;
    const entry: SucursalLookup = { id: raw.id, nombre: raw.nombre };
    addSucursalToLookup(lookup, entry, [raw.nombre, raw.nombre_unaccented]);
  }

  return lookup;
}

async function processRow(
  row: Record<string, any>,
  rowIndex: number,
  ctx: ImportContext,
  lookup: Map<string, SucursalLookup[]>,
): Promise<{
  success: boolean;
  skipped: boolean;
  updated?: boolean;
  error?: ImportRowError;
}> {
  const nombre = String(
    getFlexibleColumnValue(row, "nombre", "Nombre", "NOMBRE") ?? "",
  ).trim();
  const direccion = String(
    getFlexibleColumnValue(
      row,
      "direccion",
      "Dirección",
      "Direccion",
      "DIRECCION",
    ) ?? "",
  ).trim();

  const makeError = (message: string): ImportRowError => ({
    row: rowIndex + 2,
    error: message,
    data: nombre,
  });

  if (!nombre) {
    return { success: false, skipped: true, error: makeError("Nombre vacio") };
  }

  if (!direccion) {
    return {
      success: false,
      skipped: true,
      error: makeError("Direccion vacia"),
    };
  }

  const normalizedName = normalizeForComparison(nombre);
  const existingMatches = lookup.get(normalizedName) ?? [];

  if (existingMatches.length > 1) {
    return {
      success: false,
      skipped: true,
      error: makeError(
        `Multiples sucursales existentes coinciden con "${nombre}"`,
      ),
    };
  }

  const payload = {
    nombre,
    direccion,
    telefono: parseOptionalString(
      getFlexibleColumnValue(
        row,
        "telefono",
        "Teléfono",
        "Telefono",
        "TELEFONO",
      ),
    ),
    email: parseOptionalString(
      getFlexibleColumnValue(row, "email", "Email", "EMAIL"),
    ),
    lat: parseOptionalNumber(getFlexibleColumnValue(row, "lat", "LAT")),
    lng: parseOptionalNumber(getFlexibleColumnValue(row, "lng", "LNG")),
    foto_url: parseOptionalString(
      getFlexibleColumnValue(
        row,
        "foto_url",
        "foto url",
        "Foto URL",
        "FOTO_URL",
      ),
    ),
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      if (existingMatches.length === 1) {
        const existing = existingMatches[0];
        const { error } = await ctx.supabase
          .from("sucursales")
          .update(payload)
          .eq("id", existing.id)
          .eq("organizacion_id", ctx.organizacionId);

        if (error) throw error;

        return { success: true, skipped: false, updated: true };
      }

      const { data, error } = await ctx.supabase
        .from("sucursales")
        .insert({ ...payload, organizacion_id: ctx.organizacionId })
        .select("id, nombre")
        .single();

      if (error) throw error;

      addSucursalToLookup(lookup, { id: data.id, nombre: data.nombre }, [
        data.nombre,
      ]);
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
