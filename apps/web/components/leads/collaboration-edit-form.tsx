"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CommentSummary, CommunicationSummary } from "@orbit/contracts";
import { Button, Field, Input } from "@orbit/ui";

import { updateLeadComment, updateLeadCommunication } from "../../lib/api-client";
import { isoToZonedLocalDateTime, zonedLocalDateTimeToIso } from "../../lib/zoned-date-time";
import { Dialog } from "../ui/dialog";

type Visibility = "INTERNAL_TEAM" | "SHARED_WITH_CLOSER";

export function CollaborationEditForm({ item, sharedOnly = false, timezone = "UTC" }: { item: CommentSummary | CommunicationSummary; sharedOnly?: boolean; timezone?: string }) {
  const communication = "type" in item;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(item.body);
  const [visibility, setVisibility] = useState<Visibility>(sharedOnly ? "SHARED_WITH_CLOSER" : item.visibility);
  const [subject, setSubject] = useState(communication ? item.subject ?? "" : "");
  const [outcome, setOutcome] = useState(communication ? item.outcome ?? "" : "");
  const [occurredAt, setOccurredAt] = useState(communication ? isoToZonedLocalDateTime(item.occurredAt, timezone) : "");
  const [nextActionSummary, setNextActionSummary] = useState(communication ? item.nextActionSummary ?? "" : "");
  const [nextActionDueAt, setNextActionDueAt] = useState(communication && item.nextActionDueAt ? isoToZonedLocalDateTime(item.nextActionDueAt, timezone) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      if (communication) {
        await updateLeadCommunication(item.id, {
          body: body.trim(),
          expectedVersion: item.version,
          nextActionDueAt: nextActionDueAt ? zonedLocalDateTimeToIso(nextActionDueAt, timezone) : null,
          nextActionSummary: nextActionSummary.trim().replace(/\s+/g, " ") || null,
          occurredAt: zonedLocalDateTimeToIso(occurredAt, timezone),
          outcome: outcome.trim().replace(/\s+/g, " ") || null,
          subject: subject.trim().replace(/\s+/g, " ") || null,
          visibility,
        });
      } else {
        await updateLeadComment(item.id, { body: body.trim(), expectedVersion: item.version, visibility });
      }
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The entry could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <Button className="mt-4" disabled={pending} onClick={() => setOpen(true)} size="sm" variant="secondary">Edit</Button>
    <Dialog description={communication ? "Update this communication without leaving the application timeline." : "Update this application comment."} onOpenChange={setOpen} open={open} title={communication ? "Edit communication" : "Edit comment"}>
      <form className="grid gap-4" onSubmit={save}>
        {communication ? <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor={`edit-subject-${item.id}`} label="Subject"><Input id={`edit-subject-${item.id}`} onChange={(event) => setSubject(event.target.value)} value={subject} /></Field>
          <Field htmlFor={`edit-occurred-${item.id}`} label="Occurred at"><Input id={`edit-occurred-${item.id}`} onChange={(event) => setOccurredAt(event.target.value)} required type="datetime-local" value={occurredAt} /></Field>
          <Field htmlFor={`edit-outcome-${item.id}`} label="Outcome"><Input id={`edit-outcome-${item.id}`} onChange={(event) => setOutcome(event.target.value)} value={outcome} /></Field>
          <Field htmlFor={`edit-next-due-${item.id}`} label="Next action due"><Input id={`edit-next-due-${item.id}`} onChange={(event) => setNextActionDueAt(event.target.value)} type="datetime-local" value={nextActionDueAt} /></Field>
        </div> : null}
        <Field htmlFor={`edit-body-${item.id}`} label={communication ? "Communication details" : "Comment"}><textarea className="min-h-28 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-focus/15" id={`edit-body-${item.id}`} onChange={(event) => setBody(event.target.value)} required value={body} /></Field>
        {communication ? <Field htmlFor={`edit-next-${item.id}`} label="Next action"><Input id={`edit-next-${item.id}`} onChange={(event) => setNextActionSummary(event.target.value)} value={nextActionSummary} /></Field> : null}
        {sharedOnly ? null : <Field htmlFor={`edit-visibility-${item.id}`} label="Visibility"><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" id={`edit-visibility-${item.id}`} onChange={(event) => setVisibility(event.target.value as Visibility)} value={visibility}><option value="INTERNAL_TEAM">Internal team</option><option value="SHARED_WITH_CLOSER">Shared with Closer</option></select></Field>}
        {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}
        <div className="flex justify-end gap-3"><Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button><Button disabled={pending || !body.trim() || (communication && !occurredAt)} loading={pending} type="submit">{pending ? "Saving…" : "Save changes"}</Button></div>
      </form>
    </Dialog>
  </>;
}
