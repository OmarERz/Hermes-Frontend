/**
 * Text for people from the telemetry values. Costs and percentages arrive as decimal text (FRONTEND.md §5): they are
 * shown, never added up; a missing value reads «Sin datos», never zero.
 */

export const NO_DATA = 'Sin datos';

const INTEGER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const USD_SMALL = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const USD = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DAY = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? NO_DATA : INTEGER.format(value);
}

/** A percentage given as text ("93.5") with its sign; null (nothing to divide) is «Sin datos». */
export function formatPercent(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? NO_DATA : `${value} %`;
}

/** A dollar amount given as text; small amounts keep up to four decimals so a cent fraction is not shown as zero. */
export function formatUsd(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return NO_DATA;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return (Math.abs(amount) < 1 ? USD_SMALL : USD).format(amount);
}

/** Latency of an LLM call: milliseconds under a second, seconds with one decimal above. */
export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return NO_DATA;
  return ms < 1000 ? `${INTEGER.format(ms)} ms` : `${ONE_DECIMAL.format(ms / 1000)} s`;
}

/** Duration of an event in whole seconds; null means it has not finished. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'Sin terminar';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

/** Hours given as text ("12.5"). */
export function formatHours(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? NO_DATA : `${value} h`;
}

/** A UTC day of the daily series (`AAAA-MM-DD`) as "27 nov". */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : DAY.format(date);
}

/** A signed whole number: +5, −3, 0. */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

/**
 * The `<input type="date">` value of a filter as an RFC 3339 instant in the person's time zone: the start of the day
 * (`from`) or its last millisecond (`to`). An empty or invalid value means no filter.
 */
export function dayBoundary(value: string, edge: 'from' | 'to'): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date =
    edge === 'from'
      ? new Date(year, month, day, 0, 0, 0, 0)
      : new Date(year, month, day, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
