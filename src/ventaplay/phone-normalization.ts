/**
 * Verbatim port of ventaplaymrm/src/utils/import/phoneNormalization.ts.
 *
 * Final phone format: digits only, no + prefix (e.g. 56912345678).
 */

export interface PhoneNormalizationResult {
  isValid: boolean;
  normalizedPhone: string | null;
  originalPhone: string;
  error?: string;
}

export function normalizePhone(
  phone: string | null | undefined,
): PhoneNormalizationResult {
  const original = String(phone ?? "");

  if (!phone || String(phone).trim() === "") {
    return {
      isValid: false,
      normalizedPhone: null,
      originalPhone: original,
      error: "Telefono vacio",
    };
  }

  const cleaned = String(phone)
    .replace(/\+/g, "")
    .replace(/[\s\-\(\)\.]/g, "")
    .replace(/[^0-9]/g, "");

  if (!cleaned || cleaned.length === 0) {
    return {
      isValid: false,
      normalizedPhone: null,
      originalPhone: original,
      error: "Telefono no contiene digitos validos",
    };
  }

  let normalized = cleaned;

  if (cleaned.startsWith("56") && cleaned.length === 11) {
    normalized = cleaned;
  } else if (cleaned.length === 8 && !cleaned.startsWith("0")) {
    normalized = "569" + cleaned;
  } else if (cleaned.length === 9 && cleaned.startsWith("9")) {
    normalized = "56" + cleaned;
  } else if (cleaned.startsWith("54")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("595")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("1") && cleaned.length >= 10) {
    normalized = cleaned;
  } else if (cleaned.startsWith("52")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("55")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("57")) {
    normalized = cleaned;
  } else if (cleaned.startsWith("51")) {
    normalized = cleaned;
  } else {
    normalized = cleaned;
  }

  if (normalized.length < 10 || normalized.length > 15) {
    return {
      isValid: false,
      normalizedPhone: null,
      originalPhone: original,
      error: `Telefono invalido: ${normalized.length} digitos (debe ser 10-15)`,
    };
  }

  return {
    isValid: true,
    normalizedPhone: normalized,
    originalPhone: original,
  };
}

export function normalizeRut(rut: string | null | undefined): string | null {
  if (!rut || String(rut).trim() === "") {
    return null;
  }

  return String(rut).replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
}

export function parseDateDDMMYYYY(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr || String(dateStr).trim() === "") {
    return null;
  }

  const str = String(dateStr).trim();

  // Excel serial date numbers (days since 1900-01-01, with the 1900 leap bug)
  if (/^\d+$/.test(str) && parseInt(str) > 1000) {
    const excelDate = parseInt(str);
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];

    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (
      dayNum >= 1 &&
      dayNum <= 31 &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      yearNum >= 1900 &&
      yearNum <= 2100
    ) {
      return `${year}-${month}-${day}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return null;
}

export function parseBirthDateFromComponents(
  day: number | string | null | undefined,
  month: number | string | null | undefined,
  year: number | string | null | undefined,
): string | null {
  const dayNum = parseInt(String(day ?? ""));
  const monthNum = parseInt(String(month ?? ""));
  const yearNum = parseInt(String(year ?? ""));

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
    return null;
  }

  if (
    dayNum < 1 ||
    dayNum > 31 ||
    monthNum < 1 ||
    monthNum > 12 ||
    yearNum < 1900 ||
    yearNum > 2100
  ) {
    return null;
  }

  const dayStr = String(dayNum).padStart(2, "0");
  const monthStr = String(monthNum).padStart(2, "0");

  return `${yearNum}-${monthStr}-${dayStr}`;
}

/** 1 = femenino, 2 = masculino, anything else = null. */
export function parseGender(
  value: number | string | null | undefined,
): string | null {
  const num = parseInt(String(value ?? ""));

  if (num === 1) return "femenino";
  if (num === 2) return "masculino";

  return null;
}
