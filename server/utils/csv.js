// Escapes a value for CSV: wraps in quotes when needed, doubles inner quotes,
// and neutralises spreadsheet formulas (CSV injection) like "=HYPERLINK(...)".
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
