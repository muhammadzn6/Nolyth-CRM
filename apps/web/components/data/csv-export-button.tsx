"use client";

import { Button } from "@orbit/ui";

function escapeCell(value: unknown): string { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function CsvExportButton({ filename, columns, rows }: { filename: string; columns: ReadonlyArray<{ key: string; label: string }>; rows: ReadonlyArray<Record<string, unknown>> }) {
  function download() { const csv = [columns.map((column) => escapeCell(column.label)).join(","), ...rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
  return <Button disabled={rows.length === 0} onClick={download} variant="secondary">Export CSV</Button>;
}
