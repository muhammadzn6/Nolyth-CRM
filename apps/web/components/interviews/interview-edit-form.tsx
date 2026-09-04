"use client";

import { useState } from "react";

import type { InterviewSummary, UpdateInterview } from "@orbit/contracts";
import { Button, Card, Input } from "@orbit/ui";
import { updateInterview } from "../../lib/api-client";

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function InterviewEditForm({ round, onCancel }: { round: InterviewSummary; onCancel: () => void }) {
  const [startsAt, setStartsAt] = useState(localDateTime(round.startsAt));
  const [endsAt, setEndsAt] = useState(localDateTime(round.endsAt));
  const [timezone, setTimezone] = useState(round.timezone);
  const [interviewer, setInterviewer] = useState(round.interviewer ?? "");
  const [meetingLink, setMeetingLink] = useState(round.meetingLink ?? "");
  const [preparationNotes, setPreparationNotes] = useState(round.preparationNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const input: UpdateInterview = {
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        timezone,
        originalDatetimeText: `${startsAt}–${endsAt} (${timezone})`,
        interviewer: interviewer.trim() || null,
        meetingLink: meetingLink.trim() || null,
        preparationNotes: preparationNotes.trim() || null,
        expectedVersion: round.version,
      };
      await updateInterview(round.id, input);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Interview could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <form className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-subtle p-4" onSubmit={submit}>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold text-foreground">Starts<Input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Ends<Input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Timezone<Input required value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Interviewer<Input value={interviewer} onChange={(event) => setInterviewer(event.target.value)} /></label>
    </div>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Meeting link<Input type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} /></label>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Preparation notes<textarea className="min-h-20 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm font-normal text-foreground" value={preparationNotes} onChange={(event) => setPreparationNotes(event.target.value)} /></label>
    <div className="flex items-center gap-2"><Button disabled={pending} type="submit">{pending ? "Saving…" : "Save changes"}</Button><Button disabled={pending} type="button" variant="ghost" onClick={onCancel}>Cancel</Button>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>
  </form>;
}

export function InterviewRoundCard({ actorRole, round }: { actorRole: string; round: InterviewSummary }) {
  const [editing, setEditing] = useState(false);
  return <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{round.roundType.replaceAll("_", " ")} · Round {round.roundNumber}</p><h2 className="mt-2 text-base font-bold text-foreground">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: round.timezone }).format(new Date(round.startsAt))}</h2><p className="mt-1 text-sm text-muted-foreground">{round.status.replaceAll("_", " ")} · {round.timezone}</p>{round.interviewer ? <p className="mt-2 text-sm text-foreground">{round.interviewer}</p> : null}{["ADMIN", "BD"].includes(actorRole) && round.status === "SCHEDULED" ? editing ? <InterviewEditForm onCancel={() => setEditing(false)} round={round} /> : <Button className="mt-4" size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit interview</Button> : null}</Card>;
}
