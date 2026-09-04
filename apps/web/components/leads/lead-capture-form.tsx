"use client";

import { useState } from "react";
import type { CreateLead, ProfileSummary } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";
import { ApiClientError, createLead } from "../../lib/api-client";

export function LeadCaptureForm({ actorId, profiles }: { actorId: string; profiles: ProfileSummary[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [values, setValues] = useState({ companyName: "", jobTitle: "", rawUrl: "", appliedDate: new Date().toISOString().slice(0, 10), recruiterName: "", recruiterEmail: "" });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(undefined); setError(undefined);
    try {
      const input = { profileId, currentOwnerId: actorId, companyName: values.companyName, jobTitle: values.jobTitle, rawUrl: values.rawUrl, appliedDate: values.appliedDate, ...(values.recruiterName ? { recruiterName: values.recruiterName } : {}), ...(values.recruiterEmail ? { recruiterEmail: values.recruiterEmail } : {}) } as unknown as CreateLead;
      await createLead(input);
      setNotice("Application added to the pipeline"); setValues({ companyName: "", jobTitle: "", rawUrl: "", appliedDate: new Date().toISOString().slice(0, 10), recruiterName: "", recruiterEmail: "" });
      window.location.reload();
    } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : "Application could not be added."); }
    finally { setPending(false); }
  }

  return <Card className="p-5 sm:p-6"><header><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">BD intake</p><h2 className="mt-2 text-lg font-bold text-foreground">Add application</h2><p className="mt-1 text-sm text-muted-foreground">Capture the job and recruiter details in under a minute. It starts as Applied until a recruiter responds.</p></header><form aria-label="Add application" className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submit}><Field htmlFor="lead-profile" label="Candidate profile"><select className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" id="lead-profile" onChange={(event) => setProfileId(event.target.value)} required value={profileId}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></Field><Field htmlFor="lead-job-title" label="Job title"><Input id="lead-job-title" onChange={(event) => set("jobTitle", event.target.value)} required value={values.jobTitle} /></Field><Field htmlFor="lead-company-name" label="Company"><Input id="lead-company-name" onChange={(event) => set("companyName", event.target.value)} required value={values.companyName} /></Field><Field htmlFor="lead-url" label="JD link"><Input id="lead-url" onChange={(event) => set("rawUrl", event.target.value)} required type="url" value={values.rawUrl} /></Field><Field htmlFor="lead-applied-date" label="Applied date"><Input id="lead-applied-date" onChange={(event) => set("appliedDate", event.target.value)} required type="date" value={values.appliedDate} /></Field><Field htmlFor="lead-recruiter-name" label="Recruiter name"><Input id="lead-recruiter-name" onChange={(event) => set("recruiterName", event.target.value)} value={values.recruiterName} /></Field><Field htmlFor="lead-recruiter-email" label="Recruiter email"><Input id="lead-recruiter-email" onChange={(event) => set("recruiterEmail", event.target.value)} type="email" value={values.recruiterEmail} /></Field><div className="flex items-end gap-3"><Button disabled={pending || !profileId} type="submit">{pending ? "Adding…" : "Add application"}</Button>{notice ? <p className="text-sm font-semibold text-success" role="status">{notice}</p> : null}{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div></form></Card>;
}
