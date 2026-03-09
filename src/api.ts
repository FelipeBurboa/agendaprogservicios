import type {
  AgendaProLocationDetail,
  AgendaProServiceCategory,
  AgendaProServiceProvider,
  BookingsResponse,
  Location,
  LocationsResponse,
} from "./types.js";

const API_BASE = "https://agendapro.com/api/views/admin";
const DEFAULT_FROM_URL = "https://app.agendapro.com/bookings";

export class RequestAbortedError extends Error {
  constructor(message = "Request aborted") {
    super(message);
    this.name = "RequestAbortedError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof RequestAbortedError ||
    (error instanceof Error && error.name === "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RequestAbortedError();
  }
}

export function apiHeaders(token: string): Record<string, string> {
  return {
    accept: "application/json",
    authorization: token,
    origin: "https://app.agendapro.com",
    referer: "https://app.agendapro.com/",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "Authorization",
    from: btoa(DEFAULT_FROM_URL),
  };
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new RequestAbortedError());
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function apiGet<T>(
  token: string,
  path: string,
  maxRetries = 3,
  signal?: AbortSignal
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    throwIfAborted(signal);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${path}`, {
        headers: apiHeaders(token),
        signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw error;
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const wait = 2 ** (attempt + 1) * 1000;
      console.log(
        `    HTTP ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries})...`
      );
      await sleep(wait, signal);
      continue;
    }

    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  throw new Error("API request failed after exhausting retries");
}

export async function fetchLocations(
  token: string,
  signal?: AbortSignal
): Promise<Location[]> {
  console.log("Fetching calendar locations...");
  const data = await apiGet<LocationsResponse>(
    token,
    "v2/calendar/locations?per_page=8&search_key=&page=1",
    3,
    signal
  );
  console.log(`  Found ${data.locations.length} locations`);
  return data.locations;
}

export async function fetchAdminLocations(
  token: string
): Promise<AgendaProLocationDetail[]> {
  console.log("Fetching sucursales...");
  const locations = await apiGet<AgendaProLocationDetail[]>(token, "v1/locations");
  console.log(`  Found ${locations.length} sucursales`);
  return locations;
}

export async function fetchAllBookings(
  token: string,
  locationId: number,
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<BookingsResponse> {
  const basePath = `v2/calendar/bookings?start=${start}&end=${end}&location_id=${locationId}&time_resource=false&per_page=100`;
  const data = await apiGet<BookingsResponse>(token, `${basePath}&page=1`, 3, signal);
  const allUsers = [...data.calendar_users_events];
  const totalPages = data.total_pages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    await sleep(300, signal);
    const pageData = await apiGet<BookingsResponse>(
      token,
      `${basePath}&page=${page}`,
      3,
      signal
    );
    allUsers.push(...pageData.calendar_users_events);
  }

  data.calendar_users_events = allUsers;
  return data;
}

export async function fetchServiceCategories(
  token: string
): Promise<AgendaProServiceCategory[]> {
  console.log("Fetching service categories...");
  const categories = await apiGet<AgendaProServiceCategory[]>(
    token,
    "v2/service_categories/index_opt?service_active=1"
  );
  console.log(`  Found ${categories.length} service categories`);
  return categories;
}

export async function fetchServiceProviders(
  token: string
): Promise<AgendaProServiceProvider[]> {
  console.log("Fetching professionals...");
  const providers = await apiGet<AgendaProServiceProvider[]>(
    token,
    "v2/service_providers/index_opt?active=1&location_id=-1&public_name="
  );
  console.log(`  Found ${providers.length} professionals`);
  return providers;
}
