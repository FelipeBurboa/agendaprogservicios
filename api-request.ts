import { readFileSync, writeFileSync } from 'fs';

// --- Auth types ---

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

interface AuthState {
  cookies: Cookie[];
}

// --- Locations types ---

interface Location {
  label: string;
  value: number;
}

interface LocationsResponse {
  locations: Location[];
  page: number;
  total_pages: number;
  total_filtered: number;
  per_page: number;
}

// --- Bookings types ---

interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo: string | null;
  identification_number: string;
  address: string;
  district: string;
  city: string;
  birth_date: string | null;
  is_new_client: boolean;
  whatsapp_link: string;
  whatsapp_link_with_message: string;
  birthday: boolean;
}

interface Professional {
  value: number;
  label: string;
  photo: string;
}

interface Service {
  name: string;
  id: number;
  videocall: boolean;
  list_price: number;
  duration: number;
  discount: number | null;
}

interface Booking {
  id: number;
  payment_id: number | null;
  cart_id: number | null;
  entity_identifier: string | null;
  marketplace_origin: boolean;
  payment_membership_id: number | null;
  status_id: number;
  paid_amount: number | null;
  client: Client;
  professional: Professional;
  service_resource: { label: string | null; value: number | null };
  comment: string;
  client_notes: string;
  payment_status: string;
  amount: number;
  price: number;
  tags: string[];
  service_provider_selected_by_client: boolean;
  provider_lock: boolean;
  updated_at: string;
  additionals: unknown[];
  service: Service;
  time_resource: unknown | null;
  bundle: unknown | null;
  session: unknown | null;
  plan: unknown | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'RESERVED' | 'BLOCKED' | 'BREAK';
  resourceId?: number;
  description?: string;
  isGoogleEvent?: boolean;
  breakGroup?: boolean;
  breakRepeat?: boolean;
  booking_group_repeat?: unknown | null;
  booking?: Booking;
}

interface CalendarUser {
  id: number;
  first_name: string;
  last_name: string;
  photo: string;
  block_length: number;
  events: CalendarEvent[];
}

interface BookingsResponse {
  calendar_users_events: CalendarUser[];
  page: number;
  total_pages: number;
  total_filtered: number;
  per_page: number;
}

// --- Helper ---

function getAuthToken(): string {
  const authState: AuthState = JSON.parse(
    readFileSync('auth-state.json', 'utf-8')
  );
  const authCookie = authState.cookies.find(
    (c) => c.name === 'ap_cognito_authorization'
  );
  if (!authCookie) {
    throw new Error('No authorization cookie found in auth-state.json');
  }
  return authCookie.value.replace(/^Bearer\s+/, '');
}

function apiHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/json',
    authorization: token,
    origin: 'https://app.agendapro.com',
    referer: 'https://app.agendapro.com/',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'Authorization',
    from: btoa('https://app.agendapro.com/bookings'),
  };
}

// --- API calls ---

async function fetchLocations(token: string): Promise<Location[]> {
  console.log('Fetching locations...');
  const res = await fetch(
    'https://agendapro.com/api/views/admin/v2/calendar/locations?per_page=8&search_key=&page=1',
    { headers: apiHeaders(token) }
  );
  if (!res.ok) throw new Error(`Locations request failed: ${res.status}`);
  const data: LocationsResponse = await res.json();
  console.log(`  Found ${data.locations.length} locations`);
  return data.locations;
}

async function fetchBookings(
  token: string,
  locationId: number,
  start: string,
  end: string
): Promise<BookingsResponse> {
  const url =
    `https://agendapro.com/api/views/admin/v2/calendar/bookings` +
    `?start=${start}&end=${end}&location_id=${locationId}` +
    `&time_resource=false&per_page=100&page=1`;

  const res = await fetch(url, { headers: apiHeaders(token) });
  if (!res.ok) throw new Error(`Bookings request failed: ${res.status}`);
  return res.json();
}

// --- Main ---

async function main(): Promise<void> {
  const token = getAuthToken();

  // 1. Fetch and save locations
  const locations = await fetchLocations(token);
  writeFileSync('locations.json', JSON.stringify(locations, null, 2));
  console.log('  Saved to locations.json\n');

  for (const loc of locations) {
    console.log(`  - ${loc.label} (id: ${loc.value})`);
  }

  // 2. Fetch bookings for each location (current week: Mon Feb 2 - Sun Feb 8)
  const start = '2026-02-02';
  const end = '2026-02-08';

  console.log(`\nFetching bookings for week ${start} to ${end}...\n`);

  const reserved: Record<string, CalendarUser[]> = {};
  const blockedBreaks: Record<string, CalendarUser[]> = {};

  for (const loc of locations) {
    console.log(`  [${loc.label}] (location_id=${loc.value})`);
    const bookings = await fetchBookings(token, loc.value, start, end);

    // Split events per professional into RESERVED vs BLOCKED/BREAK
    const reservedUsers: CalendarUser[] = [];
    const blockedUsers: CalendarUser[] = [];

    for (const user of bookings.calendar_users_events) {
      const reservedEvents = user.events.filter((e) => e.type === 'RESERVED');
      const blockedEvents = user.events.filter((e) => e.type === 'BLOCKED' || e.type === 'BREAK');

      if (reservedEvents.length > 0) {
        reservedUsers.push({ ...user, events: reservedEvents });
      }
      if (blockedEvents.length > 0) {
        blockedUsers.push({ ...user, events: blockedEvents });
      }
    }

    reserved[loc.value] = reservedUsers;
    blockedBreaks[loc.value] = blockedUsers;

    const totalReserved = reservedUsers.reduce((s, u) => s + u.events.length, 0);
    const totalBlocked = blockedUsers.reduce((s, u) => s + u.events.length, 0);

    console.log(`    Reserved: ${totalReserved} | Blocked/Breaks: ${totalBlocked}\n`);
  }

  // 3. Save split files
  writeFileSync('bookings-reserved.json', JSON.stringify(reserved, null, 2));
  console.log('Reserved bookings saved to bookings-reserved.json');

  writeFileSync('bookings-blocked.json', JSON.stringify(blockedBreaks, null, 2));
  console.log('Blocked/Breaks saved to bookings-blocked.json');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
