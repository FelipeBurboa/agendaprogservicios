import type ExcelJS from "exceljs";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

export interface AuthState {
  cookies: Cookie[];
}

export interface Credentials {
  email: string;
  password: string;
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


