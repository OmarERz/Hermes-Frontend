/**
 * CSV export safe against formula injection (OWASP "CSV Injection"): a cell that a spreadsheet would run as a
 * formula (it starts with =, +, -, @, a tab or a carriage return, also after leading spaces) gets a leading
 * apostrophe, so Excel, LibreOffice and Google Sheets show it as text. Every cell is quoted.
 */
const FORMULA_START = /^(?:[\t\r]|\s*[=+\-@])/;

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Rows to CSV text (CRLF line ends, as RFC 4180). */
export function toCsv(
  rows: readonly (readonly (string | number | boolean | null | undefined)[])[],
): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}
