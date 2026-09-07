"use client";

import { type FormEvent } from "react";

import type { CandidateSummary, CreateCandidate, UpdateCandidate } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";

type CandidateFormProps = {
  initial?: CandidateSummary;
  pending: boolean;
  onSubmit: (input: CreateCandidate | UpdateCandidate) => Promise<boolean>;
  surface?: boolean;
};

function optional(data: FormData, name: string): string | undefined {
  const value = String(data.get(name) ?? "").trim();
  return value || undefined;
}

export function CandidateForm({ initial, pending, onSubmit, surface = true }: CandidateFormProps) {
  const prefix = initial ? `candidate-${initial.id}` : "candidate";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      ...(optional(data, "preferredName") ? { preferredName: optional(data, "preferredName") } : {}),
      ...(optional(data, "email") ? { email: optional(data, "email") } : {}),
      ...(optional(data, "phone") ? { phone: optional(data, "phone") } : {}),
      timezone: String(data.get("timezone") ?? ""),
      ...(optional(data, "location") ? { location: optional(data, "location") } : {}),
    };

    if (await onSubmit(input)) {
      if (!initial) form.reset();
    }
  }

  const content = (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          {initial ? "Candidate record" : "New candidate"}
        </p>
        <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground">
          {initial ? "Edit candidate" : "Create candidate"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Candidate records are CRM contacts, not login accounts.
        </p>
      </header>
      <form
        aria-label={initial ? `Edit ${initial.firstName} ${initial.lastName}` : "Create candidate"}
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={handleSubmit}
      >
        <Field htmlFor={`${prefix}-firstName`} label="First name">
          <Input defaultValue={initial?.firstName} disabled={pending} id={`${prefix}-firstName`} name="firstName" required />
        </Field>
        <Field htmlFor={`${prefix}-lastName`} label="Last name">
          <Input defaultValue={initial?.lastName} disabled={pending} id={`${prefix}-lastName`} name="lastName" required />
        </Field>
        <Field htmlFor={`${prefix}-preferredName`} label="Preferred name" hint="Optional">
          <Input defaultValue={initial?.preferredName ?? ""} disabled={pending} id={`${prefix}-preferredName`} name="preferredName" />
        </Field>
        <Field htmlFor={`${prefix}-email`} label="Email" hint="Optional">
          <Input autoComplete="email" defaultValue={initial?.email ?? ""} disabled={pending} id={`${prefix}-email`} name="email" type="email" />
        </Field>
        <Field htmlFor={`${prefix}-phone`} label="Phone" hint="Optional">
          <Input autoComplete="tel" defaultValue={initial?.phone ?? ""} disabled={pending} id={`${prefix}-phone`} name="phone" />
        </Field>
        <Field htmlFor={`${prefix}-timezone`} label="Timezone">
          <Input defaultValue={initial?.timezone ?? "UTC"} disabled={pending} id={`${prefix}-timezone`} name="timezone" required />
        </Field>
        <Field htmlFor={`${prefix}-location`} label="Location" hint="Optional">
          <Input defaultValue={initial?.location ?? ""} disabled={pending} id={`${prefix}-location`} name="location" />
        </Field>
        <div className="self-end">
          <Button className="w-full" disabled={pending} type="submit">
            {pending ? "Saving…" : initial ? "Save candidate" : "Create candidate"}
          </Button>
        </div>
      </form>
    </>
  );

  return surface ? <Card className="p-5 sm:p-6">{content}</Card> : <div>{content}</div>;
}
