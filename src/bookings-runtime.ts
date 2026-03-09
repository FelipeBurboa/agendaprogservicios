export const BOOKINGS_MIN_TIMEOUT_MS = 5 * 60 * 1000;
export const BOOKINGS_THROTTLE_MS = 300;
export const BOOKINGS_REQUEST_OVERHEAD_MS = 1000;
export const BOOKINGS_COMPLETION_BUFFER_MS = 2 * 60 * 1000;

export function calculateBookingsEstimatedMs(totalRequests: number): number {
  return (
    totalRequests * (BOOKINGS_THROTTLE_MS + BOOKINGS_REQUEST_OVERHEAD_MS) +
    BOOKINGS_COMPLETION_BUFFER_MS
  );
}

export function calculateBookingsTimeoutMs(totalRequests: number): number {
  return Math.max(BOOKINGS_MIN_TIMEOUT_MS, calculateBookingsEstimatedMs(totalRequests));
}

export function formatDurationMs(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}
