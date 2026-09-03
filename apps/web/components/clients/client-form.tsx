"use client";

import { useState } from "react";
import type { CompanySummary, CreateCompany, UpdateCompanyRequest } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";
import { createCompany, updateCompany } from "../../lib/api-client";

export function ClientForm({ initial, onSaved }: { initial?: CompanySummary; onSaved?: (company: CompanySummary) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [values, setValues] = useState({ canonicalName: initial?.canonicalName ?? "", website: initial?.website ?? "", domain: initial?.domain ?? "", industry: initial?.industry ?? "", location: initial?.location ?? "" });
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    try {
      const input = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())) as CreateCompany;
      const company = initial ? await updateCompany(initial.id, { ...input, expectedVersion: initial.version } as UpdateCompanyRequest) : await createCompany(input);
      onSaved?.(company);
      if (!onSaved) window.location.assign(`/admin/clients/${company.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Employer could not be saved."); }
    finally { setPending(false); }
  }

  return <Card className="p-5"><h2 className="text-lg font-bold text-foreground">{initial ? "Edit employer" : "Create employer"}</h2><form aria-label={initial ? "Edit employer" : "Create employer"} className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}><Field htmlFor="client-name" label="Employer name"><Input id="client-name" required disabled={pending} value={values.canonicalName} onChange={(event) => set("canonicalName", event.target.value)} /></Field><Field htmlFor="client-website" label="Website"><Input id="client-website" disabled={pending} type="url" value={values.website} onChange={(event) => set("website", event.target.value)} /></Field><Field htmlFor="client-domain" label="Domain"><Input id="client-domain" disabled={pending} value={values.domain} onChange={(event) => set("domain", event.target.value)} /></Field><Field htmlFor="client-industry" label="Industry"><Input id="client-industry" disabled={pending} value={values.industry} onChange={(event) => set("industry", event.target.value)} /></Field><Field htmlFor="client-location" label="Location"><Input id="client-location" disabled={pending} value={values.location} onChange={(event) => set("location", event.target.value)} /></Field><div className="flex items-end gap-3"><Button disabled={pending} type="submit">{pending ? "Saving…" : initial ? "Save changes" : "Create employer"}</Button>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div></form></Card>;
}
