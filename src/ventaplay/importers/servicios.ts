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
 * Port of ventaplaymrm/src/hooks/import/useBulkServiciosImport.ts.
 *
 * Match strategy: normalized name against both `nombre` and the generated
 * `nombre_unaccented` column. Exactly one match updates, zero inserts, more
 * than one is skipped as ambiguous rather than guessed at.
 *
 * Tags are REPLACE-ALL: every association for the servicio is deleted and the
 * resolved tag ids are re-inserted. A tag failure downgrades the row to a
 * warning -- the servicio itself already landed.
 */

interface ServicioLookup {
  id: string;
  nombre: string;
}

interface ServicioLookups {
  servicioLookup: Map<string, ServicioLookup[]>;
  tagLookup: Map<string, string>;
}

const addServicioToLookup = (
  lookup: Map<string, ServicioLookup[]>,
  entry: ServicioLookup,
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

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoolean = (value: any): boolean | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "si", "sí", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return null;
};

const splitTags = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
};

export async function importServicios(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("servicios", ctx.onProgress);

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);
  const { rows } = parseFile(filePath);

  if (rows.length === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  tracker.patch(
    { status: "importing", message: "Cargando servicios existentes..." },
    true,
  );
  const lookups = await preloadLookups(ctx);

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  tracker.patch(
    {
      total: rows.length,
      totalBatches,
      status: "importing",
      message: "Importando servicios...",
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

async function preloadLookups(ctx: ImportContext): Promise<ServicioLookups> {
  const [serviciosResult, tagsResult] = await Promise.all([
    ctx.supabase
      .from("servicios")
      .select("id, nombre, nombre_unaccented")
      .eq("organizacion_id", ctx.organizacionId),
    ctx.supabase
      .from("servicio_tags")
      .select("id, nombre")
      .eq("organizacion_id", ctx.organizacionId),
  ]);

  if (serviciosResult.error) {
    throw new Error(`Error cargando servicios: ${serviciosResult.error.message}`);
  }

  if (tagsResult.error) {
    throw new Error(
      `Error cargando tags de servicios: ${tagsResult.error.message}`,
    );
  }

  const servicioLookup = new Map<string, ServicioLookup[]>();
  for (const item of serviciosResult.data || []) {
    const raw = item as any;
    const entry: ServicioLookup = { id: raw.id, nombre: raw.nombre };
    addServicioToLookup(servicioLookup, entry, [
      raw.nombre,
      raw.nombre_unaccented,
    ]);
  }

  const tagLookup = new Map<string, string>();
  for (const tag of tagsResult.data || []) {
    const raw = tag as any;
    tagLookup.set(normalizeForComparison(raw.nombre), raw.id);
  }

  return { servicioLookup, tagLookup };
}

/** Resolves tag names to ids, creating any that don't exist yet. */
async function resolveTagIds(
  rawTagValue: string,
  ctx: ImportContext,
  tagLookup: Map<string, string>,
): Promise<string[]> {
  const tagIds: string[] = [];

  for (const tagName of splitTags(rawTagValue)) {
    const normalizedTag = normalizeForComparison(tagName);
    const existingTagId = tagLookup.get(normalizedTag);
    if (existingTagId) {
      tagIds.push(existingTagId);
      continue;
    }

    const { data, error } = await ctx.supabase
      .from("servicio_tags")
      .insert({
        nombre: tagName,
        organizacion_id: ctx.organizacionId,
        color: "#6B7280",
      })
      .select("id, nombre")
      .single();

    if (error) {
      throw error;
    }

    tagLookup.set(normalizedTag, data.id);
    tagIds.push(data.id);
  }

  return tagIds;
}

/** REPLACE-ALL: wipes the servicio's associations before re-inserting. */
async function replaceServiceTags(
  ctx: ImportContext,
  servicioId: string,
  tagIds: string[],
): Promise<void> {
  const { error: deleteError } = await ctx.supabase
    .from("servicio_tag_asociaciones")
    .delete()
    .eq("servicio_id", servicioId);

  if (deleteError) {
    throw deleteError;
  }

  if (tagIds.length === 0) {
    return;
  }

  const { error: insertError } = await ctx.supabase
    .from("servicio_tag_asociaciones")
    .insert(tagIds.map((tagId) => ({ servicio_id: servicioId, tag_id: tagId })));

  if (insertError) {
    throw insertError;
  }
}

async function processRow(
  row: Record<string, any>,
  rowIndex: number,
  ctx: ImportContext,
  lookups: ServicioLookups,
): Promise<{
  success: boolean;
  skipped: boolean;
  updated?: boolean;
  error?: ImportRowError;
}> {
  const nombre = String(
    getFlexibleColumnValue(row, "nombre", "Nombre", "NOMBRE") ?? "",
  ).trim();

  const makeError = (message: string): ImportRowError => ({
    row: rowIndex + 2,
    error: message,
    data: nombre,
  });

  if (!nombre) {
    return { success: false, skipped: true, error: makeError("Nombre vacio") };
  }

  const precio = parseNumber(
    getFlexibleColumnValue(row, "precio", "Precio", "PRECIO"),
  );
  if (precio === null || precio < 0) {
    return {
      success: false,
      skipped: true,
      error: makeError("Precio invalido"),
    };
  }

  const duracionMinutos = parseNumber(
    getFlexibleColumnValue(
      row,
      "duracion_minutos",
      "Duración minutos",
      "Duracion minutos",
      "duracion",
    ),
  );
  if (duracionMinutos === null || duracionMinutos <= 0) {
    return {
      success: false,
      skipped: true,
      error: makeError("Duracion minima invalida"),
    };
  }

  const duracionPaciente = parseNumber(
    getFlexibleColumnValue(
      row,
      "duracion_paciente",
      "Duración paciente",
      "Duracion paciente",
    ),
  );
  if (duracionPaciente !== null && duracionPaciente <= 0) {
    return {
      success: false,
      skipped: true,
      error: makeError("Duracion paciente invalida"),
    };
  }

  const descripcion =
    parseOptionalString(
      getFlexibleColumnValue(row, "descripcion", "Descripción", "Descripcion"),
    ) || "Servicio importado";
  const activo = parseBoolean(
    getFlexibleColumnValue(row, "activo", "Activo", "ACTIVO"),
  );
  const rawTags = parseOptionalString(
    getFlexibleColumnValue(row, "tag", "Tag", "TAG", "tags"),
  );

  const normalizedName = normalizeForComparison(nombre);
  const existingMatches = lookups.servicioLookup.get(normalizedName) ?? [];

  if (existingMatches.length > 1) {
    return {
      success: false,
      skipped: true,
      error: makeError(
        `Multiples servicios existentes coinciden con "${nombre}"`,
      ),
    };
  }

  const basePayload: Record<string, any> = {
    nombre,
    descripcion,
    precio,
    duracion_minutos: Math.round(duracionMinutos),
    duracion_paciente: Math.round(duracionPaciente ?? duracionMinutos),
  };

  if (activo !== null) {
    basePayload.activo = activo;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      let servicioId: string;
      let updated = false;

      if (existingMatches.length === 1) {
        const existing = existingMatches[0];
        const { error } = await ctx.supabase
          .from("servicios")
          .update(basePayload)
          .eq("id", existing.id)
          .eq("organizacion_id", ctx.organizacionId);

        if (error) {
          throw error;
        }

        servicioId = existing.id;
        updated = true;
      } else {
        const { data, error } = await ctx.supabase
          .from("servicios")
          .insert({
            ...basePayload,
            organizacion_id: ctx.organizacionId,
            activo: activo ?? true,
            abono: 0,
          })
          .select("id, nombre")
          .single();

        if (error) {
          throw error;
        }

        servicioId = data.id;
        addServicioToLookup(
          lookups.servicioLookup,
          { id: data.id, nombre: data.nombre },
          [data.nombre],
        );
      }

      if (rawTags) {
        try {
          const tagIds = await resolveTagIds(rawTags, ctx, lookups.tagLookup);
          await replaceServiceTags(ctx, servicioId, tagIds);
        } catch (tagError) {
          // The servicio landed; only the tag wiring failed, so the row still
          // counts as a success and the message is recorded as a warning.
          return {
            success: true,
            skipped: false,
            updated,
            error: makeError(
              `Servicio importado pero fallo la asociacion de tags: ${errorMessage(tagError)}`,
            ),
          };
        }
      }

      return { success: true, skipped: false, updated };
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
