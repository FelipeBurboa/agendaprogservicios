import { getFlexibleColumnValue } from "../import-utils.js";
import {
  ProgressTracker,
  throwIfAborted,
  type ImportContext,
  type ImportResult,
} from "../types.js";
import {
  parseFileAllSheets,
  type ParsedExcelMultiSheet,
  type ParsedSheet,
} from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkComisionesImport.ts.
 *
 * Reads two named sheets ("Comisiones Servicios" / "Comisiones Productos") and
 * writes `profesionales.comisiones_json` as a FULL REPLACE: the import is
 * authoritative over that column. Product commissions are resolved once and
 * replicated onto every professional touched by the services sheet.
 */

type TipoComision = "porcentaje" | "monto_fijo";

interface ComisionGeneral {
  tipo: TipoComision;
  valor: number;
  activo: boolean;
}

interface ComisionExcepcion {
  servicio_id: string;
  servicio_nombre?: string;
  tipo: TipoComision;
  valor: number;
  activo: boolean;
}

interface ComisionExcepcionMarca {
  proveedor_id: string;
  proveedor_nombre?: string;
  tipo: TipoComision;
  valor: number;
  activo: boolean;
}

interface ComisionExcepcionProducto {
  producto_id: string;
  producto_nombre?: string;
  tipo: TipoComision;
  valor: number;
  activo: boolean;
}

interface ComisionProductosConfig {
  general: ComisionGeneral;
  excepciones_marca: ComisionExcepcionMarca[];
  excepciones_producto?: ComisionExcepcionProducto[];
}

interface ComisionesConfigExtended {
  general: ComisionGeneral;
  excepciones?: ComisionExcepcion[];
  productos?: ComisionProductosConfig;
  ultima_actualizacion: string | null;
}

interface NamedRow {
  id: string;
  nombre: string;
}

/** Map of normalized name -> candidates. >1 candidate = ambiguous, not resolvable by name. */
type NameLookup = Map<string, NamedRow[]>;

const SHEET_SERVICIOS = "comisiones servicios";
const SHEET_PRODUCTOS = "comisiones productos";

/**
 * The web hook takes this as a checkbox; the desktop importer has no options
 * channel, so the behaviour is pinned on.
 */
const ASIGNAR_SERVICIOS_FALTANTES = true;

/** PostgREST caps a select at 1000 rows; every preload pages explicitly. */
const PAGE_SIZE = 1000;

/**
 * Deliberately conservative normalization: lowercase, unaccented, collapsed
 * whitespace. It does NOT use `normalizeForComparison` from import-utils because
 * that one strips parenthesized content, and here parentheses distinguish real
 * products ("Color Mask (.13)" vs "(.32)", "Old Wax Suave" vs "Old Wax Fuerte").
 * Both sides (Excel and DB) go through the same function.
 */
const normalizarNombre = (value: string): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildLookup = (
  rows: Array<{ id: string; nombre: string | null }>,
): NameLookup => {
  const lookup: NameLookup = new Map();
  for (const row of rows) {
    const key = normalizarNombre(row.nombre ?? "");
    if (!key) continue;
    const existing = lookup.get(key) ?? [];
    lookup.set(key, [...existing, { id: row.id, nombre: row.nombre ?? "" }]);
  }
  return lookup;
};

const resolveName = (
  lookup: NameLookup,
  nombre: string,
): { match: NamedRow | null; ambiguous: boolean } => {
  const matches = lookup.get(normalizarNombre(nombre)) ?? [];
  if (matches.length > 1) return { match: null, ambiguous: true };
  return { match: matches[0] ?? null, ambiguous: false };
};

const parseTipo = (value: any): TipoComision | null => {
  const raw = normalizarNombre(String(value ?? ""));
  if (raw === "porcentaje") return "porcentaje";
  if (raw === "monto fijo" || raw === "monto_fijo") return "monto_fijo";
  return null;
};

const parseValor = (value: any): number | null => {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Accumulates one commission per key (servicio_id / producto_id), resolving
 * clashes: two identical rows dedupe silently, two rows with different values
 * discard BOTH and the key is flagged as a conflict (Agenda Pro exports by name
 * and loses its id, so there is no way to know which one wins).
 */
export function acumularComision<T extends { tipo: TipoComision; valor: number }>(
  acumulado: Map<string, T>,
  conflictos: Set<string>,
  clave: string,
  entrada: T,
): "agregado" | "duplicado" | "conflicto" {
  if (conflictos.has(clave)) return "conflicto";

  const previo = acumulado.get(clave);
  if (!previo) {
    acumulado.set(clave, entrada);
    return "agregado";
  }

  if (previo.tipo === entrada.tipo && previo.valor === entrada.valor)
    return "duplicado";

  acumulado.delete(clave);
  conflictos.add(clave);
  return "conflicto";
}

export const asignacionKey = (profesionalId: string, servicioId: string) =>
  `${profesionalId}|${servicioId}`;

/**
 * State of the profesional<->servicio link in `profesional_servicio`.
 * `pausada` (row with activo=false) is NOT the same as `falta`: the pause is a
 * deliberate UI toggle, so the import respects it instead of reactivating it.
 */
export function clasificarAsignacion(
  asignaciones: Map<string, boolean>,
  profesionalId: string,
  servicioId: string,
): "activa" | "pausada" | "falta" {
  const activo = asignaciones.get(asignacionKey(profesionalId, servicioId));
  if (activo === undefined) return "falta";
  return activo ? "activa" : "pausada";
}

/**
 * Locates a sheet by its canonical name; if the name does not match, it falls
 * back to detecting by columns (Profesional => servicios, Producto without
 * Profesional => productos).
 */
const pickSheets = (parsed: ParsedExcelMultiSheet) => {
  let servicios: ParsedSheet | null = null;
  let productos: ParsedSheet | null = null;

  for (const sheet of parsed.sheets) {
    const name = normalizarNombre(sheet.name);
    if (name === SHEET_SERVICIOS) servicios = sheet;
    else if (name === SHEET_PRODUCTOS) productos = sheet;
  }

  if (!servicios || !productos) {
    for (const sheet of parsed.sheets) {
      const headers = sheet.headers.map((h) => normalizarNombre(String(h ?? "")));
      const hasProfesional = headers.includes("profesional");
      const hasProducto = headers.includes("producto");
      if (!servicios && hasProfesional) servicios = sheet;
      else if (!productos && hasProducto && !hasProfesional) productos = sheet;
    }
  }

  return { servicios, productos };
};

export async function importComisiones(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("comisiones", ctx.onProgress);

  if (!ctx.organizacionId) {
    throw new Error("Debe seleccionar una organizacion");
  }

  // Warnings and errors both land in the tracker (ImportRowError has no `type`),
  // but the counters stay split so the summary keeps the web hook's meaning.
  let warningCount = 0;
  let errorCount = 0;
  const pushError = (
    row: number,
    sheetName: string,
    referencia: string,
    error: string,
    type: "error" | "warning" = "error",
  ) => {
    if (type === "warning") warningCount += 1;
    else errorCount += 1;
    tracker.addError({ row, sheet: sheetName, error, data: referencia });
  };

  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);

  const parsed = parseFileAllSheets(filePath);
  const { servicios: hojaServicios, productos: hojaProductos } =
    pickSheets(parsed);

  if (!hojaServicios && !hojaProductos) {
    throw new Error(
      'El archivo no contiene las hojas "Comisiones Servicios" ni "Comisiones Productos"',
    );
  }

  const filasServicios = hojaServicios?.rows ?? [];
  const filasProductos = hojaProductos?.rows ?? [];
  const totalRows = filasServicios.length + filasProductos.length;

  if (totalRows === 0) {
    throw new Error("El archivo no contiene datos");
  }

  tracker.patch(
    {
      status: "importing",
      total: totalRows,
      message: "Cargando profesionales, servicios y productos...",
    },
    true,
  );

  const {
    profesionalLookup,
    servicioLookup,
    productoLookup,
    asignaciones,
  } = await preloadLookups(ctx);

  // ---- Productos sheet: resolved once and replicated onto every profesional ----
  const productosSheetName = hojaProductos?.name ?? "Comisiones Productos";
  const excepcionesProductoPorId = new Map<string, ComisionExcepcionProducto>();
  const productosEnConflicto = new Set<string>();

  filasProductos.forEach((row, index) => {
    const fila = index + 2;
    const nombre = String(
      getFlexibleColumnValue(row, "Producto", "producto") ?? "",
    ).trim();
    const tipo = parseTipo(getFlexibleColumnValue(row, "Tipo", "tipo"));
    const valor = parseValor(getFlexibleColumnValue(row, "Valor", "valor"));

    if (!nombre) {
      pushError(fila, productosSheetName, "", "Producto vacio");
      return;
    }
    if (!tipo) {
      pushError(
        fila,
        productosSheetName,
        nombre,
        "Tipo invalido (debe ser porcentaje o monto_fijo)",
      );
      return;
    }
    if (valor === null) {
      pushError(
        fila,
        productosSheetName,
        nombre,
        "Valor invalido (debe ser un numero mayor a 0)",
      );
      return;
    }

    const { match, ambiguous } = resolveName(productoLookup, nombre);
    if (ambiguous) {
      pushError(
        fila,
        productosSheetName,
        nombre,
        "Nombre ambiguo: coincide con mas de un producto en VentaPlay",
      );
      return;
    }
    if (!match) {
      pushError(
        fila,
        productosSheetName,
        nombre,
        "Producto no encontrado en VentaPlay",
      );
      return;
    }

    const desenlace = acumularComision(
      excepcionesProductoPorId,
      productosEnConflicto,
      match.id,
      {
        producto_id: match.id,
        producto_nombre: match.nombre,
        tipo,
        valor,
        activo: true,
      },
    );

    if (desenlace === "conflicto") {
      pushError(
        fila,
        productosSheetName,
        nombre,
        "Filas duplicadas con valores distintos para el mismo producto",
      );
    }
  });

  const excepcionesProducto = Array.from(excepcionesProductoPorId.values());

  // ---- Servicios sheet: group by profesional ----
  const serviciosSheetName = hojaServicios?.name ?? "Comisiones Servicios";
  interface GrupoProfesional {
    nombreExcel: string;
    filas: Array<{
      fila: number;
      servicio: string;
      tipo: TipoComision;
      valor: number;
    }>;
  }
  const grupos = new Map<string, GrupoProfesional>();

  filasServicios.forEach((row, index) => {
    const fila = index + 2;
    const profesional = String(
      getFlexibleColumnValue(row, "Profesional", "profesional") ?? "",
    ).trim();
    const servicio = String(
      getFlexibleColumnValue(row, "Servicio", "servicio") ?? "",
    ).trim();
    const tipo = parseTipo(getFlexibleColumnValue(row, "Tipo", "tipo"));
    const valor = parseValor(getFlexibleColumnValue(row, "Valor", "valor"));

    if (!profesional) {
      pushError(fila, serviciosSheetName, "", "Profesional vacio");
      return;
    }
    if (!servicio) {
      pushError(fila, serviciosSheetName, profesional, "Servicio vacio");
      return;
    }
    if (!tipo) {
      pushError(
        fila,
        serviciosSheetName,
        `${profesional} / ${servicio}`,
        "Tipo invalido (debe ser porcentaje o monto_fijo)",
      );
      return;
    }
    if (valor === null) {
      pushError(
        fila,
        serviciosSheetName,
        `${profesional} / ${servicio}`,
        "Valor invalido (debe ser un numero mayor a 0)",
      );
      return;
    }

    const key = normalizarNombre(profesional);
    const grupo = grupos.get(key) ?? { nombreExcel: profesional, filas: [] };
    grupo.filas.push({ fila, servicio, tipo, valor });
    grupos.set(key, grupo);
  });

  const totalBatches = grupos.size;
  tracker.patch(
    {
      status: "importing",
      totalBatches,
      message: "Importando comisiones...",
    },
    true,
  );

  let profesionalesActualizados = 0;
  let excepcionesServicioTotal = 0;
  let excepcionesProductoTotal = 0;
  let asignacionesCreadas = 0;
  let processed = filasProductos.length;
  let batchIndex = 0;

  for (const [, grupo] of grupos) {
    throwIfAborted(ctx.signal);

    batchIndex += 1;
    const refProfesional = grupo.nombreExcel;
    const { match: profesional, ambiguous } = resolveName(
      profesionalLookup,
      refProfesional,
    );

    if (ambiguous || !profesional) {
      const motivo = ambiguous
        ? "Nombre ambiguo: coincide con mas de un profesional en VentaPlay"
        : "Profesional no encontrado en VentaPlay";
      grupo.filas.forEach((f) =>
        pushError(
          f.fila,
          serviciosSheetName,
          `${refProfesional} / ${f.servicio}`,
          motivo,
        ),
      );
      processed += grupo.filas.length;
      tracker.patch({ processed, currentBatch: batchIndex });
      continue;
    }

    const excepcionesPorServicio = new Map<string, ComisionExcepcion>();
    const serviciosEnConflicto = new Set<string>();
    const serviciosPorAsignar = new Map<string, string>(); // servicio_id -> nombre

    for (const f of grupo.filas) {
      const ref = `${refProfesional} / ${f.servicio}`;
      const resolved = resolveName(servicioLookup, f.servicio);

      if (resolved.ambiguous) {
        pushError(
          f.fila,
          serviciosSheetName,
          ref,
          "Nombre ambiguo: coincide con mas de un servicio en VentaPlay",
          "warning",
        );
        continue;
      }
      if (!resolved.match) {
        pushError(
          f.fila,
          serviciosSheetName,
          ref,
          "Servicio no encontrado en VentaPlay",
          "warning",
        );
        continue;
      }

      const servicioId = resolved.match.id;
      const desenlace = acumularComision(
        excepcionesPorServicio,
        serviciosEnConflicto,
        servicioId,
        {
          servicio_id: servicioId,
          servicio_nombre: resolved.match.nombre,
          tipo: f.tipo,
          valor: f.valor,
          activo: true,
        },
      );

      if (desenlace === "conflicto") {
        pushError(
          f.fila,
          serviciosSheetName,
          ref,
          "Filas duplicadas con valores distintos para el mismo servicio",
          "warning",
        );
        continue;
      }
      if (desenlace === "duplicado") continue;

      // A commission implies the professional performs the service; if the link
      // does not exist we create it, but a manual pause is respected.
      const estado = clasificarAsignacion(
        asignaciones,
        profesional.id,
        servicioId,
      );
      if (estado === "pausada") {
        pushError(
          f.fila,
          serviciosSheetName,
          ref,
          "El profesional tiene el servicio asignado pero pausado; se dejo como estaba",
          "warning",
        );
      } else if (estado === "falta" && ASIGNAR_SERVICIOS_FALTANTES) {
        serviciosPorAsignar.set(servicioId, resolved.match.nombre);
      }
    }

    const excepciones = Array.from(excepcionesPorServicio.values());

    // Full replace: the import is authoritative over comisiones_json.
    const comisionesJson: ComisionesConfigExtended = {
      general: { tipo: "porcentaje", valor: 0, activo: false },
      excepciones,
      productos: {
        general: { tipo: "porcentaje", valor: 0, activo: false },
        excepciones_marca: [],
        excepciones_producto: excepcionesProducto,
      },
      ultima_actualizacion: new Date().toISOString(),
    };

    throwIfAborted(ctx.signal);

    // .select().single() is deliberate: without it an RLS no-op passes as success.
    const { error } = await ctx.supabase
      .from("profesionales")
      .update({ comisiones_json: comisionesJson as any })
      .eq("id", profesional.id)
      .eq("organizacion_id", ctx.organizacionId)
      .select("id")
      .single();

    if (error) {
      grupo.filas.forEach((f) =>
        pushError(
          f.fila,
          serviciosSheetName,
          `${refProfesional} / ${f.servicio}`,
          `Error de BD: ${error.message}`,
        ),
      );
    } else {
      profesionalesActualizados += 1;
      excepcionesServicioTotal += excepciones.length;
      excepcionesProductoTotal += excepcionesProducto.length;

      if (serviciosPorAsignar.size > 0) {
        // organizacion_id is overwritten by the validate_profesional_servicio_data
        // trigger with the professional's org; cupos keeps the DB default of 1.
        const { error: asignacionError } = await ctx.supabase
          .from("profesional_servicio")
          .insert(
            Array.from(serviciosPorAsignar.keys()).map((servicioId) => ({
              profesional_id: profesional.id,
              servicio_id: servicioId,
              organizacion_id: ctx.organizacionId,
              activo: true,
            })) as any,
          );

        if (asignacionError) {
          // The commission is already written: this is a warning, not a failure.
          for (const nombreServicio of serviciosPorAsignar.values()) {
            pushError(
              0,
              serviciosSheetName,
              `${refProfesional} / ${nombreServicio}`,
              `No se pudo asignar el servicio: ${asignacionError.message}`,
              "warning",
            );
          }
        } else {
          asignacionesCreadas += serviciosPorAsignar.size;
          for (const servicioId of serviciosPorAsignar.keys()) {
            asignaciones.set(asignacionKey(profesional.id, servicioId), true);
          }
        }
      }
    }

    processed += grupo.filas.length;
    // Tracker field mapping: updated = profesionales actualizados,
    // successful = asignaciones creadas, skipped = warnings.
    tracker.patch({
      processed,
      currentBatch: batchIndex,
      updated: profesionalesActualizados,
      successful: asignacionesCreadas,
      skipped: warningCount,
    });
  }

  // ImportResult has no slots for the commission-specific totals the web hook
  // returns, so they ride along in the summary message.
  tracker.patch({
    processed: totalRows,
    updated: profesionalesActualizados,
    successful: asignacionesCreadas,
    skipped: warningCount,
    message:
      `${profesionalesActualizados} profesionales actualizados | ` +
      `${excepcionesServicioTotal} excepciones de servicio | ` +
      `${excepcionesProductoTotal} excepciones de producto | ` +
      `${asignacionesCreadas} asignaciones creadas | ` +
      `${warningCount} advertencias | ${errorCount} errores`,
  });

  return tracker.toResult();
}

interface ComisionesLookups {
  profesionalLookup: NameLookup;
  servicioLookup: NameLookup;
  productoLookup: NameLookup;
  asignaciones: Map<string, boolean>;
}

/**
 * Every select pages with `.range()`. PostgREST caps an unpaged select at 1000
 * rows, and a truncated lookup here silently turns into UNIQUE-violation storms
 * on `profesional_servicio`. Do not collapse these back into a single select.
 */
async function preloadLookups(ctx: ImportContext): Promise<ComisionesLookups> {
  const fetchNamed = async (
    table: string,
    label: string,
  ): Promise<Array<{ id: string; nombre: string | null }>> => {
    const all: Array<{ id: string; nombre: string | null }> = [];
    let from = 0;
    while (true) {
      const { data, error } = await ctx.supabase
        .from(table)
        .select("id, nombre")
        .eq("organizacion_id", ctx.organizacionId)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Error cargando ${label}: ${error.message}`);
      all.push(...((data || []) as any[]));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

  const fetchAsignaciones = async (): Promise<
    Array<{ profesional_id: string; servicio_id: string; activo: boolean }>
  > => {
    const all: Array<{
      profesional_id: string;
      servicio_id: string;
      activo: boolean;
    }> = [];
    let from = 0;
    while (true) {
      const { data, error } = await ctx.supabase
        .from("profesional_servicio")
        .select("profesional_id, servicio_id, activo")
        .eq("organizacion_id", ctx.organizacionId)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Error cargando asignaciones: ${error.message}`);
      all.push(...((data || []) as any[]));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

  const [profesionalesRows, serviciosRows, productosRows, asignacionesRows] =
    await Promise.all([
      fetchNamed("profesionales", "profesionales"),
      fetchNamed("servicios", "servicios"),
      fetchNamed("productos_stock", "productos"),
      fetchAsignaciones(),
    ]);

  const asignaciones = new Map<string, boolean>();
  for (const row of asignacionesRows) {
    asignaciones.set(
      asignacionKey(row.profesional_id, row.servicio_id),
      row.activo !== false,
    );
  }

  return {
    profesionalLookup: buildLookup(profesionalesRows),
    servicioLookup: buildLookup(serviciosRows),
    productoLookup: buildLookup(productosRows),
    asignaciones,
  };
}
