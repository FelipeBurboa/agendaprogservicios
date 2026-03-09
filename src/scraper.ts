import { loginAndGetToken, checkTokenExpiry } from "./auth.js";
import {
  fetchLocations,
  fetchAllBookings,
  fetchServiceCategories,
  sleep,
} from "./api.js";
import { addMonths, fmtDate, dailyChunks } from "./dates.js";
import type {
  BookingParams,
  Credentials,
  Location,
  ScrapedBookings,
  ServiceExportRow,
} from "./types.js";

function logTokenStatus(token: string): void {
  const remaining = checkTokenExpiry(token);
  if (remaining === undefined) {
    return;
  }

  if (remaining < 3600) {
    console.log(`WARNING: Token expires in ${Math.floor(remaining / 60)} minutes.`);
    return;
  }

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  console.log(`  Token valid for ${h}h ${m}m`);
}

export async function authenticateAgendaPro(
  credentials: Credentials
): Promise<string> {
  console.log("Launching browser for login...");
  const token = await loginAndGetToken(credentials.email, credentials.password);
  logTokenStatus(token);
  return token;
}

/** Authenticate and return the list of locations. */
export async function scrapeLocations(
  email: string,
  password: string
): Promise<{ token: string; locations: Location[] }> {
  const token = await authenticateAgendaPro({ email, password });
  const locations = await fetchLocations(token);
  return { token, locations };
}

function roundCurrency(value: number | null | undefined): number {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.round(numericValue * 100) / 100;
}

function mapServiceRow(
  service: {
    name: string;
    description: string;
    duration: number;
    active: boolean;
    price: number;
  },
  tag: string
): ServiceExportRow {
  const duration = Number(service.duration ?? 0);
  return {
    nombre: service.name ?? "",
    descripcion: service.description ?? "",
    precio: roundCurrency(service.price),
    duracion_minutos: duration,
    duracion_paciente: duration,
    activo: Boolean(service.active),
    tag,
  };
}

export async function scrapeServices(
  credentials: Credentials
): Promise<ServiceExportRow[]> {
  const token = await authenticateAgendaPro(credentials);
  const categories = await fetchServiceCategories(token);
  const rowsByServiceId = new Map<number, ServiceExportRow>();

  for (const category of categories) {
    const services = category.services ?? [];
    if (services.length === 0) {
      continue;
    }

    for (const service of services) {
      if (rowsByServiceId.has(service.id)) {
        continue;
      }
      rowsByServiceId.set(service.id, mapServiceRow(service, category.name ?? ""));
    }
  }

  const rows = [...rowsByServiceId.values()].sort(
    (left, right) =>
      left.tag.localeCompare(right.tag) ||
      left.nombre.localeCompare(right.nombre)
  );

  console.log(`  Flattened ${rows.length} unique services`);
  return rows;
}

/** Full scraping pipeline: login, fetch locations, fetch all bookings. */
export async function scrapeBookings(
  params: BookingParams
): Promise<ScrapedBookings> {
  const { token, locations } = await scrapeLocations(
    params.email,
    params.password
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = addMonths(today, params.months);
  const days = [...dailyChunks(today, rangeEnd)];

  const totalRequests = locations.length * days.length;
  let requestNum = 0;

  console.log(
    `\nFetching bookings from ${fmtDate(today)} to ${fmtDate(rangeEnd)} (${days.length} days x ${locations.length} locations = ${totalRequests} requests)\n`
  );

  const allReserved: Map<number, Record<string, unknown>[]> = new Map();
  const allBlocked: Map<number, Record<string, unknown>[]> = new Map();

  for (const loc of locations) {
    const reservedRows: Record<string, unknown>[] = [];
    const blockedRows: Record<string, unknown>[] = [];
    const seenReserved = new Set<string | number>();
    const seenBlocked = new Set<string>();

    for (const day of days) {
      requestNum++;
      console.log(`  [${requestNum}/${totalRequests}] ${loc.label}: ${day}`);
      const data = await fetchAllBookings(token, loc.value, day, day);

      for (const user of data.calendar_users_events) {
        const profName = `${user.first_name} ${user.last_name}`;
        for (const ev of user.events) {
          if (
            ev.type === "RESERVED" ||
            ev.type === "CONFIRMED" ||
            ev.type === "ATTENDED" ||
            ev.type === "WAITLISTED"
          ) {
            const b = ev.booking;
            const evId = b?.id ?? ev.id;
            if (seenReserved.has(evId)) continue;
            seenReserved.add(evId);
            const client = b?.client;
            const service = b?.service;
            reservedRows.push({
              "Booking ID": evId,
              Profesional: profName,
              Servicio: service?.name ?? ev.title ?? "",
              Inicio: ev.start,
              Fin: ev.end,
              "Duracion (min)": service?.duration ?? "",
              Cliente: client
                ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                : "",
              Email: client?.email ?? "",
              Telefono: client?.phone ?? "",
              Precio: b?.price ?? "",
              Monto: b?.amount ?? "",
              "Estado Pago": b?.payment_status ?? "",
              "Cliente Nuevo": client?.is_new_client ? "Si" : "No",
              Tags: b?.tags?.join(", ") ?? "",
              Comentario: b?.comment ?? "",
              Estado: ev.type,
            });
          } else {
            const dedupKey = `${ev.id}::${ev.start}`;
            if (seenBlocked.has(dedupKey)) continue;
            seenBlocked.add(dedupKey);
            blockedRows.push({
              "Event ID": ev.id,
              Profesional: profName,
              Tipo: ev.type,
              Titulo: ev.title ?? "",
              Descripcion: ev.description ?? "",
              Inicio: ev.start,
              Fin: ev.end,
            });
          }
        }
      }
      await sleep(300);
    }

    reservedRows.sort((a, b) =>
      String(a["Inicio"]).localeCompare(String(b["Inicio"]))
    );
    blockedRows.sort((a, b) =>
      String(a["Inicio"]).localeCompare(String(b["Inicio"]))
    );

    allReserved.set(loc.value, reservedRows);
    allBlocked.set(loc.value, blockedRows);

    console.log(
      `    => Reserved: ${reservedRows.length} | Blocked/Breaks: ${blockedRows.length}\n`
    );
  }

  return { locations, reserved: allReserved, blocked: allBlocked };
}
