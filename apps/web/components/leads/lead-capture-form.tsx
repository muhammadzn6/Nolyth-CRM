"use client";

import { useState } from "react";
import type { ProfileSummary } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";
import { ApiClientError, createApplicationIntake } from "../../lib/api-client";

export function LeadCaptureForm({ actorId, profiles, embedded = false }: { actorId: string; profiles: ProfileSummary[]; embedded?: boolean }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [values, setValues] = useState({ companyName: "", jobTitle: "", rawUrl: "", recruiterName: "", recruiterEmail: "", duplicateOverrideReason: "" });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [needsDuplicateOverride, setNeedsDuplicateOverride] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(undefined); setError(undefined);
    try {
      const result = await createApplicationIntake({ profileId, companyName: values.companyName, jobTitle: values.jobTitle, rawUrl: values.rawUrl, recruiterName: values.recruiterName, recruiterEmail: values.recruiterEmail, ...(values.duplicateOverrideReason.trim() ? { duplicateOverrideReason: values.duplicateOverrideReason } : {}) });
      setNotice(result.duplicate.classification === "CONFIRMED" ? "Application saved for traceability; it does not count toward your target." : result.duplicate.classification === "LIKELY" ? "Application added with a pending duplicate review." : "Application added to the pipeline"); setValues({ companyName: "", jobTitle: "", rawUrl: "", recruiterName: "", recruiterEmail: "", duplicateOverrideReason: "" }); setNeedsDuplicateOverride(false);
    } catch (cause) { const warning = cause instanceof ApiClientError && cause.code === "CONFLICT" && typeof cause.details === "object" && cause.details !== null && "duplicate" in cause.details; setNeedsDuplicateOverride(warning); setError(cause instanceof ApiClientError ? cause.message : "Application could not be added."); }
    finally { setPending(false); }
  }

  const form = <form aria-label="Add application" className="grid gap-4" onSubmit={submit}><div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0"><Field htmlFor="lead-profile" label="Candidate profile"><select className="min-h-10 w-full min-w-0 max-w-full truncate rounded-lg border border-border bg-background px-3 text-sm text-foreground" id="lead-profile" onChange={(event) => setProfileId(event.target.value)} required value={profileId}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></Field><Field htmlFor="lead-job-title" label="Job title"><Input id="lead-job-title" onChange={(event) => set("jobTitle", event.target.value)} required value={values.jobTitle} /></Field><Field htmlFor="lead-company-name" label="Company"><Input id="lead-company-name" onChange={(event) => set("companyName", event.target.value)} required value={values.companyName} /></Field><Field htmlFor="lead-url" label="JD link"><Input id="lead-url" onChange={(event) => set("rawUrl", event.target.value)} required type="url" value={values.rawUrl} /></Field></div><details className="rounded-xl border border-border bg-surface-subtle px-4 py-3" open><summary className="cursor-pointer text-sm font-semibold text-foreground">Recruiter details</summary><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0"><Field htmlFor="lead-recruiter-name" label="Recruiter name"><Input id="lead-recruiter-name" onChange={(event) => set("recruiterName", event.target.value)} required value={values.recruiterName} /></Field><Field htmlFor="lead-recruiter-email" label="Recruiter email"><Input id="lead-recruiter-email" onChange={(event) => set("recruiterEmail", event.target.value)} required type="email" value={values.recruiterEmail} /></Field></div></details>{needsDuplicateOverride ? <div className="rounded-xl border border-warning/40 bg-warning-soft p-4"><p className="text-sm font-semibold text-foreground">Likely duplicate</p><p className="mt-1 text-sm text-muted-foreground">Add a reason to save this application for Admin review. It will count provisionally until reviewed.</p><div className="mt-3"><Field htmlFor="lead-duplicate-override" label="Override reason"><Input autoFocus id="lead-duplicate-override" onChange={(event) => set("duplicateOverrideReason", event.target.value)} required value={values.duplicateOverrideReason} /></Field></div></div> : null}<div className={`${embedded ? "sticky bottom-0 -mx-1 bg-surface/95 py-3 backdrop-blur" : "pt-1"} flex items-center justify-end gap-3`}>{notice ? <p className="mr-auto text-sm font-semibold text-success" role="status">{notice}</p> : null}{error ? <p className="mr-auto text-sm font-semibold text-danger" role="alert">{error}</p> : null}<Button disabled={pending || !profileId} type="submit">{pending ? "Adding…" : "Add application"}</Button></div></form>;

  return embedded ? form : <Card className="p-5 sm:p-6"><header><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">BD intake</p><h2 className="mt-2 text-lg font-bold text-foreground">Add application</h2><p className="mt-1 text-sm text-muted-foreground">Capture the job and recruiter details in under a minute.</p></header><div className="mt-5">{form}</div></Card>;
}
