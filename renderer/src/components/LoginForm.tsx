import { useEffect, useState, type ReactNode } from "react";
import type { BookingType, ExportType, ScraperParams } from "../types.ts";
import { useEnterAnimation } from "../hooks/useEnterAnimation.ts";

const LOGO_SVG = `<svg width="90" height="56" viewBox="0 0 275 170" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_1004_390)"><path d="M10.4427 149.2L0.472771 127.236C0.13905 126.544 0 125.865 0 125.241C0 123.176 1.61298 121.458 3.75436 121.458C5.22829 121.458 6.6327 122.151 7.50872 124.216C10.3175 130.756 13.5991 138.405 15.4068 143.352H15.4763C17.1449 138.391 20.3709 130.618 23.3744 124.146C24.2504 122.082 25.6548 121.458 27.0592 121.458C29.0059 121.458 30.605 123.176 30.605 125.172C30.605 125.865 30.4659 126.488 30.2017 127.167L20.1623 149.339C18.9526 151.888 17.6177 152.914 15.4068 152.914C13.0568 152.914 11.7219 151.875 10.4566 149.2H10.4427Z" fill="#8C00FF"/><path d="M48.0282 121.042C56.5938 121.042 61.6274 127.583 61.6274 134.677C61.6274 135.855 61.4327 136.742 60.7514 137.574C60.0144 138.474 58.8742 138.682 57.136 138.682H40.2692C41.0757 143.712 44.8162 146.387 49.8498 146.387C51.727 146.387 53.3956 145.902 54.6053 145.5C55.676 145.223 56.2739 145.015 57.0109 145.015C58.749 145.015 60.0283 146.456 60.0283 148.188C60.0283 149.491 59.2913 150.738 57.8174 151.431C55.6065 152.526 52.5891 153.288 49.2519 153.288C39.8799 153.288 32.7744 146.886 32.7744 137.102C32.7744 127.874 39.129 121.056 48.0421 121.056L48.0282 121.042ZM54.8 133.638C54.7305 130.132 52.1163 127.167 47.9031 127.167C44.0236 127.167 41.3399 129.578 40.4778 133.638H54.8139H54.8Z" fill="#8C00FF"/><path d="M67.0083 148.853V125.379C67.0083 123.176 68.6769 121.458 70.8322 121.458C72.9875 121.458 74.6422 123.176 74.6422 125.379V125.795C77.0477 122.83 80.2042 121.042 84.0142 121.042C89.7013 121.042 94.5264 124.964 94.5264 132.128V148.853C94.5264 151.057 92.7882 152.914 90.772 152.914C88.7558 152.914 86.8925 151.057 86.8925 148.853V133.777C86.8925 130.132 84.9458 127.86 81.5391 127.86C78.7303 127.86 76.2552 129.578 74.6422 132.682V148.867C74.6422 151.071 72.904 152.927 70.8322 152.927C68.7603 152.927 67.0083 151.071 67.0083 148.867V148.853Z" fill="#8C00FF"/><path d="M101.994 143.352V128.345H99.3099C97.975 128.345 96.9043 127.375 96.9043 126.072C96.9043 125.241 97.238 124.7 98.114 123.869L105.15 117.675C105.956 116.913 106.485 116.428 107.43 116.428C108.571 116.428 109.641 117.259 109.641 119.185V121.666H118.346C120.084 121.666 121.627 123.107 121.627 125.047C121.627 126.987 120.084 128.345 118.346 128.345H109.641V142.05C109.641 144.669 111.115 146.11 113.521 146.11C114.925 146.11 115.996 145.763 116.872 145.417C117.539 145.14 118.207 144.932 118.944 144.863C120.821 144.793 122.086 146.442 122.086 148.244C122.086 149.685 121.21 150.655 119.736 151.417C118.401 152.179 115.857 153.135 112.436 153.135C105.4 153.135 101.994 149.491 101.994 143.352Z" fill="#8C00FF"/><path d="M154.304 125.379V148.854C154.304 151.057 152.566 152.914 150.48 152.914C148.395 152.914 146.726 151.195 146.601 149.131C144.46 151.611 141.442 153.26 138.091 153.26C129.651 153.26 123.894 145.819 123.894 137.144C123.894 128.47 129.651 121.028 138.091 121.028C142.11 121.028 144.918 122.608 146.726 124.326C147.199 122.677 148.673 121.43 150.48 121.43C152.552 121.43 154.304 123.218 154.304 125.352V125.379ZM139.843 146.235C142.652 146.235 145.071 144.793 146.601 142.452V131.643C145.197 129.44 142.652 127.998 139.843 127.998C135.491 127.998 131.736 131.712 131.736 137.158C131.736 142.604 135.491 146.248 139.843 146.248V146.235Z" fill="#8C00FF"/><path d="M160.437 166.009V125.31C160.437 123.107 162.036 121.458 164.121 121.458C166.207 121.458 167.876 123.176 167.876 125.31V125.864C170.087 122.899 172.826 121.042 176.65 121.042C184.826 121.042 190.708 128.275 190.708 137.158C190.708 146.04 184.951 153.274 176.372 153.274C172.353 153.274 169.614 151.763 168.07 149.976V166.022C168.07 168.156 166.402 170.013 164.247 170.013C162.091 170.013 160.437 168.226 160.437 166.022V166.009ZM174.842 146.234C179.194 146.234 182.879 142.521 182.879 137.144C182.879 131.767 179.194 127.984 174.912 127.984C172.172 127.984 169.558 129.633 168.084 132.183V142.299C169.419 144.641 171.908 146.221 174.842 146.221V146.234Z" fill="#08C8A7"/><path d="M196.353 148.854V107.476C196.353 105.273 198.091 103.485 200.163 103.485C202.235 103.485 203.987 105.273 203.987 107.476V148.854C203.987 151.057 202.318 152.914 200.233 152.914C198.147 152.914 196.353 151.057 196.353 148.854Z" fill="#08C8A7"/><path d="M240.098 125.379V148.854C240.098 151.057 238.36 152.914 236.274 152.914C234.189 152.914 232.52 151.195 232.395 149.131C230.254 151.611 227.236 153.26 223.885 153.26C215.445 153.26 209.688 145.819 209.688 137.144C209.688 128.47 215.445 121.028 223.885 121.028C227.904 121.028 230.712 122.608 232.52 124.326C232.993 122.677 234.467 121.43 236.274 121.43C238.346 121.43 240.098 123.218 240.098 125.352V125.379ZM225.637 146.235C228.446 146.235 230.865 144.793 232.395 142.452V131.643C230.991 129.44 228.446 127.998 225.637 127.998C221.285 127.998 217.53 131.712 217.53 137.158C217.53 142.604 221.285 146.248 225.637 146.248V146.235Z" fill="#08C8A7"/><path d="M249.081 166.203C249.081 165.51 249.22 164.831 249.554 164.138L255.575 151.473L245.063 127.236C244.729 126.474 244.59 125.865 244.59 125.241C244.59 123.176 246.258 121.458 248.414 121.458C249.749 121.458 251.223 122.151 252.168 124.216C254.518 129.786 257.661 137.782 259.802 143.56C262.082 137.366 265.225 130.063 267.7 124.146C268.632 122.082 270.036 121.458 271.454 121.458C273.332 121.458 275 123.176 275 125.172C275 125.865 274.861 126.488 274.527 127.167L256.381 167.173C255.45 169.238 254.045 169.93 252.627 169.93C250.68 169.93 249.081 168.143 249.081 166.217V166.203Z" fill="#08C8A7"/><path d="M206.726 38.9526C215.174 38.9526 222.022 32.1281 222.022 23.7097C222.022 15.2913 215.174 8.4668 206.726 8.4668C198.279 8.4668 191.431 15.2913 191.431 23.7097C191.431 32.1281 198.279 38.9526 206.726 38.9526Z" fill="#08C8A7"/><path d="M175.329 38.8008L72.4313 38.8008C61.6966 38.8008 52.9643 30.1123 52.9643 19.4007C52.9643 8.68911 61.6827 0.000652313 72.4313 0.000652313L155.862 0.000652313C166.61 0.000652313 175.329 8.68911 175.329 19.4007V38.8008Z" fill="#450693"/><path d="M68.3434 95.9614C76.7909 95.9614 83.6389 89.1369 83.6389 80.7185C83.6389 72.3001 76.7909 65.4756 68.3434 65.4756C59.8959 65.4756 53.0479 72.3001 53.0479 80.7185C53.0479 89.1369 59.8959 95.9614 68.3434 95.9614Z" fill="#8C00FF"/><path d="M117.734 57.0088H201.164C211.913 57.0088 220.631 65.6972 220.631 76.4089C220.631 87.1205 211.913 95.8089 201.164 95.8089H98.2671V76.4089C98.2671 65.6972 106.986 57.0088 117.734 57.0088Z" fill="#450693"/></g><defs><clipPath id="clip0_1004_390"><rect width="275" height="170" fill="white"/></clipPath></defs></svg>`;

interface Props {
  initialData: Omit<ScraperParams, "savePath">;
  onSubmit: (data: Omit<ScraperParams, "savePath">) => Promise<void> | void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="w-[18px] h-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const CALENDAR_PATHS = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
);

interface ExportOption {
  label: string;
  description: string;
  icon: ReactNode;
  // Bookings files depend on the booking type; see BOOKING_FILES.
  files: string[];
}

const EXPORT_OPTIONS: Record<ExportType, ExportOption> = {
  all: {
    label: "Exportar todo",
    description: "Los 5 tipos en una sola pasada, con un solo codigo de verificacion.",
    icon: (
      <Icon>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </Icon>
    ),
    files: [
      "services.xlsx",
      "productos.xlsx",
      "professionals.xlsx",
      "sucursales.xlsx",
      "comisiones.xlsx",
    ],
  },
  services: {
    label: "Servicios",
    description: "Catalogo con tags",
    icon: (
      <Icon>
        <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
      </Icon>
    ),
    files: ["services.xlsx"],
  },
  products: {
    label: "Inventario",
    description: "Stock por sucursal",
    icon: (
      <Icon>
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v8" />
      </Icon>
    ),
    files: ["productos.xlsx"],
  },
  professionals: {
    label: "Profesionales",
    description: "Equipo y sucursales",
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
      </Icon>
    ),
    files: ["professionals.xlsx", "sucursales.xlsx"],
  },
  comisiones: {
    label: "Comisiones",
    description: "Servicio y producto",
    icon: (
      <Icon>
        <path d="M19 5 5 19" />
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
      </Icon>
    ),
    files: ["comisiones.xlsx"],
  },
  bookings: {
    label: "Reservas y bloqueos",
    description: "Agenda en un rango de fechas",
    icon: <Icon>{CALENDAR_PATHS}</Icon>,
    files: [],
  },
};

// The single-type tiles, in the order they render under "Exportar todo".
const SINGLE_EXPORTS: ExportType[] = [
  "services",
  "products",
  "professionals",
  "comisiones",
  "bookings",
];

const BOOKING_FILES: Record<BookingType, string[]> = {
  all: ["bookings-reserved.xlsx", "bookings-blocked.xlsx"],
  reserved: ["bookings-reserved.xlsx"],
  blocked: ["bookings-blocked.xlsx"],
};

const BOOKING_TYPE_OPTIONS: { value: BookingType; label: string }[] = [
  { value: "all", label: "Ambos" },
  { value: "reserved", label: "Solo reservas" },
  { value: "blocked", label: "Solo bloqueos" },
];

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 rounded-lg bg-surface-light border border-border text-sm text-white placeholder-white/30 outline-none focus:border-brand-purple transition-colors";

// Mirrors buildBookingDateRange in src/scraper.ts, where both ends are inclusive.
function getBookingRange(months: number, pastMonths: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - pastMonths);
  const end = new Date(today);
  end.setMonth(end.getMonth() + months);
  return {
    start: start.toLocaleDateString("es-CL"),
    end: end.toLocaleDateString("es-CL"),
    days: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
  };
}

export default function LoginForm({ initialData, onSubmit }: Props) {
  const [email, setEmail] = useState(initialData.email);
  const [password, setPassword] = useState(initialData.password);
  const [months, setMonths] = useState(initialData.months);
  // 0 means "start today" and is sent as undefined.
  const [pastMonths, setPastMonths] = useState(initialData.pastMonths ?? 0);
  const [bookingType, setBookingType] = useState<BookingType>(initialData.bookingType);
  const [exportType, setExportType] = useState<ExportType>(initialData.exportType);
  // Only scroll the range section into view when the user picked the type,
  // not when the form opens with bookings already selected.
  const [userPicked, setUserPicked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // "Exportar todo" includes bookings, so it needs the same range settings.
  const needsRange = exportType === "bookings" || exportType === "all";
  const files = needsRange
    ? [...EXPORT_OPTIONS[exportType].files, ...BOOKING_FILES[bookingType]]
    : EXPORT_OPTIONS[exportType].files;

  const pickExportType = (type: ExportType) => {
    setUserPicked(true);
    setExportType(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        email,
        password,
        months,
        pastMonths: needsRange && pastMonths > 0 ? pastMonths : undefined,
        bookingType,
        exportType,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // One card, two panes: account on the left, the export setup on the right.
  // Below md the panes stack, account first.
  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-4xl grid rounded-2xl border border-border overflow-hidden md:grid-cols-[280px_minmax(0,1fr)] md:min-h-[620px]"
    >
      <aside className="flex flex-col gap-6 p-6 bg-surface border-b border-border md:border-b-0 md:border-r">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-white/90">Exportador AgendaPro</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Descarga tus datos de AgendaPro en Excel, listos para importar en VentaPlay.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Cuenta AgendaPro
          </p>
          <Field label="Correo electronico">
            <input
              type="email"
              placeholder="nombre@empresa.cl"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Contrasena">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
          <p className="flex gap-2 text-xs text-white/40 leading-relaxed">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-px"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Si AgendaPro pide verificacion, te enviara un codigo por correo. Un codigo
            sirve para varias exportaciones.
          </p>
        </div>
      </aside>

      <div className="flex flex-col gap-6 p-6 bg-surface/40">
        <fieldset>
          <legend className="mb-3">
            <SectionTitle number={1} title="Que quieres exportar" />
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <ExportTile
              type="all"
              checked={exportType === "all"}
              onChange={() => pickExportType("all")}
              featured
              className="col-span-2 sm:col-span-3"
            />
            {SINGLE_EXPORTS.map((type) => (
              <ExportTile
                key={type}
                type={type}
                checked={exportType === type}
                onChange={() => pickExportType(type)}
                className={type === "bookings" ? "col-span-2" : undefined}
              />
            ))}
          </div>
        </fieldset>

        {needsRange ? (
          <RangeSection
            includedByAll={exportType === "all"}
            reveal={userPicked}
            months={months}
            pastMonths={pastMonths}
            bookingType={bookingType}
            onMonthsChange={setMonths}
            onPastMonthsChange={setPastMonths}
            onBookingTypeChange={setBookingType}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-xs text-white/40">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/5 text-[10px] font-bold text-white/40">
              2
            </span>
            Rango de fechas: solo aplica a Exportar todo y a Reservas y bloqueos.
          </div>
        )}

        <div className="mt-auto flex flex-col gap-4 pt-5 border-t border-border">
          <div>
            <p className="text-sm text-white/75 mb-2">
              {files.length === 1
                ? "Se generara 1 archivo"
                : `Se generaran ${files.length} archivos`}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {files.map((file) => (
                <li
                  key={file}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-brand-green/80"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white whitespace-nowrap bg-gradient-to-r from-brand-purple to-[#A033FF] hover:shadow-[0_0_20px_rgba(8,200,167,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Seleccionando carpeta..." : "Elegir carpeta y exportar"}
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-white/85">
      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-brand-purple/20 text-[10px] font-bold text-brand-purple">
        {number}
      </span>
      {title}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-white/55 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ExportTile({
  type,
  checked,
  onChange,
  featured,
  className,
}: {
  type: ExportType;
  checked: boolean;
  onChange: () => void;
  featured?: boolean;
  className?: string;
}) {
  const option = EXPORT_OPTIONS[type];

  return (
    <label
      className={`group flex items-center gap-3 rounded-xl border cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-purple/60 ${
        featured ? "px-4 py-3.5" : "px-3 py-3"
      } ${
        checked
          ? "border-brand-purple bg-brand-purple/10"
          : "border-border bg-surface hover:border-white/20 hover:bg-surface-light/60"
      } ${className ?? ""}`}
    >
      <input
        type="radio"
        name="exportType"
        value={type}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
          featured ? "w-10 h-10" : "w-9 h-9"
        } ${
          checked
            ? "bg-brand-purple text-white"
            : "bg-white/5 text-white/55 group-hover:text-white/80"
        }`}
      >
        {option.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white/90">{option.label}</span>
        <span className="block text-xs text-white/50 leading-snug">
          {option.description}
        </span>
      </span>
      {featured && (
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
            checked ? "bg-brand-purple/20 text-white/85" : "bg-white/5 text-white/50"
          }`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {CALENDAR_PATHS}
          </svg>
          Incluye rango de fechas
        </span>
      )}
    </label>
  );
}

function RangeSection({
  includedByAll,
  reveal,
  months,
  pastMonths,
  bookingType,
  onMonthsChange,
  onPastMonthsChange,
  onBookingTypeChange,
}: {
  includedByAll: boolean;
  reveal: boolean;
  months: number;
  pastMonths: number;
  bookingType: BookingType;
  onMonthsChange: (value: number) => void;
  onPastMonthsChange: (value: number) => void;
  onBookingTypeChange: (value: BookingType) => void;
}) {
  const ref = useEnterAnimation<HTMLElement>();
  const range = getBookingRange(months, pastMonths);

  // Mount-only: on short windows the section can appear below the fold.
  useEffect(() => {
    if (reveal) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  return (
    <section
      ref={ref}
      data-anim
      className="rounded-xl border border-border bg-surface p-4 space-y-4"
    >
      <div className="space-y-1">
        <SectionTitle number={2} title="Rango de reservas y bloqueos" />
        <p className="text-xs text-white/45 pl-7">
          Cada dia se consulta por sucursal, asi que los rangos largos tardan mas.
        </p>
      </div>

      {includedByAll && (
        <p className="flex items-start gap-2 rounded-lg border border-brand-purple/30 bg-brand-purple/10 px-3 py-2 text-xs text-white/75">
          <svg
            className="w-4 h-4 flex-shrink-0 text-brand-purple"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          Exportar todo incluye reservas y bloqueos. Revisa este rango antes de exportar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stepper
          label="Meses hacia atras"
          value={pastMonths}
          min={0}
          max={12}
          onChange={onPastMonthsChange}
        />
        <Stepper
          label="Meses hacia adelante"
          value={months}
          min={1}
          max={24}
          onChange={onMonthsChange}
        />
        <fieldset className="col-span-2">
          <legend className="text-xs text-white/55 mb-1.5">Incluir</legend>
          <div className="flex h-10 gap-1 p-1 rounded-lg bg-surface-light border border-border">
            {BOOKING_TYPE_OPTIONS.map((option) => {
              const active = option.value === bookingType;
              return (
                <label
                  key={option.value}
                  className={`flex-1 flex items-center justify-center px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-purple/60 ${
                    active
                      ? "bg-brand-purple text-white"
                      : "text-white/55 hover:text-white/85"
                  }`}
                >
                  <input
                    type="radio"
                    name="bookingType"
                    value={option.value}
                    checked={active}
                    onChange={() => onBookingTypeChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-white/55">
        <svg
          className="w-4 h-4 text-white/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {CALENDAR_PATHS}
        </svg>
        <span>
          Del <span className="font-medium text-white/85">{range.start}</span> al{" "}
          <span className="font-medium text-white/85">{range.end}</span>
        </span>
        <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-brand-green">
          {range.days} dias
        </span>
      </p>
    </section>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const buttonClass =
    "w-9 h-full flex items-center justify-center flex-shrink-0 text-white/55 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors";

  return (
    <div>
      <span className="block text-xs text-white/55 mb-1.5">{label}</span>
      <div className="flex items-center h-10 rounded-lg bg-surface-light border border-border focus-within:border-brand-purple transition-colors">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= min}
          aria-label={`Restar en ${label.toLowerCase()}`}
          className={buttonClass}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
          </svg>
        </button>
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={1}
          required
          value={value}
          onChange={(e) => set(parseInt(e.target.value, 10) || min)}
          className="w-full min-w-0 bg-transparent text-center text-sm font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(value + 1)}
          disabled={value >= max}
          aria-label={`Sumar en ${label.toLowerCase()}`}
          className={buttonClass}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
