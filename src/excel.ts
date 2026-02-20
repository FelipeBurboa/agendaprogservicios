import ExcelJS from "exceljs";
import {
  HEADER_FONT,
  HEADER_FILL,
  HEADER_ALIGNMENT,
  THIN_BORDER,
  ALT_FILL,
  RESERVED_HEADERS,
  BLOCKED_HEADERS,
  type Location,
} from "./types.js";

export function writeSheet(
  ws: ExcelJS.Worksheet,
  headers: string[],
  rows: Record<string, unknown>[]
): void {
  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = THIN_BORDER;
  });

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const values = headers.map((h) => rows[i][h] ?? "");
    const dataRow = ws.addRow(values);
    dataRow.eachCell((cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle" };
      if (i % 2 === 1) {
        cell.fill = ALT_FILL;
      }
    });
  }

  // Auto-width columns
  ws.columns.forEach((col, idx) => {
    let maxLen = headers[idx]?.length ?? 10;
    rows.forEach((row) => {
      const val = String(row[headers[idx]] ?? "");
      maxLen = Math.max(maxLen, Math.min(val.length, 40));
    });
    col.width = maxLen + 3;
  });

  // Auto-filter and freeze
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: headers.length },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function buildWorkbook(
  kind: "reserved" | "blocked",
  locations: Location[],
  dataMap: Map<number, Record<string, unknown>[]>
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const headers = kind === "reserved" ? RESERVED_HEADERS : BLOCKED_HEADERS;
  for (const loc of locations) {
    const ws = wb.addWorksheet(loc.label.slice(0, 31));
    writeSheet(ws, headers, dataMap.get(loc.value) ?? []);
  }
  return wb;
}

/** Write an Excel workbook to a file on disk. */
export async function generateWorkbookFile(
  kind: "reserved" | "blocked",
  locations: Location[],
  dataMap: Map<number, Record<string, unknown>[]>,
  filePath: string
): Promise<void> {
  const wb = buildWorkbook(kind, locations, dataMap);
  await wb.xlsx.writeFile(filePath);
}
