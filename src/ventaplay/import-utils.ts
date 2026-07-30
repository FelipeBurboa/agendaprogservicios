/**
 * Verbatim port of ventaplaymrm/src/utils/import/agendaProImportUtils.ts.
 * Matching semantics must stay identical to the web importers.
 */

export interface NamedLookupEntry {
  id: string;
  nombre: string;
}

const SHEET_SUCURSAL_PREFIX = /^sucursal\s+/;

export const normalizeForComparison = (value: string): string => {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\bnull\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();
};

export const getFlexibleColumnValue = (
  row: Record<string, any>,
  ...columnNames: string[]
): any => {
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== "") {
      return row[name];
    }
  }

  const rowKeys = Object.keys(row);

  for (const name of columnNames) {
    const normalizedName = normalizeForComparison(name);

    for (const key of rowKeys) {
      const normalizedKey = normalizeForComparison(key);
      if (
        normalizedKey === normalizedName &&
        row[key] !== undefined &&
        row[key] !== ""
      ) {
        return row[key];
      }
    }
  }

  for (const name of columnNames) {
    const normalizedName = normalizeForComparison(name);

    for (const key of rowKeys) {
      const normalizedKey = normalizeForComparison(key);
      if (
        normalizedKey.startsWith(normalizedName) &&
        row[key] !== undefined &&
        row[key] !== ""
      ) {
        return row[key];
      }
    }
  }

  return undefined;
};

export const findByWordSubset = <T>(
  excelName: string,
  lookup: Map<string, T>,
  minimumWords = 2,
): T | null => {
  const excelWords = new Set(
    normalizeForComparison(excelName)
      .split(" ")
      .filter((word) => word.length > 0),
  );

  let bestMatch: T | null = null;
  let bestWordCount = 0;

  for (const [normalizedDbName, entity] of lookup) {
    const dbWords = normalizedDbName.split(" ").filter((word) => word.length > 0);

    if (dbWords.length < minimumWords) {
      continue;
    }

    const allFound = dbWords.every((word) => excelWords.has(word));
    if (allFound && dbWords.length > bestWordCount) {
      bestMatch = entity;
      bestWordCount = dbWords.length;
    }
  }

  return bestMatch;
};

export const resolveSucursalFromSheetName = <T extends NamedLookupEntry>(
  sheetName: string,
  sucursalMap: Map<string, T>,
): T | null => {
  const sheetNorm = normalizeForComparison(sheetName);

  let sucursal = sucursalMap.get(sheetNorm) ?? null;
  if (sucursal) {
    return sucursal;
  }

  const withoutPrefix = sheetNorm.replace(SHEET_SUCURSAL_PREFIX, "");
  sucursal = sucursalMap.get(withoutPrefix) ?? null;
  if (sucursal) {
    return sucursal;
  }

  for (const [key, value] of sucursalMap) {
    if (sheetNorm.includes(key) || key.includes(sheetNorm)) {
      return value;
    }
  }

  return null;
};

const slugifyForEmail = (value: string): string => {
  const normalized = normalizeForComparison(value)
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".");

  return normalized || "profesional";
};

const extractStableDigits = (value: string): string => {
  const explicitDigits = value.replace(/\D/g, "");
  if (explicitDigits.length > 0) {
    return explicitDigits;
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return String(hash);
};

export const generateProfessionalPlaceholderEmail = (
  nombre: string,
  agendaProProviderId?: string | number | null,
): string => {
  const slug = slugifyForEmail(nombre);
  const suffix = extractStableDigits(String(agendaProProviderId ?? slug))
    .padStart(6, "0")
    .slice(-10);

  return `${slug}.${suffix}@agendapro.import`;
};

export const generateProfessionalPlaceholderPhone = (
  agendaProProviderId?: string | number | null,
  nombre?: string | null,
): string => {
  const seed = extractStableDigits(
    String(agendaProProviderId ?? nombre ?? "profesional"),
  )
    .padStart(8, "0")
    .slice(-8);

  return `569${seed}`;
};

const CHILE_TZ = "America/Santiago";

/**
 * Convert a naive date+time (assumed Chile local) to a timezone-aware ISO
 * string. AgendaPro exports times in Chile local time, but Supabase interprets
 * naive timestamps as UTC. This appends the correct Chile UTC offset (handles
 * DST). Never substitute local Date math -- the main process runs in whatever
 * timezone the operator's machine is set to.
 */
export const toChileTimestamptz = (fecha: string, hora: string): string => {
  const probe = new Date(`${fecha}T12:00:00Z`);
  const chileNoon = probe.toLocaleString("sv-SE", { timeZone: CHILE_TZ });
  const chileHour = parseInt(chileNoon.split(" ")[1]);
  const offsetHours = chileHour - 12;
  const sign = offsetHours >= 0 ? "+" : "-";
  const hh = String(Math.abs(offsetHours)).padStart(2, "0");
  return `${fecha}T${hora}${sign}${hh}:00`;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
