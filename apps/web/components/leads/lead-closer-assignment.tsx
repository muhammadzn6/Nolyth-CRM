"use client";

import { useState } from "react";

import type { LeadSummary, UserSummary } from "@orbit/contracts";
import { Button, Card } from "@orbit/ui";
import { assignLeadCloser } from "../../lib/api-client";

export function LeadCloserAssignment({ lead, closers }: { lead: LeadSummary; closers: UserSummary[] }) {
  const [selected, setSelected] = useState(lead.responsibleCloserId ?? "");
  const [version, setVersion] = useState(lead.version);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function save() {
    if (!selected || pending) return;
    setPending(true);
    setNotice(undefined);
    try {
      const updated = await assignLeadCloser(lead.id, selected, version);
      setVersion(updated.version);
      setNotice("Closer assigned to this application.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Closer could not be assigned.");
    } finally {
      setPending(false);
    }
  }

  return <Card className="p-5"><h2 className="text-base font-bold text-foreground">Interview ownership</h2><p className="mt-1 text-sm text-muted-foreground">Assign the Closer who will take calls for this application. Calendar access comes from the candidate profile.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="lead-closer">Application Closer</label><select className="min-h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm" disabled={pending} id="lead-closer" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select an eligible Closer</option>{closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.displayName} · {closer.email}</option>)}</select><Button disabled={!selected || pending} onClick={() => void save()}>{pending ? "Assigning…" : "Assign Closer"}</Button></div>{notice ? <p className="mt-3 text-sm font-semibold text-primary" role="status">{notice}</p> : null}</Card>;
}
