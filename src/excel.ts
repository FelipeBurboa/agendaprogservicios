import ExcelJS from "exceljs";
import {
  ALT_FILL,
  BLOCKED_HEADERS,
  COMISION_PRODUCTO_EXPORT_HEADERS,
  COMISION_SERVICIO_EXPORT_HEADERS,
  HEADER_ALIGNMENT,
  HEADER_FILL,
  HEADER_FONT,
  PROFESSIONAL_EXPORT_HEADERS,
  RESERVED_HEADERS,
  SERVICE_EXPORT_HEADERS,
  SUCURSAL_EXPORT_HEADERS,
  THIN_BORDER,
  buildProductHeaders,
  type Location,
  type ProductExportRow,
  type ProfessionalSheet,
  type ScrapedComisiones,
  type ServiceExportRow,
  type SucursalExportRow,
} from "./types.js";

type SheetRow = Record<string, unknown>;
type ColumnFormatMap = Partial<Record<string, string>>;

export function writeSheet<T extends object>(
  ws: ExcelJS.Worksheet,
  headers: readonly string[],
  rows: T[],
  columnFormats: ColumnFormatMap = {}
): void {
  const headerRow = ws.addRow([...headers]);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = THIN_BORDER;
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as SheetRow;
    const values = headers.map((header) => row[header] ?? "");
    const dataRow = ws.addRow(values);
    dataRow.eachCell((cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle" };
      if (i % 2 === 1) {
        cell.fill = ALT_FILL;
      }
    });
  }

  headers.forEach((header, idx) => {
    const numFmt = columnFormats[header];
    if (numFmt) {
      ws.getColumn(idx + 1).numFmt = numFmt;
    }
  });

  ws.columns.forEach((col, idx) => {
    let maxLen = headers[idx]?.length ?? 10;
    rows.forEach((row) => {
      const rowData = row as SheetRow;
      const val = String(rowData[headers[idx]] ?? "");
      maxLen = Math.max(maxLen, Math.min(val.length, 40));
    });
    col.width = maxLen + 3;
  });

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

function buildSingleSheetWorkbook<T extends object>(
  sheetName: string,
  headers: readonly string[],
  rows: T[],
  columnFormats: ColumnFormatMap = {}
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  writeSheet(ws, headers, rows, columnFormats);
  return wb;
}

function buildServicesWorkbook(rows: ServiceExportRow[]): ExcelJS.Workbook {
  return buildSingleSheetWorkbook("servicios", SERVICE_EXPORT_HEADERS, rows, {
    precio: "0.00",
  });
}

function buildProfessionalsWorkbook(sheets: ProfessionalSheet[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.sheetName.slice(0, 31));
    writeSheet(ws, PROFESSIONAL_EXPORT_HEADERS, sheet.rows);
  }
  return wb;
}

function buildSucursalesWorkbook(rows: SucursalExportRow[]): ExcelJS.Workbook {
  return buildSingleSheetWorkbook("sucursales", SUCURSAL_EXPORT_HEADERS, rows);
}

function buildProductsWorkbook(
  rows: ProductExportRow[],
  locationNames: string[]
): ExcelJS.Workbook {
  return buildSingleSheetWorkbook("productos", buildProductHeaders(locationNames), rows, {
    Costo: "0.00",
    "Precio venta externa": "0.00",
    "Precio venta interna": "0.00",
  });
}

function buildComisionesWorkbook(data: ScrapedComisiones): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  writeSheet(
    wb.addWorksheet("Comisiones Servicios"),
    COMISION_SERVICIO_EXPORT_HEADERS,
    data.servicios,
    { Valor: "0.00" }
  );
  writeSheet(
    wb.addWorksheet("Comisiones Productos"),
    COMISION_PRODUCTO_EXPORT_HEADERS,
    data.productos,
    { Valor: "0.00" }
  );
  return wb;
}

async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const content = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

export async function generateWorkbookFile(
  kind: "reserved" | "blocked",
  locations: Location[],
  dataMap: Map<number, Record<string, unknown>[]>,
  filePath: string
): Promise<void> {
  const wb = buildWorkbook(kind, locations, dataMap);
  await wb.xlsx.writeFile(filePath);
}

export async function generateServicesWorkbookFile(
  rows: ServiceExportRow[],
  filePath: string
): Promise<void> {
  const wb = buildServicesWorkbook(rows);
  await wb.xlsx.writeFile(filePath);
}

export async function generateServicesWorkbookBuffer(
  rows: ServiceExportRow[]
): Promise<Buffer> {
  const wb = buildServicesWorkbook(rows);
  return workbookToBuffer(wb);
}

export async function generateProfessionalsWorkbookFile(
  sheets: ProfessionalSheet[],
  filePath: string
): Promise<void> {
  const wb = buildProfessionalsWorkbook(sheets);
  await wb.xlsx.writeFile(filePath);
}

export async function generateSucursalesWorkbookFile(
  rows: SucursalExportRow[],
  filePath: string
): Promise<void> {
  const wb = buildSucursalesWorkbook(rows);
  await wb.xlsx.writeFile(filePath);
}

export async function generateProductsWorkbookFile(
  rows: ProductExportRow[],
  locationNames: string[],
  filePath: string
): Promise<void> {
  const wb = buildProductsWorkbook(rows, locationNames);
  await wb.xlsx.writeFile(filePath);
}

export async function generateProductsWorkbookBuffer(
  rows: ProductExportRow[],
  locationNames: string[]
): Promise<Buffer> {
  const wb = buildProductsWorkbook(rows, locationNames);
  return workbookToBuffer(wb);
}

export async function generateComisionesWorkbookFile(
  data: ScrapedComisiones,
  filePath: string
): Promise<void> {
  const wb = buildComisionesWorkbook(data);
  await wb.xlsx.writeFile(filePath);
}

export async function generateComisionesWorkbookBuffer(
  data: ScrapedComisiones
): Promise<Buffer> {
  const wb = buildComisionesWorkbook(data);
  return workbookToBuffer(wb);
}
