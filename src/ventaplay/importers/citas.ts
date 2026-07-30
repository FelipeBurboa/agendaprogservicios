import {
  findByWordSubset,
  getFlexibleColumnValue,
  normalizeForComparison as sharedNormalizeForComparison,
  sleep,
} from "../import-utils.js";
import { normalizePhone } from "../phone-normalization.js";
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
import { parseFileAllSheets, type ParsedExcelMultiSheet } from "../xlsx-parse.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkCitasImport.ts.
 *
 * Multi-sheet importer. Every sheet of the workbook is flattened into one row
 * list before batching, so `sheet` is carried on each reported error.
 *
 * Side effects beyond inserting into `citas`: missing `servicios` are created,
 * missing `profesional_servicio` links are created, and unknown phone numbers
 * get a `contactos` + `clientes` pair.
 */

// ─── Pre-loaded lookup types ─────────────────────────────────

interface ProfesionalLookup {
  id: string;
  nombre: string;
  sucursal_id: string | null;
}

interface ServicioLookup {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
}

interface SucursalLookup {
  id: string;
  nombre: string;
}

interface CitasImportError {
  row: number;
  sheetName: string;
  profesional: string;
  servicio: string;
  cliente: string;
  error: string;
  type: "error" | "warning";
}

interface CreatedClienteInfo {
  clienteId: string;
  nombre: string;
  telefono: string;
  email: string | null;
}

// ─── Constants ───────────────────────────────────────────────

const ESTADO_MAP: Record<string, string> = {
  ATTENDED: "completada",
  CONFIRMED: "confirmada",
  RESERVED: "agendada",
  CANCELLED: "cancelada",
  NO_SHOW: "no_asistio",
  WAITLISTED: "agendada",
};

/**
 * The web tab exposes this as a checkbox defaulting to false, because a web
 * user may upload any workbook. Here the input is always this app's own
 * bookings export, which writes one worksheet per sucursal (named after the
 * AgendaPro location -- see buildBookingsWorkbook in src/excel.ts), so sucursal
 * mode is on. Matches profesionales.ts and bloqueos.ts, whose exports are
 * tabbed the same way.
 *
 * Typed as `boolean` on purpose so the sucursal branches stay reachable code.
 */
const USE_SUCURSAL_MODE: boolean = true;

// ─── Helpers ─────────────────────────────────────────────────

const normalizeForComparison = (str: string): string => {
  return sharedNormalizeForComparison(str);
};

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
      const horaPart = hora.split(".")[0]; // strip ms if present
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

/** Flattens the web's richer row error into the shared ImportRowError shape. */
const toRowError = (error: CitasImportError): ImportRowError => ({
  row: error.row,
  sheet: error.sheetName,
  error: error.error,
  data: [error.profesional, error.servicio, error.cliente].join(" | "),
});

export async function importCitas(
  filePath: string,
  ctx: ImportContext,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("citas", ctx.onProgress);

  // 1. Parse Excel
  tracker.patch({ status: "parsing", message: "Leyendo archivo..." }, true);

  const parsed: ParsedExcelMultiSheet = parseFileAllSheets(filePath);

  if (parsed.totalRows === 0) {
    throw new Error("El archivo no contiene datos");
  }

  throwIfAborted(ctx.signal);

  // 2. Pre-load lookups
  tracker.patch(
    { status: "importing", message: "Cargando datos existentes..." },
    true,
  );
  const lookups = await preloadLookups(ctx, USE_SUCURSAL_MODE);

  // 3. Build flat list of rows with sheet context
  const allRows: Array<{
    row: Record<string, any>;
    sheetName: string;
    sucursalId: string | null;
    globalIdx: number;
  }> = [];
  let globalIdx = 0;

  for (const sheet of parsed.sheets) {
    let sucursalId: string | null = null;

    if (USE_SUCURSAL_MODE) {
      // Extract sucursal name from sheet name (e.g. "Sucursal Bellas Artes" → "Bellas Artes")
      const sheetNorm = normalizeForComparison(sheet.name);
      // Try full sheet name first
      let suc = lookups.sucursalMap.get(sheetNorm);
      if (!suc) {
        // Try removing "sucursal" prefix
        const withoutPrefix = sheetNorm.replace(/^sucursal\s+/, "");
        suc = lookups.sucursalMap.get(withoutPrefix);
      }
      if (!suc) {
        // Try partial match: find any sucursal whose normalized name is contained in sheet name
        for (const [key, val] of lookups.sucursalMap) {
          if (sheetNorm.includes(key) || key.includes(sheetNorm)) {
            suc = val;
            break;
          }
        }
      }
      sucursalId = suc?.id ?? null;
    }

    for (const row of sheet.rows) {
      allRows.push({ row, sheetName: sheet.name, sucursalId, globalIdx });
      globalIdx++;
    }
  }

  const totalBatches = Math.ceil(allRows.length / BATCH_SIZE);

  tracker.patch(
    {
      total: allRows.length,
      processed: 0,
      successful: 0,
      skipped: 0,
      currentBatch: 0,
      totalBatches,
      status: "importing",
      message: "Importando citas...",
    },
    true,
  );

  const allCreatedClientes: CreatedClienteInfo[] = [];
  let successful = 0;
  let skipped = 0;
  let warningCount = 0;
  let errorCount = 0;
  let contactosCreated = 0;

  const phoneCache = new Map<string, string>();
  const duplicateCache = new Set<string>();

  // 4. Process in batches
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    throwIfAborted(ctx.signal);

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, allRows.length);
    const batchRows = allRows.slice(startIdx, endIdx);

    tracker.patch({ currentBatch: batchIndex + 1 });

    for (let i = 0; i < batchRows.length; i++) {
      throwIfAborted(ctx.signal);

      const { row, sheetName, sucursalId } = batchRows[i];

      // If sucursal mode and no sucursal matched for this sheet, skip
      if (USE_SUCURSAL_MODE && !sucursalId) {
        skipped++;
        tracker.addError(
          toRowError({
            row: batchRows[i].globalIdx + 2,
            sheetName,
            profesional: "",
            servicio: "",
            cliente: "",
            error: `Sucursal no encontrada para sheet: "${sheetName}"`,
            type: "error",
          }),
        );
        errorCount++;
      } else {
        const res = await processRow(
          row,
          batchRows[i].globalIdx,
          sheetName,
          ctx,
          sucursalId,
          lookups,
          phoneCache,
          duplicateCache,
        );

        if (res.contactoCreated) {
          contactosCreated++;
          if (res.clienteInfo) allCreatedClientes.push(res.clienteInfo);
        }

        if (res.success) {
          successful++;
          if (res.warning) warningCount++;
        } else if (res.skipped) {
          skipped++;
        } else {
          errorCount++;
        }

        if (res.error) {
          tracker.addError(toRowError(res.error));
          if (res.error.type === "warning") warningCount++;
        }
      }

      // Update progress every 10 rows
      if ((i + 1) % 10 === 0 || i === batchRows.length - 1) {
        const processed = startIdx + i + 1;
        tracker.patch({ processed, successful, skipped });
      }
    }

    if (batchIndex < totalBatches - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return tracker.toResult();
}

// ─── Pre-load DB lookups ──────────────────────────────────

async function preloadLookups(
  ctx: ImportContext,
  useSucursalMode: boolean,
): Promise<{
  profesionalMap: Map<string, ProfesionalLookup>;
  servicioMap: Map<string, ServicioLookup[]>;
  profServSet: Set<string>;
  sucursalMap: Map<string, SucursalLookup>;
}> {
  // profesional_servicio: paginado + filtrado por org. Sin filtro de org ni
  // paginación, Supabase trunca a max_rows=1000 sobre la tabla GLOBAL — los
  // vínculos de la org casi nunca quedaban dentro, el importador intentaba
  // re-insertarlos y chocaba con el UNIQUE constraint. Bug latente desde la
  // creación del importador; se activó al crecer la tabla global > 1000 filas.
  const loadProfServ = async (): Promise<
    Array<{ profesional_id: string; servicio_id: string; activo: boolean }>
  > => {
    const all: Array<{
      profesional_id: string;
      servicio_id: string;
      activo: boolean;
    }> = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await ctx.supabase
        .from("profesional_servicio")
        .select("profesional_id, servicio_id, activo")
        .eq("organizacion_id", ctx.organizacionId)
        .range(from, from + pageSize - 1);
      if (error)
        throw new Error(`Error cargando profesional_servicio: ${error.message}`);
      all.push(...((data || []) as any[]));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const [profResult, servResult, profServData, sucResult] = await Promise.all([
    ctx.supabase
      .from("profesionales")
      .select("id, nombre, nombre_unaccented, sucursal_id")
      .eq("organizacion_id", ctx.organizacionId),
    ctx.supabase
      .from("servicios")
      .select("id, nombre, nombre_unaccented, precio, duracion_minutos")
      .eq("organizacion_id", ctx.organizacionId),
    loadProfServ(),
    useSucursalMode
      ? ctx.supabase
          .from("sucursales")
          .select("id, nombre, nombre_unaccented")
          .eq("organizacion_id", ctx.organizacionId)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

  if (profResult.error)
    throw new Error(`Error cargando profesionales: ${profResult.error.message}`);
  if (servResult.error)
    throw new Error(`Error cargando servicios: ${servResult.error.message}`);
  if (sucResult.error)
    throw new Error(
      `Error cargando sucursales: ${(sucResult.error as any).message}`,
    );

  // Build normalized name → entity maps
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

  const servicioMap = new Map<string, ServicioLookup[]>();
  for (const s of servResult.data || []) {
    const raw = s as any;
    const entry: ServicioLookup = {
      id: raw.id,
      nombre: raw.nombre,
      precio: raw.precio,
      duracion_minutos: raw.duracion_minutos,
    };
    const key = normalizeForComparison(raw.nombre || "");
    if (!servicioMap.has(key)) servicioMap.set(key, []);
    servicioMap.get(key)!.push(entry);
    if (raw.nombre_unaccented) {
      const uKey = normalizeForComparison(raw.nombre_unaccented);
      if (!servicioMap.has(uKey)) servicioMap.set(uKey, []);
      servicioMap.get(uKey)!.push(entry);
    }
  }

  // prof↔servicio links: Set de "profId|servId" para responder "¿existe el
  // vínculo?" sin re-insertarlo. NO se filtra por activo — un vínculo inactivo
  // igual existe en la tabla, y re-insertarlo choca con el UNIQUE constraint.
  const profServSet = new Set<string>();
  for (const ps of profServData) {
    profServSet.add(`${ps.profesional_id}|${ps.servicio_id}`);
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

  return { profesionalMap, servicioMap, profServSet, sucursalMap };
}

// ─── Resolve or create contacto/cliente ───────────────────

async function resolveCliente(
  phone: string,
  email: string | null,
  clienteName: string | null,
  ctx: ImportContext,
  phoneCache: Map<string, string>,
): Promise<{
  clienteId: string;
  created: boolean;
  nombre?: string;
  telefono?: string;
  email?: string | null;
} | null> {
  // Check cache first
  const cached = phoneCache.get(phone);
  if (cached) return { clienteId: cached, created: false };

  // Query DB
  const { data: contactoData } = await ctx.supabase
    .from("contactos")
    .select("id")
    .eq("contacto_numero", phone)
    .eq("organizacion_id", ctx.organizacionId)
    .limit(1);

  if (contactoData && contactoData.length > 0) {
    const contactoId = contactoData[0].id;
    const { data: clienteData } = await ctx.supabase
      .from("clientes")
      .select("id")
      .eq("contacto_id", contactoId)
      .limit(1);

    if (clienteData && clienteData.length > 0) {
      phoneCache.set(phone, clienteData[0].id);
      return { clienteId: clienteData[0].id, created: false };
    }

    // Contacto exists but no cliente — create cliente
    const { data: newCliente, error: clienteErr } = await ctx.supabase
      .from("clientes")
      .insert({
        contacto_id: contactoId,
        organizacion_id: ctx.organizacionId,
        email: email || null,
      })
      .select("id")
      .single();

    if (clienteErr) throw clienteErr;
    phoneCache.set(phone, newCliente.id);
    return {
      clienteId: newCliente.id,
      created: true,
      nombre: clienteName || "",
      telefono: phone,
      email,
    };
  }

  // No contacto — create both
  const { data: newContacto, error: contactoErr } = await ctx.supabase
    .from("contactos")
    .insert({
      contacto_numero: phone,
      name: clienteName || null,
      organizacion_id: ctx.organizacionId,
      phone_number_id: "bulk-import",
      tipo_de_fuente: "IMPORT_BULK",
      usa_flujo: true,
      usa_mcp: true,
    })
    .select("id")
    .single();

  if (contactoErr) throw contactoErr;

  const { data: newCliente, error: clienteErr } = await ctx.supabase
    .from("clientes")
    .insert({
      contacto_id: newContacto.id,
      organizacion_id: ctx.organizacionId,
      email: email || null,
    })
    .select("id")
    .single();

  if (clienteErr) {
    await ctx.supabase.from("contactos").delete().eq("id", newContacto.id);
    throw clienteErr;
  }

  phoneCache.set(phone, newCliente.id);
  return {
    clienteId: newCliente.id,
    created: true,
    nombre: clienteName || "",
    telefono: phone,
    email,
  };
}

// ─── Process a single row ─────────────────────────────────

async function processRow(
  row: Record<string, any>,
  rowIndex: number,
  sheetName: string,
  ctx: ImportContext,
  sucursalId: string | null,
  lookups: {
    profesionalMap: Map<string, ProfesionalLookup>;
    servicioMap: Map<string, ServicioLookup[]>;
    profServSet: Set<string>;
  },
  phoneCache: Map<string, string>,
  duplicateCache: Set<string>,
): Promise<{
  success: boolean;
  skipped: boolean;
  warning: boolean;
  contactoCreated: boolean;
  error?: CitasImportError;
  clienteInfo?: CreatedClienteInfo;
}> {
  const makeError = (
    msg: string,
    type: "error" | "warning" = "error",
  ): CitasImportError => ({
    row: rowIndex + 2,
    sheetName,
    profesional: String(getColumnValue(row, "Profesional", "profesional") ?? ""),
    servicio: String(getColumnValue(row, "Servicio", "servicio") ?? ""),
    cliente: String(getColumnValue(row, "Cliente", "cliente") ?? ""),
    error: msg,
    type,
  });

  // 2. Match profesional
  const profName = String(
    getColumnValue(row, "Profesional", "profesional", "PROFESIONAL") ?? "",
  ).trim();
  if (!profName)
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated: false,
      error: makeError("Profesional vacío"),
    };

  const normalizedProfName = normalizeForComparison(profName);
  const prof =
    lookups.profesionalMap.get(normalizedProfName) ??
    findProfessionalByWordSubset(profName, lookups.profesionalMap);
  if (!prof)
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated: false,
      error: makeError(`Profesional no encontrado: "${profName}"`),
    };

  // 3. Match servicio
  const servName = String(
    getColumnValue(row, "Servicio", "servicio", "SERVICIO") ?? "",
  ).trim();
  if (!servName)
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated: false,
      error: makeError("Servicio vacío"),
    };

  const servCandidates = lookups.servicioMap.get(
    normalizeForComparison(servName),
  );
  let serv: ServicioLookup | null = null;

  if (servCandidates && servCandidates.length > 0) {
    // Try to find a candidate that the professional has active
    for (const candidate of servCandidates) {
      if (lookups.profServSet.has(`${prof.id}|${candidate.id}`)) {
        serv = candidate;
        break;
      }
    }
    // If none linked to prof, use first candidate (will auto-link below)
    if (!serv) serv = servCandidates[0];
  }

  if (!serv) {
    // Auto-create service
    const precioRaw = getColumnValue(row, "Precio", "precio", "PRECIO", "Price");
    const duracionRaw = getColumnValue(
      row,
      "Duracion (min)",
      "Duración (min)",
      "Duracion",
      "Duración",
      "duracion",
      "DURACION",
    );
    const newPrecio = precioRaw ? Number(precioRaw) : 0;
    const newDuracion = duracionRaw ? Number(duracionRaw) : 0;

    const { data: newServ, error: servErr } = await ctx.supabase
      .from("servicios")
      .insert({
        nombre: servName,
        descripcion: "Servicio importado",
        precio: isNaN(newPrecio) ? 0 : newPrecio,
        duracion_minutos: isNaN(newDuracion) ? 0 : newDuracion,
        organizacion_id: ctx.organizacionId,
        activo: true,
        abono: 0,
      })
      .select("id, nombre, precio, duracion_minutos")
      .single();

    if (servErr) {
      return {
        success: false,
        skipped: true,
        warning: false,
        contactoCreated: false,
        error: makeError(
          `Error creando servicio "${servName}": ${servErr.message}`,
        ),
      };
    }

    serv = {
      id: newServ.id,
      nombre: newServ.nombre,
      precio: newServ.precio,
      duracion_minutos: newServ.duracion_minutos,
    };

    // Add to in-memory cache so subsequent rows find it
    const sKey = normalizeForComparison(servName);
    if (!lookups.servicioMap.has(sKey)) lookups.servicioMap.set(sKey, []);
    lookups.servicioMap.get(sKey)!.push(serv);
  }

  // 4. Ensure prof↔servicio link exists
  const profServKey = `${prof.id}|${serv.id}`;
  if (!lookups.profServSet.has(profServKey)) {
    const { error: linkErr } = await ctx.supabase
      .from("profesional_servicio")
      .insert({
        profesional_id: prof.id,
        servicio_id: serv.id,
        organizacion_id: ctx.organizacionId,
        activo: true,
      });

    if (linkErr) {
      return {
        success: false,
        skipped: true,
        warning: false,
        contactoCreated: false,
        error: makeError(
          `Error vinculando servicio "${servName}" a profesional: ${linkErr.message}`,
        ),
      };
    }

    lookups.profServSet.add(profServKey);
  }

  // 5. Validate prof↔sucursal (warn only)
  let warningMsg: string | null = null;
  if (sucursalId && prof.sucursal_id && prof.sucursal_id !== sucursalId) {
    warningMsg = `Profesional "${profName}" pertenece a otra sucursal (se usará la del sheet)`;
  }

  // 6. Resolve contacto/cliente
  const phoneRaw = getColumnValue(
    row,
    "Telefono",
    "Teléfono",
    "telefono",
    "TELEFONO",
    "Phone",
  );
  const phoneResult = normalizePhone(phoneRaw);
  const clienteName =
    String(getColumnValue(row, "Cliente", "cliente", "CLIENTE") ?? "").trim() ||
    null;
  const emailRaw = getColumnValue(row, "Email", "email", "EMAIL", "Correo");
  const email = emailRaw ? String(emailRaw).trim() : null;

  let clienteId: string | null = null;
  let contactoCreated = false;
  let clienteInfo: CreatedClienteInfo | undefined;
  if (phoneResult.isValid && phoneResult.normalizedPhone) {
    try {
      const resolved = await resolveCliente(
        phoneResult.normalizedPhone,
        email,
        clienteName,
        ctx,
        phoneCache,
      );
      if (resolved) {
        clienteId = resolved.clienteId;
        contactoCreated = resolved.created;
        if (resolved.created) {
          clienteInfo = {
            clienteId: resolved.clienteId,
            nombre: resolved.nombre || "",
            telefono: resolved.telefono || "",
            email: resolved.email ?? null,
          };
        }
      }
    } catch (err) {
      return {
        success: false,
        skipped: false,
        warning: false,
        contactoCreated: false,
        error: makeError(
          `Error creando contacto/cliente: ${err instanceof Error ? err.message : "Error DB"}`,
        ),
      };
    }
  } else {
    // Try to find by name as fallback — skip if no phone
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated: false,
      error: makeError(
        `Teléfono inválido para cliente: "${String(phoneRaw ?? "")}"`,
      ),
    };
  }

  if (!clienteId) {
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated: false,
      error: makeError("No se pudo resolver cliente"),
    };
  }

  // 7. Parse date/time
  const inicioRaw = getColumnValue(row, "Inicio", "inicio", "INICIO", "Start");
  const finRaw = getColumnValue(row, "Fin", "fin", "FIN", "End");

  const inicio = parseDateTime(inicioRaw);
  const fin = parseDateTime(finRaw);

  if (!inicio) {
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated,
      error: makeError(
        `No se pudo parsear fecha Inicio: "${String(inicioRaw ?? "")}"`,
      ),
    };
  }

  const horaFin = fin?.hora || null;

  // 8. Map estado
  const estadoRaw = String(
    getColumnValue(row, "Estado", "estado", "ESTADO", "Status") ?? "",
  )
    .trim()
    .toUpperCase();
  const estado = ESTADO_MAP[estadoRaw];
  if (!estado) {
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated,
      error: makeError(`Estado desconocido: "${estadoRaw}"`),
    };
  }

  // 9. Check duplicate
  const dupeKey = `${prof.id}|${serv.id}|${inicio.fecha}|${inicio.hora}|${clienteId}`;
  if (duplicateCache.has(dupeKey)) {
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated,
      error: makeError("Cita duplicada (ya importada en esta sesión)"),
    };
  }

  // Also check DB for duplicates
  const { data: existingCitas } = await ctx.supabase
    .from("citas")
    .select("id")
    .eq("profesional_id", prof.id)
    .eq("fecha_cita", inicio.fecha)
    .eq("hora_inicio", inicio.hora)
    .eq("cliente_id", clienteId)
    .contains("servicios", JSON.stringify([{ id: serv.id }]))
    .limit(1);

  if (existingCitas && existingCitas.length > 0) {
    duplicateCache.add(dupeKey);
    return {
      success: false,
      skipped: true,
      warning: false,
      contactoCreated,
      error: makeError("Cita duplicada (ya existe en DB)"),
    };
  }

  // 10. Build & insert
  const precioRaw = getColumnValue(row, "Precio", "precio", "PRECIO", "Price");
  const duracionRaw = getColumnValue(
    row,
    "Duracion (min)",
    "Duración (min)",
    "Duracion",
    "Duración",
    "duracion",
    "DURACION",
  );
  const montoRaw = getColumnValue(row, "Monto", "monto", "MONTO", "Amount");
  const estadoPagoRaw = getColumnValue(
    row,
    "Estado Pago",
    "Estado pago",
    "estado_pago",
    "ESTADO PAGO",
  );
  const tagsRaw = getColumnValue(row, "Tags", "tags", "TAGS");
  const comentarioRaw = getColumnValue(
    row,
    "Comentario",
    "comentario",
    "COMENTARIO",
    "Comment",
  );
  const bookingIdRaw = getColumnValue(
    row,
    "Booking ID",
    "booking_id",
    "BOOKING ID",
    "BookingID",
  );

  const precio = precioRaw ? Number(precioRaw) : (serv.precio ?? 0);
  const duracion = duracionRaw
    ? Number(duracionRaw)
    : (serv.duracion_minutos ?? 0);

  const serviciosData = [
    {
      id: serv.id,
      nombre: serv.nombre,
      precio: isNaN(precio) ? 0 : precio,
      duracion_minutos: isNaN(duracion) ? 0 : duracion,
    },
  ];

  // CONTRACT: generar-atenciones parses this back with `.split(' | ')` and
  // looks for the segment starting with 'Pago:'. Keep the separator and the
  // segment prefixes byte-identical to the web importer.
  const observaciones = [
    comentarioRaw ? String(comentarioRaw).trim() : null,
    "AgendaPro Import",
    bookingIdRaw ? `Booking: ${bookingIdRaw}` : null,
    montoRaw ? `Monto: ${montoRaw}` : null,
    estadoPagoRaw ? `Pago: ${estadoPagoRaw}` : null,
    tagsRaw ? `Tags: ${tagsRaw}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // NOTE: fecha_cita / hora_inicio stay NAIVE and are qualified by the
  // zona_horaria column. Do not run them through toChileTimestamptz.
  const citaRecord: Record<string, any> = {
    cliente_id: clienteId,
    profesional_id: prof.id,
    organizacion_id: ctx.organizacionId,
    fecha_cita: inicio.fecha,
    hora_inicio: inicio.hora,
    hora_fin: horaFin,
    zona_horaria: "America/Santiago",
    servicios: serviciosData,
    observaciones,
    estado,
    metodo_agendamiento: "importacion",
    sucursal_id: sucursalId,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error: insertErr } = await ctx.supabase
      .from("citas")
      .insert(citaRecord as any);

    if (!insertErr) {
      duplicateCache.add(dupeKey);
      if (warningMsg) {
        return {
          success: true,
          skipped: false,
          warning: true,
          contactoCreated,
          clienteInfo,
          error: makeError(warningMsg, "warning"),
        };
      }
      return {
        success: true,
        skipped: false,
        warning: false,
        contactoCreated,
        clienteInfo,
      };
    }

    if (attempt === MAX_RETRIES - 1) {
      return {
        success: false,
        skipped: false,
        warning: false,
        contactoCreated,
        error: makeError(`Error insertando cita: ${insertErr.message}`),
      };
    }
    await sleep(100 * (attempt + 1));
  }

  return {
    success: false,
    skipped: false,
    warning: false,
    contactoCreated: false,
  };
}
