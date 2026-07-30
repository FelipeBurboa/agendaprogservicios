import * as fs from "fs";
import * as XLSX from "xlsx";

/**
 * Port of ventaplaymrm/src/utils/import/xlsxParser.ts + csvSeparatorDetector.ts.
 * Only the input changes (File -> filePath); SheetJS read options and the
 * array-of-arrays post-processing are kept identical so parsing behaves the
 * same as the web importers.
 */

export type CsvSeparator = ";" | "," | "\t";

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  detectedSeparator?: CsvSeparator;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export interface ParsedExcelMultiSheet {
  sheets: ParsedSheet[];
  totalRows: number;
}

const CANDIDATES: CsvSeparator[] = [";", ",", "\t"];

/**
 * A good separator appears the same number of times on every line, so the
 * score rewards a high average count and penalizes variance between lines.
 */
export function detectSeparatorFromText(text: string): CsvSeparator {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);

  if (lines.length === 0) return ",";

  let bestSep: CsvSeparator = ",";
  let bestScore = -Infinity;

  for (const sep of CANDIDATES) {
    const counts = lines.map((line) => countOutsideQuotes(line, sep));
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

    if (avg < 1) continue;

    const variance =
      counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length;
    const score = avg - variance * 2;

    if (score > bestScore) {
      bestScore = score;
      bestSep = sep;
    }
  }

  return bestSep;
}

function countOutsideQuotes(line: string, sep: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === sep) {
      count++;
    }
  }

  return count;
}

function buildResultFromAoa(jsonData: any[][]): ParsedExcelData {
  const headers = (jsonData[0] as string[]).map((h) => String(h ?? "").trim());
  const dataRows = jsonData.slice(1);

  const rows = dataRows
    .filter((row) => row.some((cell) => cell !== "" && cell != null))
    .map((row) => {
      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] ?? "";
      });
      return rowData;
    });

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

function sheetToAoa(worksheet: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  }) as any[][];
}

/** Reads the FIRST sheet only, matching the web parser. */
export function parseFile(filePath: string): ParsedExcelData {
  const isCsv = /\.csv$/i.test(filePath);
  return isCsv ? parseCsvFile(filePath) : parseBinaryFile(filePath);
}

function parseCsvFile(filePath: string): ParsedExcelData {
  const raw = fs.readFileSync(filePath, "utf8");
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const detectedSeparator = detectSeparatorFromText(text);

  // SheetJS autodetection sometimes misreads ';' (common in LATAM/EU exports),
  // so the field separator is passed explicitly.
  const workbook = XLSX.read(text, { type: "string", FS: detectedSeparator });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El archivo no contiene hojas de calculo");
  }

  const jsonData = sheetToAoa(workbook.Sheets[sheetName]);
  if (jsonData.length === 0) {
    throw new Error("El archivo esta vacio");
  }

  return { ...buildResultFromAoa(jsonData), detectedSeparator };
}

function parseBinaryFile(filePath: string): ParsedExcelData {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El archivo no contiene hojas de calculo");
  }

  const jsonData = sheetToAoa(workbook.Sheets[sheetName]);
  if (jsonData.length === 0) {
    throw new Error("El archivo esta vacio");
  }

  return buildResultFromAoa(jsonData);
}

export function parseFileAllSheets(filePath: string): ParsedExcelMultiSheet {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("El archivo no contiene hojas de calculo");
  }

  const sheets: ParsedSheet[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const jsonData = sheetToAoa(workbook.Sheets[sheetName]);
    if (jsonData.length === 0) continue;

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);

    const rows = dataRows
      .filter((row) => row.some((cell) => cell !== ""))
      .map((row) => {
        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] ?? "";
        });
        return rowData;
      });

    if (rows.length > 0) {
      sheets.push({ name: sheetName, headers, rows, totalRows: rows.length });
      totalRows += rows.length;
    }
  }

  return { sheets, totalRows };
}
