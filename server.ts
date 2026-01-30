import express, { type Request, type Response, type NextFunction } from "express";
import { scrapeLocations, scrapeBookings } from "./src/scraper.js";
import { generateWorkbookFile } from "./src/excel.js";
import type { BookingParams } from "./src/types.js";

const app = express();
app.use(express.json());

// ─── 5-minute request timeout ────────────────────────────────────────────────

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(5 * 60 * 1000, () => {
    res.status(408).json({ error: "Request timed out" });
  });
  next();
});

// ─── Validation helper ──────────────────────────────────────────────────────

function validateCredentials(
  body: any
): { email: string; password: string } | string {
  const { email, password } = body ?? {};
  if (!email || typeof email !== "string")
    return "Missing or invalid 'email' in request body";
  if (!password || typeof password !== "string")
    return "Missing or invalid 'password' in request body";
  return { email, password };
}

function validateBookingParams(body: any): BookingParams | string {
  const creds = validateCredentials(body);
  if (typeof creds === "string") return creds;
  const months = Number(body.months);
  if (!Number.isFinite(months) || months < 1)
    return "'months' must be a positive number";
  return { ...creds, months };
}

/** Flatten a Map<locationId, rows[]> into a flat array with location metadata. */
function flattenMap(
  dataMap: Map<number, Record<string, unknown>[]>,
  locations: { label: string; value: number }[]
): Record<string, unknown>[] {
  const locNameById = new Map(locations.map((l) => [l.value, l.label]));
  const result: Record<string, unknown>[] = [];
  for (const [locId, rows] of dataMap) {
    for (const row of rows) {
      result.push({
        locationId: locId,
        location: locNameById.get(locId) ?? "",
        ...row,
      });
    }
  }
  return result;
}

// ─── POST /api/locations ─────────────────────────────────────────────────────

app.post("/api/locations", async (req: Request, res: Response) => {
  const creds = validateCredentials(req.body);
  if (typeof creds === "string") {
    res.status(400).json({ error: creds });
    return;
  }
  try {
    const { locations } = await scrapeLocations(creds.email, creds.password);
    res.json(locations);
  } catch (err) {
    console.error("Error in /api/locations:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/bookings (combined) ───────────────────────────────────────────

app.post("/api/bookings", async (req: Request, res: Response) => {
  const params = validateBookingParams(req.body);
  if (typeof params === "string") {
    res.status(400).json({ error: params });
    return;
  }
  try {
    const result = await scrapeBookings(params);
    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      await generateWorkbookFile(
        "reserved",
        result.locations,
        result.reserved,
        "bookings-reserved.xlsx"
      );
      await generateWorkbookFile(
        "blocked",
        result.locations,
        result.blocked,
        "bookings-blocked.xlsx"
      );
      res.json({
        files: ["bookings-reserved.xlsx", "bookings-blocked.xlsx"],
        reserved: [...result.reserved.values()].reduce((s, r) => s + r.length, 0),
        blocked: [...result.blocked.values()].reduce((s, r) => s + r.length, 0),
      });
    } else {
      res.json({
        reserved: flattenMap(result.reserved, result.locations),
        blocked: flattenMap(result.blocked, result.locations),
      });
    }
  } catch (err) {
    console.error("Error in /api/bookings:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/bookings/reserved ─────────────────────────────────────────────

app.post("/api/bookings/reserved", async (req: Request, res: Response) => {
  const params = validateBookingParams(req.body);
  if (typeof params === "string") {
    res.status(400).json({ error: params });
    return;
  }
  try {
    const result = await scrapeBookings(params);
    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      await generateWorkbookFile(
        "reserved",
        result.locations,
        result.reserved,
        "bookings-reserved.xlsx"
      );
      res.json({
        files: ["bookings-reserved.xlsx"],
        reserved: [...result.reserved.values()].reduce((s, r) => s + r.length, 0),
      });
    } else {
      res.json(flattenMap(result.reserved, result.locations));
    }
  } catch (err) {
    console.error("Error in /api/bookings/reserved:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/bookings/blocked ──────────────────────────────────────────────

app.post("/api/bookings/blocked", async (req: Request, res: Response) => {
  const params = validateBookingParams(req.body);
  if (typeof params === "string") {
    res.status(400).json({ error: params });
    return;
  }
  try {
    const result = await scrapeBookings(params);
    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      await generateWorkbookFile(
        "blocked",
        result.locations,
        result.blocked,
        "bookings-blocked.xlsx"
      );
      res.json({
        files: ["bookings-blocked.xlsx"],
        blocked: [...result.blocked.values()].reduce((s, r) => s + r.length, 0),
      });
    } else {
      res.json(flattenMap(result.blocked, result.locations));
    }
  } catch (err) {
    console.error("Error in /api/bookings/blocked:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`AgendaPro API server listening on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /api/locations");
  console.log("  POST /api/bookings           (?format=json|xlsx)  — both reserved + blocked");
  console.log("  POST /api/bookings/reserved  (?format=json|xlsx)");
  console.log("  POST /api/bookings/blocked   (?format=json|xlsx)");
});
