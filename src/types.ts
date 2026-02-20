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

// ─── Scraper params / results ────────────────────────────────────────────────

export interface BookingParams {
  email: string;
  password: string;
  months: number;
}

export interface ScrapedBookings {
  locations: Location[];
  reserved: Map<number, Record<string, unknown>[]>;
  blocked: Map<number, Record<string, unknown>[]>;
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
