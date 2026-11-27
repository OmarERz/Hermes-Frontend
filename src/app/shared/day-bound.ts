/**
 * A `<input type="date">` value (YYYY-MM-DD, the person's local day) as an RFC 3339 UTC instant for the API's
 * `date_from` / `date_to` filters: the start of that local day, or its last millisecond when `end` is true. Any
 * other text gives null (the filter is left out).
 */
export function dayBound(day: string, end: boolean): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!parts) return null;
  const [year, month, date] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
  const moment = end
    ? new Date(year, month, date, 23, 59, 59, 999)
    : new Date(year, month, date, 0, 0, 0, 0);
  return moment.toISOString();
}
