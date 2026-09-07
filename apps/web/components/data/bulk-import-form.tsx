"use client";

import { useState } from "react";
import { Button, Card, Input } from "@orbit/ui";
import { importCandidatesCsv, importLeadsCsv } from "../../lib/api-client";

type ImportKind = "candidate" | "lead";
type RowError = { row: number; message: string };

export function BulkImportForm({ kind, onComplete, surface = true }: { kind: ImportKind; onComplete?: () => void; surface?: boolean }) {
  const [file, setFile] = useState<File>(); const [pending, setPending] = useState(false); const [errors, setErrors] = useState<RowError[]>([]); const [notice, setNotice] = useState<string>();
  async function importRows() {
    if (!file || pending) return; setPending(true); setErrors([]); setNotice(undefined);
    try { const rowErrors: RowError[] = []; let imported = 0;
      const result = kind === "candidate" ? await importCandidatesCsv(await file.text()) : await importLeadsCsv(await file.text());
      imported = result.imported; rowErrors.push(...result.errors);
      setErrors(rowErrors); setNotice(`${imported} imported, ${rowErrors.length} failed`); if (imported) onComplete?.();
    } catch (cause) { setErrors([{ row: 1, message: cause instanceof Error ? cause.message : "CSV could not be parsed." }]); } finally { setPending(false); }
  }
  const example = kind === "candidate" ? "first_name,last_name,email,timezone\nAvery,Chen,avery@example.com,UTC" : "profile_id,company_id,current_owner_id,source_id,job_title,raw_url,applied_date";
  const content = <><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-base font-bold text-foreground">Bulk import {kind}s</h2><p className="mt-1 text-sm text-muted-foreground">CSV only · maximum 5 MB and 1,000 rows. Invalid rows are reported individually.</p></div><a className="text-xs font-semibold text-primary hover:underline" download={`orbit-${kind}-import-example.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(example)}`}>Download template</a></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><Input accept=".csv,text/csv" aria-label={`Select ${kind} CSV`} disabled={pending} onChange={(event) => setFile(event.target.files?.[0])} type="file" /><Button disabled={!file || pending} onClick={() => void importRows()}>{pending ? "Importing…" : "Import CSV"}</Button></div>{notice ? <p className="mt-3 text-sm font-semibold text-success" role="status">{notice}</p> : null}{errors.length ? <ul className="mt-3 grid gap-1 text-sm text-danger" aria-label="Import errors">{errors.map((error) => <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>)}</ul> : null}</>;
  return surface ? <Card className="p-5">{content}</Card> : <div>{content}</div>;
}
