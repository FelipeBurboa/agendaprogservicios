import { loginAndGetToken, verifyMfaCode, checkTokenExpiry } from "./auth.js";
import { getToken, saveToken } from "./token-store.js";
import {
  RequestAbortedError,
  fetchAdminLocations,
  fetchAllBookings,
  fetchAllProducts,
  fetchCommissionProviders,
  fetchLocations,
  fetchProductCommissions,
  fetchProviderServiceCommissions,
  fetchServiceCategories,
  fetchServiceProviders,
  sleep,
} from "./api.js";
import { addMonths, fmtDate, dailyChunks } from "./dates.js";
import type {
  AgendaProAddressComponent,
  AgendaProLocationDetail,
  AgendaProLocationAttachment,
  AgendaProProductCommission,
  AgendaProProviderAttachment,
  AgendaProServiceCommission,
  AgendaProServiceProvider,
  AuthOptions,
  BookingParams,
  ComisionProductoExportRow,
  ComisionServicioExportRow,
  ComisionTipo,
  Credentials,
  Location,
  ProductExportRow,
  ProductInventoryItem,
  ProfessionalExportRow,
  ProfessionalSheet,
  ScrapedBookings,
  ScrapedComisiones,
  ScrapedProducts,
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

/**
 * Map an AgendaPro inventory product to a VentaPlay "externo" row. Keys MUST
 * match `PRODUCT_EXPORT_BASE_HEADERS` (+ `Stock {sucursal}`) so `writeSheet`
 * picks up the values. Empty SKUs fall back to `AP-{id}` — VentaPlay requires
 * a non-empty unique SKU. Price 0 is preserved (insumo/internal products).
 */
function mapProductRow(
  item: ProductInventoryItem,
  stockByLocationName: Map<string, number>,
  locationNames: string[]
): ProductExportRow {
  const sku = normalizeText(item.sku) || `AP-${item.id}`;
  const row: ProductExportRow = {
    SKU: sku,
    "Categoría": normalizeText(item.product_category?.name),
    Marca: normalizeText(item.product_brand?.name),
    Nombre: normalizeText(item.name),
    "Descripción": normalizeText(item.description),
    Unidad: normalizeText(item.product_display?.name),
    Costo: roundCurrency(item.cost),
    "Precio venta externa": roundCurrency(item.price),
    "Precio venta interna": roundCurrency(item.internal_price),
  };

  for (const name of locationNames) {
    row[`Stock ${name}`] = stockByLocationName.get(name) ?? 0;
  }

  return row;
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

export interface BookingsScrapeOptions extends AuthOptions {
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
  const token = await authenticateAgendaPro(
    {
      email: params.email,
      password: params.password,
    },
    options
  );
  throwIfScrapeAborted(options);

  const locations = await fetchLocations(token, options.signal);
  throwIfScrapeAborted(options);

  return {
    token,
    locations,
    ...buildBookingDateRange(params),
  };
}

function validateToken(token: string): string {
  if (!token || token.split(".").length !== 3) {
    console.error(`  WARNING: Token does not look like a valid JWT (length=${token?.length ?? 0})`);
  }
  logTokenStatus(token);
  return token;
}

export async function authenticateAgendaPro(
  credentials: Credentials,
  options: AuthOptions = {}
): Promise<string> {
  const cached = getToken(credentials.email);
  if (cached) {
    console.log("  Using cached session token");
    return cached;
  }

  console.log("Signing in to AgendaPro...");
  const token = await loginAndGetToken(
    credentials.email,
    credentials.password,
    options
  );
  saveToken(credentials.email, token);
  return validateToken(token);
}

/**
 * Verify an MFA code directly against a session the caller already holds, then
 * cache the resulting token. Used by the stateless server's second-phase call —
 * it must NOT re-run sign_in, which would email a new code and rotate the session.
 */
export async function authenticateWithMfaCode(
  credentials: Credentials,
  code: string,
  session: string
): Promise<string> {
  const token = await verifyMfaCode(
    credentials.email,
    credentials.password,
    code,
    session
  );
  saveToken(credentials.email, token);
  return validateToken(token);
}

export async function scrapeLocations(
  email: string,
  password: string,
  options: AuthOptions = {}
): Promise<{ token: string; locations: Location[] }> {
  const token = await authenticateAgendaPro({ email, password }, options);
  const locations = await fetchLocations(token);
  return { token, locations };
}

export async function scrapeServices(
  credentials: Credentials,
  options: AuthOptions = {}
): Promise<ServiceExportRow[]> {
  const token = await authenticateAgendaPro(credentials, options);
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
  credentials: Credentials,
  options: AuthOptions = {}
): Promise<ScrapedProfessionals> {
  const token = await authenticateAgendaPro(credentials, options);
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

export async function scrapeProducts(
  credentials: Credentials,
  options: AuthOptions = {}
): Promise<ScrapedProducts> {
  const token = await authenticateAgendaPro(credentials, options);
  const locations = await fetchAdminLocations(token);
  const usableLocations = locations.filter((location) => normalizeText(location.name) !== "");
  const locationNames = usableLocations.map((location) => normalizeText(location.name));

  interface ProductAggregate {
    item: ProductInventoryItem;
    stockByLocationName: Map<string, number>;
  }
  const aggregatesById = new Map<number, ProductAggregate>();

  for (let index = 0; index < usableLocations.length; index++) {
    const location = usableLocations[index];
    const locationName = normalizeText(location.name);
    console.log(
      `  [${index + 1}/${usableLocations.length}] Fetching inventory: ${locationName}`
    );

    const products = await fetchAllProducts(token, location.id, { active: true });

    for (const item of products) {
      let aggregate = aggregatesById.get(item.id);
      if (!aggregate) {
        aggregate = { item, stockByLocationName: new Map() };
        aggregatesById.set(item.id, aggregate);
      }

      const locationStock = (item.location_products_attributes ?? []).reduce(
        (sum, attribute) => sum + (Number(attribute.stock) || 0),
        0
      );
      aggregate.stockByLocationName.set(
        locationName,
        (aggregate.stockByLocationName.get(locationName) ?? 0) + locationStock
      );
    }
  }

  const rows = [...aggregatesById.values()]
    .map((aggregate) =>
      mapProductRow(aggregate.item, aggregate.stockByLocationName, locationNames)
    )
    .sort(
      (left, right) =>
        String(left["Categoría"]).localeCompare(String(right["Categoría"])) ||
        String(left["Nombre"]).localeCompare(String(right["Nombre"]))
    );

  console.log(
    `  Flattened ${rows.length} unique products across ${usableLocations.length} locations`
  );

  return { rows, locationNames };
}

/**
 * AgendaPro flags percentages with a boolean on services and with a numeric
 * option on products; 0 is the only value seen in captures, and it means the
 * same thing `is_percent: true` does.
 */
function commissionTipo(isPercent: boolean): ComisionTipo {
  return isPercent ? "porcentaje" : "monto_fijo";
}

export function mapServiceCommissionRows(
  providerName: string,
  commissions: AgendaProServiceCommission[]
): ComisionServicioExportRow[] {
  // AgendaPro names routinely carry trailing spaces ("Valentina ", "Mario ");
  // the importer matches on name, so trim on the way out.
  const profesional = normalizeText(providerName);
  const rows: ComisionServicioExportRow[] = [];
  for (const commission of commissions) {
    const valor = Number(commission.amount) || 0;
    if (valor === 0) {
      continue;
    }
    rows.push({
      Profesional: profesional,
      Servicio: normalizeText(commission.service_name),
      Tipo: commissionTipo(commission.is_percent),
      Valor: valor,
    });
  }
  return rows;
}

export function mapProductCommissionRows(
  commissions: AgendaProProductCommission[]
): ComisionProductoExportRow[] {
  const rows: ComisionProductoExportRow[] = [];
  for (const commission of commissions) {
    const valor = Number(commission.commission_value) || 0;
    if (valor === 0) {
      continue;
    }
    rows.push({
      Producto: normalizeText(commission.name),
      Tipo: commissionTipo(commission.commission_option === 0),
      Valor: valor,
    });
  }
  return rows;
}

/**
 * Commissions as VentaPlay imports them: flat, name-keyed rows. Services come
 * per (profesional, servicio); product commissions are company-wide, so they
 * carry no profesional. Zero-valued rows are dropped — AgendaPro writes 0 for
 * "not configured", which is already VentaPlay's default.
 */
export async function scrapeComisiones(
  credentials: Credentials,
  options: AuthOptions = {}
): Promise<ScrapedComisiones> {
  const token = await authenticateAgendaPro(credentials, options);
  const providers = await fetchCommissionProviders(token);

  const servicios: ComisionServicioExportRow[] = [];
  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index];
    const providerName = normalizeText(provider.public_name);
    console.log(
      `  [${index + 1}/${providers.length + 1}] Fetching commissions: ${providerName}`
    );

    if (index > 0) {
      await sleep(300);
    }

    const commissions = await fetchProviderServiceCommissions(token, provider.id);
    servicios.push(...mapServiceCommissionRows(providerName, commissions));
  }

  console.log(`  [${providers.length + 1}/${providers.length + 1}] Fetching commissions: productos`);
  const productCommissions = await fetchProductCommissions(token);
  const productos = mapProductCommissionRows(productCommissions);

  servicios.sort(
    (left, right) =>
      left.Profesional.localeCompare(right.Profesional) ||
      left.Servicio.localeCompare(right.Servicio)
  );
  productos.sort((left, right) => left.Producto.localeCompare(right.Producto));

  console.log(
    `  Flattened ${servicios.length} service commissions and ${productos.length} product commissions`
  );

  return { servicios, productos };
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
