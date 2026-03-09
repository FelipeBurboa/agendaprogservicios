import { loginAndGetToken, checkTokenExpiry } from "./auth.js";
import {
  RequestAbortedError,
  fetchAdminLocations,
  fetchAllBookings,
  fetchLocations,
  fetchServiceCategories,
  fetchServiceProviders,
  sleep,
} from "./api.js";
import { addMonths, fmtDate, dailyChunks } from "./dates.js";
import type {
  AgendaProAddressComponent,
  AgendaProLocationDetail,
  AgendaProLocationAttachment,
  AgendaProProviderAttachment,
  AgendaProServiceProvider,
  BookingParams,
  Credentials,
  Location,
  ProfessionalExportRow,
  ProfessionalSheet,
  ScrapedBookings,
  ScrapedProfessionals,
  ServiceExportRow,
  SucursalExportRow,
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

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstImageUrl(
  attachments?: Array<AgendaProLocationAttachment | AgendaProProviderAttachment>
): string {
  const image = attachments?.find((attachment) => normalizeText(attachment.image) !== "")?.image;
  return normalizeText(image);
}

function getAddressComponent(
  components: AgendaProAddressComponent[] | null | undefined,
  type: string
): string {
  return normalizeText(
    components?.find((component) => component.types.includes(type))?.long_name
  );
}

function formatStructuredAddress(
  components: AgendaProAddressComponent[] | null | undefined
): string {
  if (!components || components.length === 0) {
    return "";
  }

  const route = getAddressComponent(components, "route");
  const streetNumber = getAddressComponent(components, "street_number");
  const postalCode = getAddressComponent(components, "postal_code");
  const locality =
    getAddressComponent(components, "locality") ||
    getAddressComponent(components, "administrative_area_level_3") ||
    getAddressComponent(components, "administrative_area_level_2");
  const region = getAddressComponent(components, "administrative_area_level_1");
  const country = getAddressComponent(components, "country");

  const firstLine = [route, streetNumber].filter(Boolean).join(" ").trim();
  const cityLine = [postalCode, locality].filter(Boolean).join(" ").trim();
  const parts = [firstLine, cityLine, region, country].filter(Boolean);

  return parts.filter((part, index) => parts.indexOf(part) === index).join(", ");
}

function formatLocationAddress(location: AgendaProLocationDetail): string {
  const structuredAddress = formatStructuredAddress(location.address);
  if (structuredAddress !== "") {
    return structuredAddress;
  }

  return [
    normalizeText(location.second_address),
    normalizeText(location.detailed_address),
  ]
    .filter(Boolean)
    .join(", ");
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
    nombre: normalizeText(service.name),
    descripcion: normalizeText(service.description),
    precio: roundCurrency(service.price),
    duracion_minutos: duration,
    duracion_paciente: duration,
    activo: Boolean(service.active),
    tag: normalizeText(tag),
  };
}

function mapProfessionalRow(
  provider: AgendaProServiceProvider,
  locationName: string
): ProfessionalExportRow {
  return {
    agenda_pro_provider_id: provider.id,
    agenda_pro_location_id: provider.location_id ?? null,
    nombre: normalizeText(provider.public_name),
    activo: Boolean(provider.active),
    orden: Number.isFinite(Number(provider.order)) ? Number(provider.order) : 0,
    foto_url: firstImageUrl(provider.service_provider_attachments),
    sucursal: normalizeText(locationName),
  };
}

function mapSucursalRow(location: AgendaProLocationDetail): SucursalExportRow {
  return {
    agenda_pro_location_id: location.id,
    nombre: normalizeText(location.name),
    direccion: formatLocationAddress(location),
    telefono: normalizeText(location.phone),
    telefono_secundario: normalizeText(location.secondary_phone),
    email: normalizeText(location.email),
    activo: Boolean(location.active),
    lat: location.latitude ?? null,
    lng: location.longitude ?? null,
    foto_url: firstImageUrl(location.location_attachments),
  };
}

function sortByOrderThenName(
  left: Pick<ProfessionalExportRow, "orden" | "nombre">,
  right: Pick<ProfessionalExportRow, "orden" | "nombre">
): number {
  return left.orden - right.orden || left.nombre.localeCompare(right.nombre);
}

function buildProfessionalSheets(
  professionals: ProfessionalExportRow[],
  referencedLocationIds: number[],
  matchedLocations: AgendaProLocationDetail[],
  hasMultipleSucursales: boolean
): ProfessionalSheet[] {
  if (!hasMultipleSucursales) {
    return [
      {
        sheetName: "profesionales",
        rows: [...professionals].sort(sortByOrderThenName),
      },
    ];
  }

  const locationNameById = new Map(matchedLocations.map((location) => [location.id, normalizeText(location.name)]));
  const orderedIds = [
    ...matchedLocations.map((location) => location.id),
    ...referencedLocationIds.filter((locationId) => !locationNameById.has(locationId)),
  ];

  const sheets = orderedIds.map((locationId) => {
    const rows = professionals
      .filter((professional) => professional.agenda_pro_location_id === locationId)
      .sort(sortByOrderThenName);

    return {
      sheetName: locationNameById.get(locationId) || `Sin sucursal ${locationId}`,
      rows,
    };
  });

  const unassignedRows = professionals
    .filter((professional) => professional.agenda_pro_location_id === null)
    .sort(sortByOrderThenName);

  if (unassignedRows.length > 0) {
    sheets.push({
      sheetName: "Sin sucursal",
      rows: unassignedRows,
    });
  }

  return sheets;
}

export interface BookingsDateRange {
  rangeStart: Date;
  rangeEnd: Date;
  days: string[];
}

export interface BookingsScrapeContext extends BookingsDateRange {
  token: string;
  locations: Location[];
}

export interface BookingsScrapeOptions {
  signal?: AbortSignal;
  shouldAbort?: () => boolean;
}

function throwIfScrapeAborted(options: BookingsScrapeOptions = {}): void {
  if (options.signal?.aborted || options.shouldAbort?.()) {
    throw new RequestAbortedError();
  }
}

export function buildBookingDateRange(
  params: Pick<BookingParams, "months" | "past_months">
): BookingsDateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rangeStart = params.past_months
    ? addMonths(today, -params.past_months)
    : today;
  const rangeEnd = addMonths(today, params.months);
  const days = [...dailyChunks(rangeStart, rangeEnd)];

  return { rangeStart, rangeEnd, days };
}

export async function prepareBookingsScrape(
  params: BookingParams,
  options: BookingsScrapeOptions = {}
): Promise<BookingsScrapeContext> {
  throwIfScrapeAborted(options);
  const token = await authenticateAgendaPro({
    email: params.email,
    password: params.password,
  });
  throwIfScrapeAborted(options);

  const locations = await fetchLocations(token, options.signal);
  throwIfScrapeAborted(options);

  return {
    token,
    locations,
    ...buildBookingDateRange(params),
  };
}

export async function authenticateAgendaPro(
  credentials: Credentials
): Promise<string> {
  console.log("Launching browser for login...");
  const token = await loginAndGetToken(credentials.email, credentials.password);
  logTokenStatus(token);
  return token;
}

export async function scrapeLocations(
  email: string,
  password: string
): Promise<{ token: string; locations: Location[] }> {
  const token = await authenticateAgendaPro({ email, password });
  const locations = await fetchLocations(token);
  return { token, locations };
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

export async function scrapeProfessionals(
  credentials: Credentials
): Promise<ScrapedProfessionals> {
  const token = await authenticateAgendaPro(credentials);
  const [locations, providers] = await Promise.all([
    fetchAdminLocations(token),
    fetchServiceProviders(token),
  ]);

  const referencedLocationIds = [
    ...new Set(
      providers
        .map((provider) => provider.location_id)
        .filter((locationId): locationId is number => typeof locationId === "number")
    ),
  ];
  const referencedLocationIdSet = new Set(referencedLocationIds);
  const matchedLocations = locations.filter((location) => referencedLocationIdSet.has(location.id));
  const locationById = new Map(matchedLocations.map((location) => [location.id, location]));
  const locationOrderById = new Map(matchedLocations.map((location, index) => [location.id, index]));

  const professionals = providers
    .map((provider) =>
      mapProfessionalRow(provider, locationById.get(provider.location_id ?? -1)?.name ?? "")
    )
    .sort(
      (left, right) =>
        (locationOrderById.get(left.agenda_pro_location_id ?? -1) ?? Number.MAX_SAFE_INTEGER) -
          (locationOrderById.get(right.agenda_pro_location_id ?? -1) ?? Number.MAX_SAFE_INTEGER) ||
        sortByOrderThenName(left, right)
    );

  const sucursales = matchedLocations.map(mapSucursalRow);
  const hasMultipleSucursales = referencedLocationIds.length > 1;
  const sheets = buildProfessionalSheets(
    professionals,
    referencedLocationIds,
    matchedLocations,
    hasMultipleSucursales
  );

  console.log(
    `  Normalized ${professionals.length} professionals across ${referencedLocationIds.length} referenced sucursales`
  );

  return {
    professionals,
    sucursales,
    sheets,
    hasMultipleSucursales,
  };
}

export async function scrapeBookingsWithContext(
  context: BookingsScrapeContext,
  options: BookingsScrapeOptions = {}
): Promise<ScrapedBookings> {
  const totalRequests = context.locations.length * context.days.length;
  let requestNum = 0;

  console.log(
    `\nFetching bookings from ${fmtDate(context.rangeStart)} to ${fmtDate(context.rangeEnd)} (${context.days.length} days x ${context.locations.length} locations = ${totalRequests} requests)\n`
  );

  const allReserved: Map<number, Record<string, unknown>[]> = new Map();
  const allBlocked: Map<number, Record<string, unknown>[]> = new Map();

  for (const loc of context.locations) {
    throwIfScrapeAborted(options);

    const reservedRows: Record<string, unknown>[] = [];
    const blockedRows: Record<string, unknown>[] = [];
    const seenReserved = new Set<string | number>();
    const seenBlocked = new Set<string>();

    for (const day of context.days) {
      throwIfScrapeAborted(options);

      requestNum++;
      console.log(`  [${requestNum}/${totalRequests}] ${loc.label}: ${day}`);
      const data = await fetchAllBookings(
        context.token,
        loc.value,
        day,
        day,
        options.signal
      );

      throwIfScrapeAborted(options);

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

      await sleep(300, options.signal);
    }

    throwIfScrapeAborted(options);

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

  return {
    locations: context.locations,
    reserved: allReserved,
    blocked: allBlocked,
  };
}

export async function scrapeBookings(
  params: BookingParams,
  options: BookingsScrapeOptions = {}
): Promise<ScrapedBookings> {
  const context = await prepareBookingsScrape(params, options);
  return scrapeBookingsWithContext(context, options);
}
