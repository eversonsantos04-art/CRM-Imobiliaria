export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
