/** Date-only arithmetic uses UTC internally so DST never shifts a planning day. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function today(clock: () => Date = () => new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(clock());
}

export function addDays(date: string, days: number): string {
  if (!isDateOnly(date) || !Number.isInteger(days))
    throw new Error("Invalid planning date");
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  if (!isDateOnly(start) || !isDateOnly(end))
    throw new Error("Invalid planning date");
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86400000,
  );
}

export function taskDate(
  eventDate: string,
  daysBefore: number,
  start: string,
): string {
  const intended = addDays(eventDate, -daysBefore);
  return intended < start ? start : intended;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
