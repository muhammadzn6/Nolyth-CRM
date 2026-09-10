"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { LeadDetail } from "@orbit/contracts";
import { Button, Field, Input } from "@orbit/ui";
import { updateLead } from "../../lib/api-client";
import { Dialog } from "../ui/dialog";

export function LeadEditAction({ lead }: { lead: LeadDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [values, setValues] = useState({
    jobTitle: lead.jobTitle,
    rawUrl: lead.rawUrl,
    location: lead.location ?? "",
    workplaceType: lead.workplaceType ?? "",
    employmentType: lead.employmentType ?? "",
    contractType: lead.contractType ?? "",
    description: lead.description ?? "",
  });

  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await updateLead(lead.id, {
        jobTitle: values.jobTitle,
        rawUrl: values.rawUrl,
        location: values.location.trim() || null,
        workplaceType: values.workplaceType.trim() || null,
        employmentType: values.employmentType.trim() || null,
        contractType: values.contractType.trim() || null,
        description: values.description.trim() || null,
        expectedVersion: lead.version,
      });
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The application could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <><Button onClick={() => { setError(undefined); setOpen(true); }} size="sm" variant="secondary">Edit application</Button><Dialog description="Keep the role details accurate without leaving the application workspace." onOpenChange={setOpen} open={open} title="Edit application"><form className="grid gap-5" onSubmit={submit}><div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0"><Field htmlFor="edit-lead-title" label="Job title"><Input id="edit-lead-title" onChange={(event) => set("jobTitle", event.target.value)} required value={values.jobTitle} /></Field><Field htmlFor="edit-lead-url" label="JD link"><Input id="edit-lead-url" onChange={(event) => set("rawUrl", event.target.value)} required type="url" value={values.rawUrl} /></Field><Field htmlFor="edit-lead-location" label="Location"><Input id="edit-lead-location" onChange={(event) => set("location", event.target.value)} value={values.location} /></Field><Field htmlFor="edit-lead-workplace" label="Workplace"><Input id="edit-lead-workplace" onChange={(event) => set("workplaceType", event.target.value)} placeholder="Remote, hybrid, or onsite" value={values.workplaceType} /></Field><Field htmlFor="edit-lead-employment" label="Employment"><Input id="edit-lead-employment" onChange={(event) => set("employmentType", event.target.value)} placeholder="Full-time, part-time…" value={values.employmentType} /></Field><Field htmlFor="edit-lead-contract" label="Contract"><Input id="edit-lead-contract" onChange={(event) => set("contractType", event.target.value)} value={values.contractType} /></Field></div><Field htmlFor="edit-lead-notes" label="Notes"><textarea className="min-h-28 w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-focus/15" id="edit-lead-notes" onChange={(event) => set("description", event.target.value)} value={values.description} /></Field>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}<div className="flex justify-end gap-2 border-t border-border pt-4"><Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button><Button disabled={pending} loading={pending} type="submit">{pending ? "Saving…" : "Save changes"}</Button></div></form></Dialog></>;
}
