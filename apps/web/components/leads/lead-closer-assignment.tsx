"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { LeadSummary, UserSummary } from "@orbit/contracts";
import { Button } from "@orbit/ui";
import { assignLeadCloser } from "../../lib/api-client";
import { Dialog } from "../ui/dialog";

export function LeadCloserAssignment({ lead, closers }: { lead: LeadSummary; closers: UserSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(lead.responsibleCloserId ?? "");
  const [version, setVersion] = useState(lead.version);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [open, setOpen] = useState(false);

  async function save() {
    if (!selected || pending) return;
    setPending(true);
    setNotice(undefined);
    try {
      const updated = await assignLeadCloser(lead.id, selected, version);
      setVersion(updated.version);
      setNotice("Closer assigned to this application.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Closer could not be assigned.");
    } finally {
      setPending(false);
    }
  }

  const unchanged = selected === (lead.responsibleCloserId ?? "");
  const assigned = Boolean(lead.responsibleCloserId);

  return <><Button onClick={() => { setSelected(lead.responsibleCloserId ?? ""); setNotice(undefined); setOpen(true); }} size="sm" variant="secondary">{assigned ? "Change closer" : "Assign closer"}</Button><Dialog description="Choose the Closer responsible for this application’s interview calls." onOpenChange={setOpen} open={open} title={assigned ? "Change responsible Closer" : "Assign responsible Closer"}><div className="grid gap-4"><div><label className="text-sm font-semibold text-foreground" htmlFor="lead-closer">Responsible Closer</label><select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" disabled={pending} id="lead-closer" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select an eligible Closer</option>{closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.displayName} · {closer.email}</option>)}</select></div><div className="flex justify-end gap-2"><Button disabled={pending} onClick={() => setOpen(false)} variant="ghost">Cancel</Button><Button disabled={!selected || unchanged || pending} loading={pending} onClick={() => void save()}>{pending ? "Saving…" : "Save closer"}</Button></div>{notice ? <p className="text-sm font-semibold text-danger" role="status">{notice}</p> : null}</div></Dialog></>;
}
