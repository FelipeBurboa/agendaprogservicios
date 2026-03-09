import express, { type NextFunction, type Request, type Response } from "express";
import {
  prepareBookingsScrape,
  scrapeLocations,
  scrapeProfessionals,
  scrapeServices,
  scrapeBookingsWithContext,
} from "./src/scraper.js";
import {
  generateProfessionalsWorkbookFile,
  generateServicesWorkbookFile,
  generateSucursalesWorkbookFile,
  generateWorkbookFile,
} from "./src/excel.js";
import type { BookingParams } from "./src/types.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const BOOKINGS_PREP_TIMEOUT_MS = DEFAULT_REQUEST_TIMEOUT_MS;
const BOOKINGS_THROTTLE_MS = 300;
const BOOKINGS_REQUEST_OVERHEAD_MS = 1000;
const BOOKINGS_COMPLETION_BUFFER_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MESSAGE = "Request timed out";

type BookingsRouteKind = "all" | "reserved" | "blocked";

interface BookingsRequestState {
  aborted: boolean;
  timedOut: boolean;
  disconnected: boolean;
}

const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/bookings")) {
    next();
    return;
  }

  res.setTimeout(DEFAULT_REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent && !res.writableEnded) {
      res.status(408).json({ error: REQUEST_TIMEOUT_MESSAGE });
    }
  });

  next();
});

function validateCredentials(
  body: any
): { email: string; password: string } | string {
  const { email, password } = body ?? {};
  if (!email || typeof email !== "string") {
    return "Missing or invalid 'email' in request body";
  }
  if (!password || typeof password !== "string") {
    return "Missing or invalid 'password' in request body";
  }
  return { email, password };
}

function validateBookingParams(body: any): BookingParams | string {
  const creds = validateCredentials(body);
  if (typeof creds === "string") return creds;
  const months = Number(body.months);
  if (!Number.isFinite(months) || months < 1) {
    return "'months' must be a positive number";
  }

  const rawPastMonths = body?.past_months;
  if (
    rawPastMonths === undefined ||
    rawPastMonths === null ||
    rawPastMonths === ""
  ) {
    return { ...creds, months };
  }

  const pastMonths = Number(rawPastMonths);
  if (!Number.isInteger(pastMonths) || pastMonths < 1 || pastMonths > 12) {
    return "'past_months' must be an integer between 1 and 12";
  }

  return { ...creds, months, past_months: pastMonths };
}

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

function countRows(dataMap: Map<number, Record<string, unknown>[]>): number {
  return [...dataMap.values()].reduce((sum, rows) => sum + rows.length, 0);
}

function canRespond(res: Response): boolean {
  return !res.headersSent && !res.writableEnded;
}

function sendJsonOnce(
  res: Response,
  status: number,
  payload: unknown
): boolean {
  if (!canRespond(res)) {
    return false;
  }

  res.status(status).json(payload);
  return true;
}

function calculateBookingsTimeoutMs(totalRequests: number): number {
  const estimatedMs =
    totalRequests * (BOOKINGS_THROTTLE_MS + BOOKINGS_REQUEST_OVERHEAD_MS) +
    BOOKINGS_COMPLETION_BUFFER_MS;

  return Math.max(DEFAULT_REQUEST_TIMEOUT_MS, estimatedMs);
}

function applyRequestTimeout(
  req: Request,
  res: Response,
  timeoutMs: number,
  onTimeout: () => void
): void {
  req.setTimeout(timeoutMs);
  req.socket.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs, onTimeout);
}

async function handleBookingsRequest(
  req: Request,
  res: Response,
  kind: BookingsRouteKind
): Promise<void> {
  const params = validateBookingParams(req.body);
  if (typeof params === "string") {
    sendJsonOnce(res, 400, { error: params });
    return;
  }

  const state: BookingsRequestState = {
    aborted: false,
    timedOut: false,
    disconnected: false,
  };
  const abortController = new AbortController();

  const abortWork = (reason: "timeout" | "disconnect") => {
    if (state.aborted) {
      return;
    }

    state.aborted = true;
    state.timedOut = reason === "timeout";
    state.disconnected = reason === "disconnect";
    abortController.abort();

    if (reason === "disconnect") {
      console.warn("Bookings request disconnected before completion");
    }
  };

  const onTimeout = () => {
    abortWork("timeout");
    sendJsonOnce(res, 408, { error: REQUEST_TIMEOUT_MESSAGE });
  };

  const onDisconnect = () => {
    if (!res.writableEnded) {
      abortWork("disconnect");
    }
  };

  const shouldAbort = () => state.aborted || res.writableEnded || res.headersSent;

  req.on("aborted", onDisconnect);
  res.on("close", onDisconnect);

  try {
    applyRequestTimeout(req, res, BOOKINGS_PREP_TIMEOUT_MS, onTimeout);

    const context = await prepareBookingsScrape(params, {
      signal: abortController.signal,
      shouldAbort,
    });

    if (state.aborted) {
      return;
    }

    const totalRequests = context.locations.length * context.days.length;
    const timeoutMs = calculateBookingsTimeoutMs(totalRequests);
    applyRequestTimeout(req, res, timeoutMs, onTimeout);

    console.log(
      `  Bookings timeout set to ${Math.ceil(timeoutMs / 60000)}m for ${totalRequests} requests`
    );

    const result = await scrapeBookingsWithContext(context, {
      signal: abortController.signal,
      shouldAbort,
    });

    if (state.aborted) {
      return;
    }

    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      if (kind === "all" || kind === "reserved") {
        await generateWorkbookFile(
          "reserved",
          result.locations,
          result.reserved,
          "bookings-reserved.xlsx"
        );
      }

      if (state.aborted) {
        return;
      }

      if (kind === "all" || kind === "blocked") {
        await generateWorkbookFile(
          "blocked",
          result.locations,
          result.blocked,
          "bookings-blocked.xlsx"
        );
      }

      if (state.aborted) {
        return;
      }

      if (kind === "all") {
        sendJsonOnce(res, 200, {
          files: ["bookings-reserved.xlsx", "bookings-blocked.xlsx"],
          reserved: countRows(result.reserved),
          blocked: countRows(result.blocked),
        });
        return;
      }

      if (kind === "reserved") {
        sendJsonOnce(res, 200, {
          files: ["bookings-reserved.xlsx"],
          reserved: countRows(result.reserved),
        });
        return;
      }

      sendJsonOnce(res, 200, {
        files: ["bookings-blocked.xlsx"],
        blocked: countRows(result.blocked),
      });
      return;
    }

    if (kind === "all") {
      sendJsonOnce(res, 200, {
        reserved: flattenMap(result.reserved, result.locations),
        blocked: flattenMap(result.blocked, result.locations),
      });
      return;
    }

    if (kind === "reserved") {
      sendJsonOnce(res, 200, flattenMap(result.reserved, result.locations));
      return;
    }

    sendJsonOnce(res, 200, flattenMap(result.blocked, result.locations));
  } catch (err) {
    if (state.aborted || res.headersSent || res.writableEnded) {
      if (state.timedOut) {
        console.warn("Bookings request timed out before completion");
      }
      return;
    }

    console.error(`Error in ${req.path}:`, err);
    sendJsonOnce(res, 500, { error: (err as Error).message });
  } finally {
    req.off("aborted", onDisconnect);
    res.off("close", onDisconnect);
  }
}

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

app.post("/api/services", async (req: Request, res: Response) => {
  const creds = validateCredentials(req.body);
  if (typeof creds === "string") {
    res.status(400).json({ error: creds });
    return;
  }

  try {
    const rows = await scrapeServices(creds);
    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      await generateServicesWorkbookFile(rows, "services.xlsx");
      res.json({
        files: ["services.xlsx"],
        services: rows.length,
      });
      return;
    }

    res.json(rows);
  } catch (err) {
    console.error("Error in /api/services:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/professionals", async (req: Request, res: Response) => {
  const creds = validateCredentials(req.body);
  if (typeof creds === "string") {
    res.status(400).json({ error: creds });
    return;
  }

  try {
    const result = await scrapeProfessionals(creds);
    const format = (req.query.format as string)?.toLowerCase();

    if (format === "xlsx") {
      const files = ["professionals.xlsx"];
      await generateProfessionalsWorkbookFile(result.sheets, "professionals.xlsx");

      if (result.hasMultipleSucursales) {
        await generateSucursalesWorkbookFile(result.sucursales, "sucursales.xlsx");
        files.push("sucursales.xlsx");
      }

      res.json({
        files,
        professionals: result.professionals.length,
        sucursales: result.sucursales.length,
      });
      return;
    }

    res.json({
      professionals: result.professionals,
      sucursales: result.sucursales,
    });
  } catch (err) {
    console.error("Error in /api/professionals:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/bookings", async (req: Request, res: Response) => {
  await handleBookingsRequest(req, res, "all");
});

app.post("/api/bookings/reserved", async (req: Request, res: Response) => {
  await handleBookingsRequest(req, res, "reserved");
});

app.post("/api/bookings/blocked", async (req: Request, res: Response) => {
  await handleBookingsRequest(req, res, "blocked");
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`AgendaPro API server listening on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /api/locations");
  console.log("  POST /api/services           (?format=json|xlsx)");
  console.log("  POST /api/professionals      (?format=json|xlsx)");
  console.log("  POST /api/bookings           (?format=json|xlsx)  - both reserved + blocked");
  console.log("  POST /api/bookings/reserved  (?format=json|xlsx)");
  console.log("  POST /api/bookings/blocked   (?format=json|xlsx)");
});


