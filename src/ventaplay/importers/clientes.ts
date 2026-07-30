import { sleep } from "../import-utils.js";
import {
  normalizePhone,
  normalizeRut,
  parseBirthDateFromComponents,
  parseDateDDMMYYYY,
  parseGender,
} from "../phone-normalization.js";
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
 * Port of ventaplaymrm/src/hooks/import/useBulkClientImport.ts.
 *
 * A row becomes a `contactos` record plus a `clientes` record. Dedup key is
 * `contacto_numero + organizacion_id`; a duplicate is only updated when the
 * incoming "Fecha de creacion" is strictly newer than the stored one, and is
 * skipped outright when the row carries no date at all.
 *
 * The hook keeps its own normalizeForComparison/getColumnValue rather than the
 * shared ones in import-utils -- they differ (no parenthesis or "null" word
 * stripping), so they are ported verbatim to preserve column matching.
 */

interface ContactoInsert {
  contacto_numero: string;
  name: string | null;
  organizacion_id: string;
  phone_number_id: string;
  tipo_de_fuente: string;
  usa_flujo: boolean;
  usa_mcp: boolean;
  created_at?: string;
}

interface ClienteInsert {
  contacto_id: string;
  organizacion_id: string;
  email?: string | null;
  rut?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  genero?: string | null;
  fecha_nacimiento?: string | null;
  created_at?: string;
}

/** Lowercase, strip accents, drop trailing periods. */
const normalizeForComparison = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.+$/, "")
    .trim();
};

/**
 * Flexible column lookup: exact, then accent/case-normalized, then prefix
 * (for headers like "Genero. 1 = Femenino, 2 = Masculino").
 */
const getColumnValue = (
  row: Record<string, any>,
  ...columnNames: string[]
): any => {
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== "") {
      return row[name];
    }
  }

  const rowKeys = Object.keys(row);

  for (const name of columnNames) {
    const normalizedName = normalizeForComparison(name);

    for (const key of rowKeys) {
      const normalizedKey = normalizeForComparison(key);

      if (
        normalizedKey === normalizedName &&
        row[key] !== undefined &&
        row[key] !== ""
      ) {
        return row[key];
      }
    }
  }

  for (const name of columnNames) {
    const normalizedName = normalizeForComparison(name);

    for (const key of rowKeys) {
      const normalizedKey = normalizeForComparison(key);

      if (
        normalizedKey.startsWith(normalizedName) &&
        row[key] !== undefined &&
        row[key] !== ""
      ) {
        return row[key];
      }
    }
  }

  return undefined;
};

export async function importClientes(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("clientes", ctx.onProgress);

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);
  const { rows } = parseFile(filePath);

  if (rows.length === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  tracker.patch(
    {
      total: rows.length,
      totalBatches,
      status: "importing",
      message: "Importando clientes...",
    },
    true,
  );

  let successful = 0;
  let updated = 0;
  let skipped = 0;

  // Cache for tags to avoid repeated lookups
  const tagCache = new Map<string, string>();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    throwIfAborted(ctx.signal);

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, rows.length);
    const batchRows = rows.slice(startIdx, endIdx);

    tracker.patch({ currentBatch: batchIndex + 1 });

    for (let index = 0; index < batchRows.length; index += 1) {
      throwIfAborted(ctx.signal);

      const rowResult = await processRowWithRetry(
        batchRows[index],
        startIdx + index,
        ctx,
        tagCache,
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

async function findExistingContacto(
  phone: string,
  ctx: ImportContext,
): Promise<{
  contactoId: string;
  clienteId: string | null;
  existingCreatedAt: string | null;
} | null> {
  const { data } = await ctx.supabase
    .from("contactos")
    .select("id, created_at")
    .eq("contacto_numero", phone)
    .eq("organizacion_id", ctx.organizacionId)
    .limit(1);

  if (!data || data.length === 0) return null;

  const contactoId = data[0].id;
  const existingCreatedAt = data[0].created_at;

  // Find associated cliente
  const { data: clienteData } = await ctx.supabase
    .from("clientes")
    .select("id")
    .eq("contacto_id", contactoId)
    .limit(1);

  return {
    contactoId,
    clienteId: clienteData?.[0]?.id ?? null,
    existingCreatedAt,
  };
}

async function findOrCreateTag(
  tagName: string,
  ctx: ImportContext,
): Promise<string | null> {
  if (!tagName || tagName.trim() === "") return null;

  const trimmedName = tagName.trim();

  const { data: existingTag } = await ctx.supabase
    .from("cliente_tags")
    .select("id")
    .eq("nombre", trimmedName)
    .eq("organizacion_id", ctx.organizacionId)
    .limit(1);

  if (existingTag && existingTag.length > 0) {
    return existingTag[0].id;
  }

  const { data: newTag, error } = await ctx.supabase
    .from("cliente_tags")
    .insert({
      nombre: trimmedName,
      organizacion_id: ctx.organizacionId,
      tipo: "comercial",
      color: "#6B7280",
    })
    .select("id")
    .single();

  if (error) {
    // Tag failures are non-fatal: the cliente row still counts.
    return null;
  }

  return newTag?.id ?? null;
}

async function associateTagToCliente(
  ctx: ImportContext,
  clienteId: string,
  tagId: string,
): Promise<void> {
  const { data: existing } = await ctx.supabase
    .from("cliente_tag_asociaciones")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("tag_id", tagId)
    .limit(1);

  if (existing && existing.length > 0) return;

  await ctx.supabase.from("cliente_tag_asociaciones").insert({
    cliente_id: clienteId,
    tag_id: tagId,
  });
}

async function processRowWithRetry(
  row: Record<string, any>,
  rowIndex: number,
  ctx: ImportContext,
  tagCache: Map<string, string>,
): Promise<{
  success: boolean;
  skipped: boolean;
  updated?: boolean;
  error?: ImportRowError;
}> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const phoneRaw = getColumnValue(
        row,
        "Teléfono",
        "Telefono",
        "telefono",
        "TELEFONO",
        "Phone",
        "phone",
      );
      const phoneResult = normalizePhone(phoneRaw);

      if (!phoneResult.isValid || !phoneResult.normalizedPhone) {
        return {
          success: false,
          skipped: true,
          error: {
            // +2 because row 1 is headers and rowIndex is 0-based
            row: rowIndex + 2,
            error: phoneResult.error ?? "Telefono invalido",
            data: String(phoneRaw ?? ""),
          },
        };
      }

      const nombres = String(
        getColumnValue(
          row,
          "Nombres",
          "Nombre",
          "nombres",
          "nombre",
          "NOMBRES",
          "NOMBRE",
        ) ?? "",
      ).trim();
      const apellidos = String(
        getColumnValue(
          row,
          "Apellidos",
          "Apellido",
          "apellidos",
          "apellido",
          "APELLIDOS",
          "APELLIDO",
        ) ?? "",
      ).trim();
      const fullName = [nombres, apellidos].filter(Boolean).join(" ").trim() || null;

      if (!fullName) {
        return {
          success: false,
          skipped: true,
          error: {
            row: rowIndex + 2,
            error: "Nombre vacio",
            data: phoneResult.normalizedPhone,
          },
        };
      }

      const createdAtRaw = getColumnValue(
        row,
        "Fecha de creación",
        "Fecha de Creación",
        "fecha_creacion",
        "Fecha creacion",
        "fecha de creacion",
        "FECHA DE CREACION",
      );
      const createdAt = parseDateDDMMYYYY(createdAtRaw);

      // Fields shared by the insert and the update paths
      const email = getColumnValue(row, "Email", "email", "EMAIL", "Correo", "correo");
      const rutRaw = getColumnValue(row, "RUT", "Rut", "rut");
      const direccion = getColumnValue(
        row,
        "Dirección",
        "Direccion",
        "direccion",
        "DIRECCION",
        "Address",
        "address",
      );
      const ciudad = getColumnValue(row, "Ciudad", "ciudad", "CIUDAD", "City", "city");
      const generoRaw = getColumnValue(
        row,
        "Género",
        "Genero",
        "genero",
        "GENERO",
        "Gender",
        "gender",
      );

      const diaNacimiento = getColumnValue(
        row,
        "Día del nacimiento",
        "Día nacimiento",
        "Dia nacimiento",
        "dia_nacimiento",
        "DIA NACIMIENTO",
      );
      const mesNacimiento = getColumnValue(
        row,
        "Mes del nacimiento",
        "Mes nacimiento",
        "mes_nacimiento",
        "MES NACIMIENTO",
      );
      const anoNacimiento = getColumnValue(
        row,
        "Año de nacimiento",
        "Año nacimiento",
        "Ano nacimiento",
        "ano_nacimiento",
        "ANO NACIMIENTO",
      );
      const fechaNacimiento = parseBirthDateFromComponents(
        diaNacimiento,
        mesNacimiento,
        anoNacimiento,
      );

      const existing = await findExistingContacto(
        phoneResult.normalizedPhone,
        ctx,
      );

      if (existing) {
        // Duplicate found -- update only if the new row has a newer date
        if (!createdAt) {
          return {
            success: false,
            skipped: true,
            error: {
              row: rowIndex + 2,
              error: "Telefono duplicado (sin fecha para comparar)",
              data: phoneResult.normalizedPhone,
            },
          };
        }

        const newDate = new Date(createdAt);
        const existingDate = existing.existingCreatedAt
          ? new Date(existing.existingCreatedAt)
          : null;

        if (existingDate && newDate <= existingDate) {
          return {
            success: false,
            skipped: true,
            error: {
              row: rowIndex + 2,
              error: "Telefono duplicado (fecha no es mas reciente)",
              data: phoneResult.normalizedPhone,
            },
          };
        }

        const { error: updateContactoError } = await ctx.supabase
          .from("contactos")
          .update({
            name: fullName,
            created_at: createdAt,
          })
          .eq("id", existing.contactoId);

        if (updateContactoError) throw updateContactoError;

        if (existing.clienteId) {
          const clienteUpdate: Record<string, any> = {
            email: email ? String(email).trim() : null,
            rut: normalizeRut(rutRaw),
            direccion: direccion ? String(direccion).trim() : null,
            ciudad: ciudad ? String(ciudad).trim() : null,
            genero: parseGender(generoRaw),
            fecha_nacimiento: fechaNacimiento,
            created_at: createdAt,
          };

          const { error: updateClienteError } = await ctx.supabase
            .from("clientes")
            .update(clienteUpdate)
            .eq("id", existing.clienteId);

          if (updateClienteError) throw updateClienteError;

          const tagName = getColumnValue(
            row,
            "segmentacion_a11570",
            "Segmentacion",
            "segmentacion",
            "SEGMENTACION",
            "Tag",
            "tag",
          );
          if (tagName && String(tagName).trim()) {
            const tagNameStr = String(tagName).trim();
            let tagId = tagCache.get(tagNameStr);
            if (!tagId) {
              tagId = (await findOrCreateTag(tagNameStr, ctx)) ?? undefined;
              if (tagId) tagCache.set(tagNameStr, tagId);
            }
            if (tagId) await associateTagToCliente(ctx, existing.clienteId, tagId);
          }
        }

        return { success: true, skipped: false, updated: true };
      }

      // No existing record -- insert new contacto + cliente
      const contactoData: ContactoInsert = {
        contacto_numero: phoneResult.normalizedPhone,
        name: fullName,
        organizacion_id: ctx.organizacionId,
        phone_number_id: "bulk-import",
        tipo_de_fuente: "IMPORT_BULK",
        usa_flujo: true,
        usa_mcp: true,
      };

      if (createdAt) {
        contactoData.created_at = createdAt;
      }

      const { data: contacto, error: contactoError } = await ctx.supabase
        .from("contactos")
        .insert(contactoData)
        .select("id")
        .single();

      if (contactoError) {
        throw contactoError;
      }

      const clienteData: ClienteInsert = {
        contacto_id: contacto.id,
        organizacion_id: ctx.organizacionId,
        email: email ? String(email).trim() : null,
        rut: normalizeRut(rutRaw),
        direccion: direccion ? String(direccion).trim() : null,
        ciudad: ciudad ? String(ciudad).trim() : null,
        genero: parseGender(generoRaw),
        fecha_nacimiento: fechaNacimiento,
      };

      if (createdAt) {
        clienteData.created_at = createdAt;
      }

      const { data: cliente, error: clienteError } = await ctx.supabase
        .from("clientes")
        .insert(clienteData)
        .select("id")
        .single();

      if (clienteError) {
        // Compensating delete: there is no transaction, so an orphaned
        // contacto would poison the dedup key on the next run.
        await ctx.supabase.from("contactos").delete().eq("id", contacto.id);
        throw clienteError;
      }

      // Tag lives in the segmentacion_a11570 column
      const tagName = getColumnValue(
        row,
        "segmentacion_a11570",
        "Segmentacion",
        "segmentacion",
        "SEGMENTACION",
        "Tag",
        "tag",
      );
      if (tagName && String(tagName).trim()) {
        const tagNameStr = String(tagName).trim();

        let tagId = tagCache.get(tagNameStr);
        if (!tagId) {
          tagId = (await findOrCreateTag(tagNameStr, ctx)) ?? undefined;
          if (tagId) {
            tagCache.set(tagNameStr, tagId);
          }
        }

        if (tagId) {
          await associateTagToCliente(ctx, cliente.id, tagId);
        }
      }

      return { success: true, skipped: false };
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        return {
          success: false,
          skipped: false,
          error: {
            row: rowIndex + 2,
            error: `Error de BD: ${errorMessage(error)}`,
            data: String(
              getColumnValue(row, "Teléfono", "Telefono", "telefono") ?? "",
            ),
          },
        };
      }

      await sleep(100 * (attempt + 1));
    }
  }

  return { success: false, skipped: false };
}
