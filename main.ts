import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { scrapeBookings, scrapeComisiones, scrapeProducts } from "./src/scraper.js";
import {
  generateComisionesWorkbookFile,
  generateProductsWorkbookFile,
  generateWorkbookFile,
} from "./src/excel.js";
import type { MfaCodeRequest } from "./src/types.js";

async function promptMfaCode(request: MfaCodeRequest): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    if (request.previousError) {
      console.error(`\nCodigo incorrecto: ${request.previousError}`);
    }
    console.log(
      `\nAutenticacion de dos factores (intento ${request.attempt}). ` +
        "Se envio un codigo de 6 digitos a tu email."
    );
    const code = (
      await rl.question("Codigo de 6 digitos (o 'r' para reenviar): ")
    ).trim();
    if (code.toLowerCase() === "r") {
      await request.resend();
      console.log("Nuevo codigo enviado.");
      return promptMfaCode({ ...request, attempt: request.attempt, previousError: undefined });
    }
    return code;
  } finally {
    rl.close();
  }
}

// ─── CLI args ────────────────────────────────────────────────────────────────

const [email, password, monthsArg] = process.argv.slice(2);

if (!email || !password || !monthsArg) {
  console.error("Usage: npx tsx main.ts <email> <password> <months|products|comisiones>");
  console.error("Example: npx tsx main.ts user@example.com P4ssw0rd 3");
  console.error("Example: npx tsx main.ts user@example.com P4ssw0rd products");
  console.error("Example: npx tsx main.ts user@example.com P4ssw0rd comisiones");
  process.exit(1);
}

const productsMode = monthsArg.toLowerCase() === "products";
const comisionesMode = monthsArg.toLowerCase() === "comisiones";

const months = Number(monthsArg);
if (!productsMode && !comisionesMode && (!Number.isFinite(months) || months < 1)) {
  console.error(
    "Error: <months> must be a positive integer (or 'products' / 'comisiones')."
  );
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function exportProducts(): Promise<void> {
  const { rows, locationNames } = await scrapeProducts(
    { email, password },
    { onMfaCodeRequest: promptMfaCode }
  );

  await generateProductsWorkbookFile(rows, locationNames, "productos.xlsx");
  console.log(`productos.xlsx saved (${rows.length} products)`);
  console.log("\nDone!");
}

async function exportComisiones(): Promise<void> {
  const data = await scrapeComisiones(
    { email, password },
    { onMfaCodeRequest: promptMfaCode }
  );

  await generateComisionesWorkbookFile(data, "comisiones.xlsx");
  console.log(
    `comisiones.xlsx saved (${data.servicios.length} servicios, ${data.productos.length} productos)`
  );
  console.log("\nDone!");
}

async function main(): Promise<void> {
  if (productsMode) {
    await exportProducts();
    return;
  }

  if (comisionesMode) {
    await exportComisiones();
    return;
  }

  const result = await scrapeBookings(
    { email, password, months },
    { onMfaCodeRequest: promptMfaCode }
  );

  // Write reserved workbook
  await generateWorkbookFile(
    "reserved",
    result.locations,
    result.reserved,
    "bookings-reserved.xlsx"
  );
  const totalReserved = [...result.reserved.values()].reduce(
    (s, r) => s + r.length,
    0
  );
  console.log(`bookings-reserved.xlsx saved (${totalReserved} rows)`);

  // Write blocked workbook
  await generateWorkbookFile(
    "blocked",
    result.locations,
    result.blocked,
    "bookings-blocked.xlsx"
  );
  const totalBlocked = [...result.blocked.values()].reduce(
    (s, r) => s + r.length,
    0
  );
  console.log(`bookings-blocked.xlsx saved (${totalBlocked} rows)`);

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
