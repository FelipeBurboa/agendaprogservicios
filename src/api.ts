import type {
  AgendaProServiceCategory,
  BookingsResponse,
  Location,
  LocationsResponse,
} from "./types.js";

const API_BASE = "https://agendapro.com/api/views/admin/v2";
const DEFAULT_FROM_URL = "https://app.agendapro.com/bookings";

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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiGet<T>(
  token: string,
  path: string,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${API_BASE}/${path}`, {
      headers: apiHeaders(token),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const wait = 2 ** (attempt + 1) * 1000;
      console.log(
        `    HTTP ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries})...`
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  throw new Error("API request failed after exhausting retries");
}

export async function fetchLocations(token: string): Promise<Location[]> {
  console.log("Fetching locations...");
  const data = await apiGet<LocationsResponse>(
    token,
    "calendar/locations?per_page=8&search_key=&page=1"
  );
  console.log(`  Found ${data.locations.length} locations`);
  return data.locations;
}

export async function fetchAllBookings(
  token: string,
  locationId: number,
  start: string,
  end: string
): Promise<BookingsResponse> {
  const basePath = `calendar/bookings?start=${start}&end=${end}&location_id=${locationId}&time_resource=false&per_page=100`;
  const data = await apiGet<BookingsResponse>(token, `${basePath}&page=1`);
  const allUsers = [...data.calendar_users_events];
  const totalPages = data.total_pages ?? 1;

  for (let page = 2; page <= totalPages; page++) {
    await sleep(300);
    const pageData = await apiGet<BookingsResponse>(
      token,
      `${basePath}&page=${page}`
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
    "service_categories/index_opt?service_active=1"
  );
  console.log(`  Found ${categories.length} service categories`);
  return categories;
}
