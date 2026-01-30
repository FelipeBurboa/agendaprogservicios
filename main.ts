import { scrapeBookings } from "./src/scraper.js";
import { generateWorkbookFile } from "./src/excel.js";

// ─── CLI args ────────────────────────────────────────────────────────────────

const [email, password, monthsArg] = process.argv.slice(2);

if (!email || !password || !monthsArg) {
  console.error("Usage: npx tsx main.ts <email> <password> <months>");
  console.error("Example: npx tsx main.ts user@example.com P4ssw0rd 3");
  process.exit(1);
}

const months = Number(monthsArg);
if (!Number.isFinite(months) || months < 1) {
  console.error("Error: <months> must be a positive integer.");
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const result = await scrapeBookings({ email, password, months });

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
