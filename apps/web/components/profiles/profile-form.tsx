"use client";

import { type FormEvent } from "react";

import type { CreateProfile, ProfileSummary, UpdateProfile } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";

type ProfileFormProps = {
  initial?: ProfileSummary;
  candidateId?: string;
  embedded?: boolean;
  pending: boolean;
  onSubmit: (input: CreateProfile | UpdateProfile) => Promise<boolean>;
};

const selectClasses = "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none";
const textAreaClasses = "min-h-24 w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none";

function optional(data: FormData, name: string): string | undefined {
  const value = String(data.get(name) ?? "").trim();
  return value || undefined;
}

function list(data: FormData, name: string): string[] {
  return String(data.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function ProfileForm({ candidateId, embedded = false, initial, pending, onSubmit }: ProfileFormProps) {
  const prefix = initial ? `profile-${initial.id}` : "profile";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const description = optional(data, "description");
    const targetCompensation = optional(data, "targetCompensation");
    const compensationPeriod = optional(data, "compensationPeriod") as "HOURLY" | "YEARLY" | undefined;
    const shared = {
      name: String(data.get("name") ?? ""),
      description: initial ? (description ?? null) : description,
      defaultCurrency: String(data.get("defaultCurrency") ?? ""),
      targetCompensation: initial ? (targetCompensation ?? null) : targetCompensation,
      compensationPeriod: initial ? (compensationPeriod ?? null) : compensationPeriod,
      targetRoles: list(data, "targetRoles"),
      preferredLocations: list(data, "preferredLocations"),
      workplacePreferences: list(data, "workplacePreferences"),
      jobTypePreferences: list(data, "jobTypePreferences"),
      contractPreferences: list(data, "contractPreferences"),
    };
    const input = initial ? shared : { ...shared, candidateId: String(data.get("candidateId") ?? "") };

    if (await onSubmit(input as CreateProfile | UpdateProfile)) {
      if (!initial) form.reset();
    }
  }

  const form = (
    <>
      {!embedded ? <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{initial ? "Search profile" : "New search"}</p>
        <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground">{initial ? "Edit profile" : "Create profile"}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep target roles, locations, work style, and compensation scoped to this search.</p>
      </header> : null}
      <form aria-label={initial ? `Edit ${initial.name}` : "Create profile"} className={`${embedded ? "" : "mt-5 "}grid gap-4 md:grid-cols-2 xl:grid-cols-4`} onSubmit={handleSubmit}>
        {!initial ? <input name="candidateId" type="hidden" value={candidateId ?? ""} /> : null}
        <Field className="md:col-span-2" htmlFor={`${prefix}-name`} label="Profile name">
          <Input defaultValue={initial?.name} disabled={pending} id={`${prefix}-name`} name="name" placeholder="Platform engineering" required />
        </Field>
        <Field htmlFor={`${prefix}-defaultCurrency`} label="Currency">
          <Input defaultValue={initial?.defaultCurrency ?? "USD"} disabled={pending} id={`${prefix}-defaultCurrency`} maxLength={3} name="defaultCurrency" required />
        </Field>
        <Field htmlFor={`${prefix}-targetCompensation`} label="Target compensation" hint="Optional">
          <Input defaultValue={initial?.targetCompensation ?? ""} disabled={pending} id={`${prefix}-targetCompensation`} inputMode="decimal" name="targetCompensation" placeholder="150000" />
        </Field>
        <Field className="md:col-span-2" htmlFor={`${prefix}-description`} label="Description" hint="Optional">
          <textarea className={textAreaClasses} defaultValue={initial?.description ?? ""} disabled={pending} id={`${prefix}-description`} name="description" />
        </Field>
        <Field htmlFor={`${prefix}-compensationPeriod`} label="Compensation period">
          <select className={selectClasses} defaultValue={initial?.compensationPeriod ?? ""} disabled={pending} id={`${prefix}-compensationPeriod`} name="compensationPeriod">
            <option value="">Not set</option><option value="HOURLY">Hourly</option><option value="YEARLY">Yearly</option>
          </select>
        </Field>
        <Field htmlFor={`${prefix}-targetRoles`} label="Target roles" hint="Comma separated">
          <Input defaultValue={initial?.targetRoles.join(", ")} disabled={pending} id={`${prefix}-targetRoles`} name="targetRoles" placeholder="Staff Engineer, Platform Lead" />
        </Field>
        <Field htmlFor={`${prefix}-preferredLocations`} label="Preferred locations" hint="Comma separated">
          <Input defaultValue={initial?.preferredLocations.join(", ")} disabled={pending} id={`${prefix}-preferredLocations`} name="preferredLocations" placeholder="Remote, London" />
        </Field>
        <Field htmlFor={`${prefix}-workplacePreferences`} label="Workplace preferences" hint="Comma separated">
          <Input defaultValue={initial?.workplacePreferences.join(", ")} disabled={pending} id={`${prefix}-workplacePreferences`} name="workplacePreferences" placeholder="Remote, Hybrid" />
        </Field>
        <Field htmlFor={`${prefix}-jobTypePreferences`} label="Job types" hint="Comma separated">
          <Input defaultValue={initial?.jobTypePreferences.join(", ")} disabled={pending} id={`${prefix}-jobTypePreferences`} name="jobTypePreferences" placeholder="Full-time" />
        </Field>
        <Field htmlFor={`${prefix}-contractPreferences`} label="Contract preferences" hint="Comma separated">
          <Input defaultValue={initial?.contractPreferences.join(", ")} disabled={pending} id={`${prefix}-contractPreferences`} name="contractPreferences" placeholder="Permanent" />
        </Field>
        <div className="self-end"><Button className="w-full" disabled={pending} loading={pending} type="submit">{pending ? "Saving…" : initial ? "Save profile" : "Create profile"}</Button></div>
      </form>
    </>
  );

  if (embedded) return form;

  return (
    <Card className="p-5 sm:p-6">
      {form}
    </Card>
  );
}
