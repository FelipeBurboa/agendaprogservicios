import type ExcelJS from "exceljs";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Context passed to an MFA-code callback. `resend` triggers a fresh sign_in so
 * AgendaPro emails a new code and rotates the session.
 */
export interface MfaCodeRequest {
  attempt: number;
  previousError?: string;
  resend: () => Promise<void>;
}

export type MfaCodeCallback = (request: MfaCodeRequest) => Promise<string>;

/**
 * Optional auth behavior threaded through the scrape entry points. When MFA is
 * required and `onMfaCodeRequest` is provided, login becomes interactive;
 * otherwise login throws MfaRequiredError carrying the session.
 */
export interface AuthOptions {
  onMfaCodeRequest?: MfaCodeCallback;
  maxMfaAttempts?: number;
}

// ─── API responses ───────────────────────────────────────────────────────────

export interface Location {
  label: string;
  value: number;
}

export interface LocationsResponse {
  locations: Location[];
  page: number;
  total_pages: number;
  total_filtered: number;
  per_page: number;
}

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  identification_number: string;
  is_new_client: boolean;
}

export interface Service {
  name: string;
  id: number;
  list_price: number;
  duration: number;
}

export interface Booking {
  id: number;
  status_id: number;
  client: Client;
  professional: { value: number; label: string };
  comment: string;
  payment_status: string;
  amount: number;
  price: number;
  tags: string[];
  service: Service;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: "RESERVED" | "BLOCKED" | "BREAK" | string;
  description?: string;
  booking?: Booking;
}

export interface CalendarUser {
  id: number;
  first_name: string;
  last_name: string;
  events: CalendarEvent[];
}

export interface BookingsResponse {
  calendar_users_events: CalendarUser[];
  page: number;
  total_pages: number;
  total_filtered: number;
  per_page: number;
}

export interface AgendaProCatalogService {
  id: number;
  name: string;
  description: string;
  duration: number;
  active: boolean;
  price: number;
}

export interface AgendaProServiceCategory {
  id: number;
  name: string;
  services?: AgendaProCatalogService[];
}

export interface AgendaProAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface AgendaProLocationAttachment {
  id: number;
  image?: string | null;
}

export interface AgendaProLocationDetail {
  id: number;
  name: string;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  address?: AgendaProAddressComponent[] | null;
  detailed_address?: string | null;
  second_address?: string | null;
  location_attachments?: AgendaProLocationAttachment[];
}

export interface AgendaProProviderAttachment {
  id: number;
  image?: string | null;
  thumb_image?: string | null;
}

export interface AgendaProServiceProvider {
  id: number;
  location_id: number | null;
  public_name: string;
  active: boolean;
  order: number;
  service_provider_attachments?: AgendaProProviderAttachment[];
}

export interface ProductNamedRef {
  id: number;
  name: string;
}

export interface ProductLocationStock {
  id?: number;
  product_id?: number;
  location_id: number;
  stock: number;
}

/** Shape of one product in /products/inventory (admin v1). */
export interface ProductInventoryItem {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  cost: number;
  internal_price: number;
  active: boolean;
  stock_total: number;
  stock_limit: number | null;
  product_category?: ProductNamedRef | null;
  product_brand?: ProductNamedRef | null;
  product_display?: ProductNamedRef | null;
  location_products_attributes?: ProductLocationStock[];
}

export interface ProductInventoryResponse {
  products: ProductInventoryItem[];
  total_products: number;
  total_pages: number;
  page: number;
  per_page: number;
}

// ─── Scraper params / results ────────────────────────────────────────────────

export interface BookingParams {
  email: string;
  password: string;
  months: number;
  past_months?: number;
}

export interface ScrapedBookings {
  locations: Location[];
  reserved: Map<number, Record<string, unknown>[]>;
  blocked: Map<number, Record<string, unknown>[]>;
}

export interface ServiceExportRow {
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
  duracion_paciente: number;
  activo: boolean;
  tag: string;
}

export interface ProfessionalExportRow {
  agenda_pro_provider_id: number;
  agenda_pro_location_id: number | null;
  nombre: string;
  activo: boolean;
  orden: number;
  foto_url: string;
  sucursal: string;
}

export interface SucursalExportRow {
  agenda_pro_location_id: number;
  nombre: string;
  direccion: string;
  telefono: string;
  telefono_secundario: string;
  email: string;
  activo: boolean;
  lat: number | null;
  lng: number | null;
  foto_url: string;
}

export interface ProfessionalSheet {
  sheetName: string;
  rows: ProfessionalExportRow[];
}

export interface ScrapedProfessionals {
  professionals: ProfessionalExportRow[];
  sucursales: SucursalExportRow[];
  sheets: ProfessionalSheet[];
  hasMultipleSucursales: boolean;
}

/**
 * A product row keyed by its VentaPlay-import header strings (incl. dynamic
 * `Stock {sucursal}` columns), so it drops straight into `writeSheet`.
 */
export type ProductExportRow = Record<string, string | number>;

export interface ScrapedProducts {
  rows: ProductExportRow[];
  locationNames: string[];
}

// ─── Comisiones ──────────────────────────────────────────────────────────────

export interface AgendaProCommissionProvider {
  id: number;
  company_id: number;
  public_name: string;
  service_count: number;
}

export interface AgendaProServiceCommission {
  id: number;
  service_id: number;
  service_name: string;
  provider_id: number;
  provider_name: string;
  amount: number;
  is_percent: boolean;
}

export interface AgendaProProductCommission {
  id: number;
  company_id: number;
  name: string;
  commission_value: string;
  commission_option: number;
}

/** VentaPlay's `comisiones_json` commission kinds. */
export type ComisionTipo = "porcentaje" | "monto_fijo";

export interface ComisionServicioExportRow {
  Profesional: string;
  Servicio: string;
  Tipo: ComisionTipo;
  Valor: number;
}

export interface ComisionProductoExportRow {
  Producto: string;
  Tipo: ComisionTipo;
  Valor: number;
}

export interface ScrapedComisiones {
  servicios: ComisionServicioExportRow[];
  productos: ComisionProductoExportRow[];
}

// ─── Excel constants ─────────────────────────────────────────────────────────

export const RESERVED_HEADERS = [
  "Booking ID",
  "Profesional",
  "Servicio",
  "Inicio",
  "Fin",
  "Duracion (min)",
  "Cliente",
  "Email",
  "Telefono",
  "Precio",
  "Monto",
  "Estado Pago",
  "Cliente Nuevo",
  "Tags",
  "Comentario",
  "Estado",
];

export const BLOCKED_HEADERS = [
  "Event ID",
  "Profesional",
  "Tipo",
  "Titulo",
  "Descripcion",
  "Inicio",
  "Fin",
];

export const SERVICE_EXPORT_HEADERS = [
  "nombre",
  "descripcion",
  "precio",
  "duracion_minutos",
  "duracion_paciente",
  "activo",
  "tag",
] as const;

export const PROFESSIONAL_EXPORT_HEADERS = [
  "agenda_pro_provider_id",
  "agenda_pro_location_id",
  "nombre",
  "activo",
  "orden",
  "foto_url",
  "sucursal",
] as const;

export const SUCURSAL_EXPORT_HEADERS = [
  "agenda_pro_location_id",
  "nombre",
  "direccion",
  "telefono",
  "telefono_secundario",
  "email",
  "activo",
  "lat",
  "lng",
  "foto_url",
] as const;

/**
 * Fixed columns of the products export. Matches VentaPlay's "externo" inventory
 * format (`parsearExcelExterno`): the format is detected by the presence of
 * `Marca` + `Categoría`, and accents/casing must match exactly. Per-sucursal
 * stock is appended as dynamic `Stock {sucursal}` columns by `buildProductHeaders`.
 */
export const PRODUCT_EXPORT_BASE_HEADERS = [
  "SKU",
  "Categoría",
  "Marca",
  "Nombre",
  "Descripción",
  "Unidad",
  "Costo",
  "Precio venta externa",
  "Precio venta interna",
] as const;

/**
 * Comisiones export columns. Rows are name-keyed, not id-keyed: AgendaPro ids
 * mean nothing in VentaPlay, so the importer resolves `Servicio`/`Producto`
 * names to UUIDs when building `profesionales.comisiones_json`.
 */
export const COMISION_SERVICIO_EXPORT_HEADERS = [
  "Profesional",
  "Servicio",
  "Tipo",
  "Valor",
] as const;

export const COMISION_PRODUCTO_EXPORT_HEADERS = [
  "Producto",
  "Tipo",
  "Valor",
] as const;

export function buildProductHeaders(locationNames: string[]): string[] {
  return [
    ...PRODUCT_EXPORT_BASE_HEADERS,
    ...locationNames.map((name) => `Stock ${name}`),
  ];
}

export const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

export const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2F5496" },
};

export const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
  wrapText: true,
};

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
  left: { style: "thin", color: { argb: "FFD9D9D9" } },
  right: { style: "thin", color: { argb: "FFD9D9D9" } },
};

export const ALT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD6E4F0" },
};


