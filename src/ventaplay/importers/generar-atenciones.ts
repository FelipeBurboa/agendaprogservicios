import { sleep } from "../import-utils.js";
import {
  MAX_RETRIES,
  ProgressTracker,
  throwIfAborted,
  type ImportContext,
  type ImportResult,
} from "../types.js";

/**
 * Port of ventaplaymrm/src/hooks/import/useBulkGenerarAtenciones.ts.
 *
 * No file input: this reads `citas` already imported by the citas importer and
 * back-fills `atenciones` + `consumos` for the ones marked `completada`.
 *
 * Batch size here is 100, not the shared BATCH_SIZE of 500 — each cita costs
 * two round-trips (atencion insert + consumos insert).
 */

// ─── Constants ───────────────────────────────────────────────────────────────
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CitaRow {
  id: string;
  cliente_id: string;
  profesional_id: string;
  organizacion_id: string;
  fecha_cita: string;
  hora_inicio: string;
  hora_fin: string | null;
  servicios: any[];
  observaciones: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extrae el estado de pago del campo observaciones generado por el importador de citas.
 * Formato: "Comentario | AgendaPro Import | Booking: XXX | Monto: 5000 | Pago: PAID | ..."
 */
function mapearEstadoPago(observaciones: string | null): string {
  if (!observaciones) return "por_pagar";
  const pagoMatch = observaciones
    .split(" | ")
    .find((s) => s.startsWith("Pago:"));
  const pagoStr = pagoMatch?.replace("Pago: ", "").trim().toUpperCase() ?? "";
  const pagadoStates = ["PAID", "COMPLETED", "PAGADO", "COBRADO"];
  return pagadoStates.includes(pagoStr) ? "pagado" : "por_pagar";
}

/**
 * Construye un timestamp ISO combinando fecha (YYYY-MM-DD) y hora (HH:MM:SS).
 */
function buildTimestamp(fecha: string, hora: string): string {
  return `${fecha}T${hora}`;
}

/**
 * Calcula hora_fin sumando la duración total de servicios a hora_inicio.
 * Fallback cuando la cita no tiene hora_fin.
 */
function calcularHoraFin(horaInicio: string, servicios: any[]): string {
  const duracionTotal = servicios.reduce(
    (sum, s) => sum + (typeof s === "object" ? s.duracion_minutos || 60 : 60),
    0,
  );
  const [h, m, s] = horaInicio.split(":").map(Number);
  const totalMinutos = h * 60 + m + duracionTotal;
  const hf = Math.floor(totalMinutos / 60) % 24;
  const mf = totalMinutos % 60;
  return `${String(hf).padStart(2, "0")}:${String(mf).padStart(2, "0")}:${String(s || 0).padStart(2, "0")}`;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(100 * attempt);
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Loads every `completada` cita in [fechaInicio, fechaFin], paginating 1000 at
 * a time to get past the PostgREST row cap.
 */
async function loadCitasCompletadas(
  ctx: ImportContext,
  fechaInicio: string,
  fechaFin: string,
  columns: string,
): Promise<any[]> {
  const todasLasCitas: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await ctx.supabase
      .from("citas")
      .select(columns)
      .eq("organizacion_id", ctx.organizacionId)
      .eq("estado", "completada")
      .gte("fecha_cita", fechaInicio)
      .lte("fecha_cita", fechaFin)
      .order("fecha_cita", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    data.forEach((c) => todasLasCitas.push(c));
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return todasLasCitas;
}

/**
 * Cita ids that already have an atención. Queried in chunks of 500 so the
 * generated `in.(...)` filter never blows up the request URL.
 */
async function loadExistingAtencionCitaIds(
  ctx: ImportContext,
  citaIds: string[],
): Promise<Set<string>> {
  const existingSet = new Set<string>();
  for (let i = 0; i < citaIds.length; i += 500) {
    const batch = citaIds.slice(i, i + 500);
    const { data: existing } = await ctx.supabase
      .from("atenciones")
      .select("cita_id")
      .in("cita_id", batch)
      .not("cita_id", "is", null);
    existing?.forEach((a: any) => {
      if (a.cita_id) existingSet.add(a.cita_id);
    });
  }
  return existingSet;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Devuelve el número de citas elegibles (completadas, antes del corte, sin atencion).
 */
export async function previewAtenciones(
  ctx: ImportContext,
  fechaInicio: string,
  fechaFin: string,
): Promise<number> {
  // 1. Obtener IDs de citas completadas en el rango (paginado, 1000 por página)
  const rows = await loadCitasCompletadas(ctx, fechaInicio, fechaFin, "id");
  const citaIds: string[] = rows.map((c) => c.id);

  if (!citaIds.length) {
    return 0;
  }

  throwIfAborted(ctx.signal);

  // 2. Obtener cita_ids que ya tienen atención (en batches para evitar URLs largas)
  const existingSet = await loadExistingAtencionCitaIds(ctx, citaIds);

  return citaIds.filter((id) => !existingSet.has(id)).length;
}

// ─── Ejecutar ────────────────────────────────────────────────────────────────

export async function generarAtenciones(
  ctx: ImportContext,
  fechaInicio: string,
  fechaFin: string,
): Promise<ImportResult> {
  const tracker = new ProgressTracker("atenciones", ctx.onProgress);

  tracker.patch(
    { status: "importing", message: "Buscando citas completadas..." },
    true,
  );

  // 1. Cargar citas elegibles (paginado para evitar límite de 1000 filas)
  const todasLasCitas = await loadCitasCompletadas(
    ctx,
    fechaInicio,
    fechaFin,
    "id, cliente_id, profesional_id, organizacion_id, fecha_cita, hora_inicio, hora_fin, servicios, observaciones",
  );

  if (!todasLasCitas.length) {
    tracker.patch({ total: 0, message: "No hay citas completadas en el rango" });
    return tracker.toResult();
  }

  throwIfAborted(ctx.signal);

  // 2. Filtrar las que ya tienen atención
  const allIds = todasLasCitas.map((c) => c.id);
  const existingSet = await loadExistingAtencionCitaIds(ctx, allIds);

  const citasSinAtencion: CitaRow[] = todasLasCitas
    .filter((c) => !existingSet.has(c.id))
    .map((c) => ({
      ...c,
      servicios: Array.isArray(c.servicios) ? c.servicios : [],
    }));

  let omitidas = todasLasCitas.length - citasSinAtencion.length;
  const totalBatches = Math.ceil(citasSinAtencion.length / BATCH_SIZE);

  tracker.patch(
    {
      total: citasSinAtencion.length,
      skipped: omitidas,
      totalBatches,
      status: "importing",
      message: "Generando atenciones...",
    },
    true,
  );

  if (citasSinAtencion.length === 0) {
    return tracker.toResult();
  }

  // 3. Procesar en batches
  let successful = 0;
  let errorCount = 0;
  let processedCount = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    throwIfAborted(ctx.signal);

    const batch = citasSinAtencion.slice(
      batchIdx * BATCH_SIZE,
      (batchIdx + 1) * BATCH_SIZE,
    );
    tracker.patch({ currentBatch: batchIdx + 1 });

    for (const cita of batch) {
      throwIfAborted(ctx.signal);

      try {
        const resultado = await withRetry(() => procesarCita(ctx, cita));
        if (resultado === "skipped") {
          omitidas++;
        } else {
          successful++;
        }
      } catch (err: any) {
        errorCount++;
        const servicioNombre = cita.servicios[0]?.nombre ?? "sin servicio";
        tracker.addError({
          row: processedCount + 1,
          error: err?.message ?? String(err),
          data: [cita.id, cita.fecha_cita, servicioNombre].join(" | "),
        });
      }

      processedCount++;
      tracker.patch({
        processed: processedCount,
        successful,
        skipped: omitidas,
      });
    }

    if (batchIdx < totalBatches - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return tracker.toResult();
}

// ─── Procesar cita individual ────────────────────────────────────────────────

async function procesarCita(
  ctx: ImportContext,
  cita: CitaRow,
): Promise<"created" | "skipped"> {
  const horaFin =
    cita.hora_fin ?? calcularHoraFin(cita.hora_inicio, cita.servicios);
  const estadoPago = mapearEstadoPago(cita.observaciones);

  // 1. Insertar atención
  const { data: atencion, error: atencionErr } = await ctx.supabase
    .from("atenciones")
    .insert({
      cliente_id: cita.cliente_id,
      profesional_id: cita.profesional_id,
      organizacion_id: cita.organizacion_id,
      cita_id: cita.id,
      estado: "finalizada",
      estado_pago: estadoPago,
      fecha_inicio: buildTimestamp(cita.fecha_cita, cita.hora_inicio),
      fecha_fin: buildTimestamp(cita.fecha_cita, horaFin),
      notas_atencion: "Generado retroactivamente desde importación AgendaPro",
    })
    .select("id")
    .single();

  // Duplicado: la atención ya existe (corrida previa) — tratar como omitida
  if (
    atencionErr?.code === "23505" ||
    atencionErr?.message?.includes("idx_atenciones_cita_id_unique")
  ) {
    return "skipped";
  }
  if (atencionErr)
    throw new Error(`Error al crear atención: ${atencionErr.message}`);
  if (!atencion?.id) throw new Error("No se recibió ID de la atención creada");

  // 2. Insertar consumos (uno por servicio)
  if (cita.servicios.length > 0) {
    const consumos = cita.servicios
      .filter((s: any) => typeof s === "object" && s?.id)
      .map((s: any) => ({
        atencion_id: atencion.id,
        servicio_id: s.id,
        profesional_id: cita.profesional_id,
        precio_original: Number(s.precio) || 0,
        precio_final: Number(s.precio) || 0,
        cantidad: 1,
        notas_consumo: "Pre-cargado en generación retroactiva",
      }));

    if (consumos.length > 0) {
      const { error: consumosErr } = await ctx.supabase
        .from("consumos")
        .insert(consumos);
      if (consumosErr) {
        // Rollback: eliminar la atención si falla la inserción de consumos
        await ctx.supabase.from("atenciones").delete().eq("id", atencion.id);
        throw new Error(`Error al crear consumos: ${consumosErr.message}`);
      }
    }
  }
  return "created";
}
