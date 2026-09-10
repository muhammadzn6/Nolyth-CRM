"use client";

import { useState } from "react";
import type { ContactSummary, CreateCommunication } from "@orbit/contracts";
import { Button, Card, Field, Input } from "@orbit/ui";

import { createLeadComment, createLeadCommunication } from "../../lib/api-client";
import { isoToZonedLocalDateTime, zonedLocalDateTimeToIso } from "../../lib/zoned-date-time";

type Visibility = "INTERNAL_TEAM" | "SHARED_WITH_CLOSER";

export function CollaborationForm({
  contacts = [],
  embedded = false,
  initialDirection = "OUTBOUND",
  initialVisibility = "INTERNAL_TEAM",
  kind,
  leadId,
  onSuccess,
  sharedOnly = false,
  timezone = "UTC",
}: {
  contacts?: ContactSummary[];
  embedded?: boolean;
  initialDirection?: CreateCommunication["direction"];
  initialVisibility?: Visibility;
  kind: "comments" | "communications";
  leadId: string;
  onSuccess?: () => void;
  sharedOnly?: boolean;
  timezone?: string;
}) {
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("");
  const [contactId, setContactId] = useState("");
  const [type, setType] = useState<CreateCommunication["type"]>("EMAIL");
  const [direction, setDirection] = useState<CreateCommunication["direction"]>(initialDirection);
  const [visibility, setVisibility] = useState<Visibility>(sharedOnly ? "SHARED_WITH_CLOSER" : initialVisibility);
  const [occurredAt, setOccurredAt] = useState(() => isoToZonedLocalDateTime(new Date().toISOString(), timezone));
  const [nextActionSummary, setNextActionSummary] = useState("");
  const [nextActionDueAt, setNextActionDueAt] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      if (kind === "comments") {
        await createLeadComment(leadId, { body: body.trim(), visibility });
      } else {
        await createLeadCommunication(leadId, {
          ...(contactId ? { contactId } : {}),
          type,
          direction,
          ...(subject.trim() ? { subject: subject.trim().replace(/\s+/g, " ") } : {}),
          body: body.trim(),
          occurredAt: zonedLocalDateTimeToIso(occurredAt, timezone),
          ...(outcome.trim() ? { outcome: outcome.trim().replace(/\s+/g, " ") } : {}),
          visibility,
          ...(nextActionSummary.trim() ? { nextActionSummary: nextActionSummary.trim().replace(/\s+/g, " ") } : {}),
          ...(nextActionDueAt ? { nextActionDueAt: zonedLocalDateTimeToIso(nextActionDueAt, timezone) } : {}),
        });
      }
      onSuccess?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The entry could not be saved.");
    } finally {
      setPending(false);
    }
  }

  const form = <form className="grid gap-4" onSubmit={submit}>
    {kind === "communications" ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`type-${leadId}`} label="Channel"><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" id={`type-${leadId}`} onChange={(event) => { const value = event.target.value as CreateCommunication["type"]; setType(value); if (value === "NOTE") setDirection("INTERNAL"); else if (direction === "INTERNAL") setDirection("OUTBOUND"); }} value={type}><option value="EMAIL">Email</option><option value="LINKEDIN">LinkedIn</option><option value="PHONE">Phone</option><option value="JOB_PLATFORM">Job platform</option><option value="NOTE">Internal note</option></select></Field>
        <Field htmlFor={`direction-${leadId}`} label="Direction"><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" id={`direction-${leadId}`} onChange={(event) => setDirection(event.target.value as CreateCommunication["direction"])} value={direction}><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option><option value="INTERNAL">Internal</option></select></Field>
        <Field htmlFor={`contact-${leadId}`} label="Recruiter or contact"><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" id={`contact-${leadId}`} onChange={(event) => setContactId(event.target.value)} value={contactId}><option value="">No contact selected</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.email ? ` · ${contact.email}` : ""}</option>)}</select></Field>
        <Field htmlFor={`occurred-${leadId}`} label="Occurred at"><Input id={`occurred-${leadId}`} onChange={(event) => setOccurredAt(event.target.value)} required type="datetime-local" value={occurredAt} /></Field>
        <Field htmlFor={`subject-${leadId}`} label="Subject"><Input id={`subject-${leadId}`} onChange={(event) => setSubject(event.target.value)} placeholder="Optional thread subject" value={subject} /></Field>
        <Field htmlFor={`outcome-${leadId}`} label="Outcome"><Input id={`outcome-${leadId}`} onChange={(event) => setOutcome(event.target.value)} placeholder="Optional result" value={outcome} /></Field>
        {direction === "INBOUND" ? <p className="sm:col-span-2 text-sm font-medium text-muted-foreground">An inbound recruiter reply moves this application to Response received.</p> : null}
      </div>
    </> : null}
    <Field htmlFor={`body-${leadId}`} label={kind === "comments" ? "Comment" : "Communication details"}><textarea className="min-h-28 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-focus/15" id={`body-${leadId}`} onChange={(event) => setBody(event.target.value)} placeholder={kind === "comments" ? "Write a comment" : "Record the message or conversation"} required value={body} /></Field>
    {sharedOnly ? null : <Field htmlFor={`visibility-${leadId}`} label="Visibility"><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" id={`visibility-${leadId}`} onChange={(event) => setVisibility(event.target.value as Visibility)} value={visibility}><option value="INTERNAL_TEAM">Internal team</option><option value="SHARED_WITH_CLOSER">Shared with Closer</option></select></Field>}
    {kind === "communications" ? <div className="grid gap-4 rounded-2xl bg-surface-subtle p-4 sm:grid-cols-2"><Field htmlFor={`next-action-${leadId}`} label="Next action"><Input id={`next-action-${leadId}`} onChange={(event) => setNextActionSummary(event.target.value)} placeholder="Optional follow-up" value={nextActionSummary} /></Field><Field htmlFor={`next-action-due-${leadId}`} label="Next action due"><Input id={`next-action-due-${leadId}`} onChange={(event) => setNextActionDueAt(event.target.value)} type="datetime-local" value={nextActionDueAt} /></Field></div> : null}
    <div className="flex items-center justify-end gap-3"><Button disabled={pending || !body.trim() || (kind === "communications" && !occurredAt)} loading={pending} type="submit">{pending ? "Saving…" : kind === "comments" ? "Save comment" : "Save communication"}</Button>{error ? <p className="mr-auto text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>
  </form>;

  return embedded ? form : <Card className="p-5"><h2 className="text-base font-bold text-foreground">Add {kind === "comments" ? "comment" : "communication"}</h2><div className="mt-4">{form}</div></Card>;
}
