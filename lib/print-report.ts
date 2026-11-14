function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openPrintableReport(title: string, headers: string[], rows: string[][], target?: Window | null) {
  const report = target === undefined ? window.open("", "_blank") : target;
  if (!report) throw new Error("O navegador bloqueou a janela. Permita pop-ups para gerar o PDF.");

  const tableHead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tableBody = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const printedAt = new Date().toLocaleString("pt-BR");

  report.document.open();
  report.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { color: #17211d; font: 10px Arial, sans-serif; margin: 0; }
    h1 { font-size: 19px; margin: 0 0 4px; }
    .meta { color: #53635c; margin-bottom: 14px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8e1dc; padding: 5px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #eef5f1; font-weight: 700; }
    tr { page-break-inside: avoid; }
    @media screen { body { margin: 24px; } }
  </style></head><body><h1>${escapeHtml(title)}</h1><p class="meta">${rows.length} registros · Gerado em ${escapeHtml(printedAt)} · No diálogo de impressão, escolha “Salvar como PDF”.</p><table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table></body></html>`);
  report.document.close();
  window.setTimeout(() => { if (!report.closed) { report.focus(); report.print(); } }, 700);
}
