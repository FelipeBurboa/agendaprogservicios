import { loginAndGetToken, checkTokenExpiry } from "./auth.js";
import { fetchLocations, fetchAllBookings, sleep } from "./api.js";
import { addMonths, fmtDate, dailyChunks } from "./dates.js";
import type { BookingParams, Location, ScrapedBookings } from "./types.js";

/** Authenticate and return the list of locations. */
export async function scrapeLocations(
  email: string,
  password: string
): Promise<{ token: string; locations: Location[] }> {
  console.log("Launching browser for login...");
  const token = await loginAndGetToken(email, password);
  const remaining = checkTokenExpiry(token);
  if (remaining !== undefined) {
    if (remaining < 3600) {
      console.log(
        `WARNING: Token expires in ${Math.floor(remaining / 60)} minutes.`
      );
    } else {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      console.log(`  Token valid for ${h}h ${m}m`);
    }
  }
  const locations = await fetchLocations(token);
  return { token, locations };
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
    const seenBlocked = new Set<string | number>();

    for (const day of days) {
      requestNum++;
      console.log(
        `  [${requestNum}/${totalRequests}] ${loc.label}: ${day}`
      );
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
            const evId = ev.id;
            if (seenBlocked.has(evId)) continue;
            seenBlocked.add(evId);
            blockedRows.push({
              "Event ID": evId,
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
