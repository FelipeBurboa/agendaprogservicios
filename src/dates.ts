export function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Yield each day from start up to (and including) end. */
export function* dailyChunks(start: Date, end: Date): Generator<string> {
  const cursor = new Date(start);
  while (cursor <= end) {
    yield fmtDate(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
}
