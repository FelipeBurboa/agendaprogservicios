import type {
  AgendaProCommissionProvider,
  AgendaProLocationDetail,
  AgendaProProductCommission,
  AgendaProServiceCategory,
  AgendaProServiceCommission,
  AgendaProServiceProvider,
  BookingsResponse,
  Location,
  LocationsResponse,
  ProductInventoryItem,
  ProductInventoryResponse,
} from "./types.js";

const API_BASE = "https://ap-api.agendapro.com/agenda-core-bff";
const API_BASE_LEGACY = "https://agendapro.com/api/views/admin";
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
  signal?: AbortSignal,
  baseUrl = API_BASE
): Promise<T> {
  const url = `${baseUrl}/${path}`;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    throwIfAborted(signal);

    let res: Response;
    try {
      res = await fetch(url, {
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

    const responseBody = await res.text().catch(() => "(unable to read body)");
    console.error(`  API error: ${res.status} ${res.statusText} — ${url}`);
    console.error(`  Response body: ${responseBody.slice(0, 500)}`);

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
    "v1/calendar/locations?per_page=8&search_key=&page=1",
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
  const locations = await apiGet<AgendaProLocationDetail[]>(token, "v1/locations", 3, undefined, API_BASE_LEGACY);
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
  const data = await apiGet<BookingsResponse>(token, `${basePath}&page=1`, 3, signal, API_BASE_LEGACY);
  const allUsers = [...data.calendar_users_events];
  const totalPages = data.total_pages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    await sleep(300, signal);
    const pageData = await apiGet<BookingsResponse>(
      token,
      `${basePath}&page=${page}`,
      3,
      signal,
      API_BASE_LEGACY
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
    "v2/service_categories/index_opt?service_active=1",
    3,
    undefined,
    API_BASE_LEGACY
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
    "v2/service_providers/index_opt?active=1&location_id=-1&public_name=",
    3,
    undefined,
    API_BASE_LEGACY
  );
  console.log(`  Found ${providers.length} professionals`);
  return providers;
}

/**
 * Providers that have at least one service commission configured. Company-wide,
 * not location-scoped, and unpaginated.
 */
export async function fetchCommissionProviders(
  token: string,
  signal?: AbortSignal
): Promise<AgendaProCommissionProvider[]> {
  console.log("Fetching commission providers...");
  const providers = await apiGet<AgendaProCommissionProvider[]>(
    token,
    "v1/commissions/service_provider",
    3,
    signal,
    API_BASE_LEGACY
  );
  console.log(`  Found ${providers.length} providers with commissions`);
  return providers;
}

export async function fetchProviderServiceCommissions(
  token: string,
  providerId: number,
  signal?: AbortSignal
): Promise<AgendaProServiceCommission[]> {
  return apiGet<AgendaProServiceCommission[]>(
    token,
    `v1/commissions/service_provider/${providerId}`,
    3,
    signal,
    API_BASE_LEGACY
  );
}

/** Product commissions are company-wide — one value per product, no provider. */
export async function fetchProductCommissions(
  token: string,
  signal?: AbortSignal
): Promise<AgendaProProductCommission[]> {
  console.log("Fetching product commissions...");
  const products = await apiGet<AgendaProProductCommission[]>(
    token,
    "v1/commissions/product",
    3,
    signal,
    API_BASE_LEGACY
  );
  console.log(`  Found ${products.length} products with commission config`);
  return products;
}

/**
 * Fetch every inventory product for a single location, following pagination.
 * The /products/inventory endpoint is location-scoped: each item's
 * `location_products_attributes` carries only the queried location's stock.
 */
export async function fetchAllProducts(
  token: string,
  locationId: number,
  options: { active?: boolean } = {},
  signal?: AbortSignal
): Promise<ProductInventoryItem[]> {
  const activeFlag = options.active === false ? "" : "1";
  const basePath =
    `v1/products/inventory?name=&location_id=${locationId}` +
    `&brand_ids=&category_ids=&display_ids=&per_page=100&active=${activeFlag}`;

  const first = await apiGet<ProductInventoryResponse>(
    token,
    `${basePath}&page=1`,
    3,
    signal,
    API_BASE_LEGACY
  );

  const products = [...(first.products ?? [])];
  const totalPages = first.total_pages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    await sleep(300, signal);
    const pageData = await apiGet<ProductInventoryResponse>(
      token,
      `${basePath}&page=${page}`,
      3,
      signal,
      API_BASE_LEGACY
    );
    products.push(...(pageData.products ?? []));
  }

  return products;
}
