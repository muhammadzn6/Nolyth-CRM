"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { InterviewSummary, UpdateInterview } from "@orbit/contracts";
import { Button, Card, Input } from "@orbit/ui";
import { updateInterview } from "../../lib/api-client";
import { isoToZonedLocalDateTime, zonedLocalDateTimeToIso } from "../../lib/zoned-date-time";
import { Dialog } from "../ui/dialog";
import { InterviewActions } from "./interview-actions";

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(value));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(value));
}

function durationMinutes(startsAt: string, endsAt: string) {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000));
}

type InterviewEditFormProps = { round: InterviewSummary; onCancel: () => void };

export function InterviewEditForm(props: InterviewEditFormProps) {
  return <InterviewEditFormState key={`${props.round.id}:${props.round.version}`} {...props} />;
}

function InterviewEditFormState({ round, onCancel }: InterviewEditFormProps) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(isoToZonedLocalDateTime(round.startsAt, round.timezone));
  const [endsAt, setEndsAt] = useState(isoToZonedLocalDateTime(round.endsAt, round.timezone));
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
      const startsAtIso = zonedLocalDateTimeToIso(startsAt, timezone);
      const endsAtIso = zonedLocalDateTimeToIso(endsAt, timezone);
      if (endsAtIso <= startsAtIso) throw new Error("End time must be after the start time.");
      const input: UpdateInterview = {
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        timezone,
        originalDatetimeText: `${startsAt}–${endsAt} (${timezone})`,
        interviewer: interviewer.trim() || null,
        meetingLink: meetingLink.trim() || null,
        preparationNotes: preparationNotes.trim() || null,
        expectedVersion: round.version,
      };
      await updateInterview(round.id, input);
      onCancel();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Interview could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <form className="grid gap-4" onSubmit={submit}>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold text-foreground">Starts<Input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Ends<Input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Timezone<Input required value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Interviewer<Input value={interviewer} onChange={(event) => setInterviewer(event.target.value)} /></label>
    </div>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Meeting link<Input type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} /></label>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Preparation notes<textarea className="min-h-20 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm font-normal text-foreground" value={preparationNotes} onChange={(event) => setPreparationNotes(event.target.value)} /></label>
    <div className="flex items-center gap-2"><Button disabled={pending} loading={pending} type="submit">{pending ? "Saving…" : "Save changes"}</Button><Button disabled={pending} type="button" variant="ghost" onClick={onCancel}>Cancel</Button>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>
  </form>;
}

export function InterviewRoundCard({ actorRole, closerName, round, initiallyEditing = false }: { actorRole: string; closerName?: string; round: InterviewSummary; initiallyEditing?: boolean }) {
  const [editing, setEditing] = useState(initiallyEditing);
  const editable = ["ADMIN", "BD"].includes(actorRole) && round.status === "SCHEDULED";
  const duration = durationMinutes(round.startsAt, round.endsAt);

  return <Card aria-label={`Interview with ${round.interviewer ?? "unassigned interviewer"}`} className="overflow-hidden p-0" role="article"><div className="grid gap-5 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{round.roundType.replaceAll("_", " ")} · Round {round.roundNumber}</p><h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-foreground">{formatDate(round.startsAt, round.timezone)}</h2><p className="mt-1 text-sm font-medium text-muted-foreground">{formatTime(round.startsAt, round.timezone)}–{formatTime(round.endsAt, round.timezone)} · {duration} min · {round.timezone}</p></div><span className="w-fit rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{round.status.replaceAll("_", " ")}</span></div><dl className="grid gap-4 border-y border-border py-4 sm:grid-cols-3"><div><dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Interviewer</dt><dd className="mt-1 text-sm font-semibold text-foreground">{round.interviewer ?? "Not provided"}</dd></div><div><dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Assigned Closer</dt><dd className="mt-1 text-sm font-semibold text-foreground">{closerName ?? "Not assigned"}</dd></div><div><dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Meeting</dt><dd className="mt-1 text-sm font-semibold">{round.meetingLink ? <a className="text-primary hover:underline" href={round.meetingLink} rel="noreferrer" target="_blank">Join meeting</a> : round.location ?? "Not provided"}</dd></div></dl>{round.preparationNotes ? <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Preparation</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">{round.preparationNotes}</p></div> : null}<div className="flex flex-wrap items-start gap-2">{editable ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit interview</Button> : null}<InterviewActions actorRole={actorRole} closerNotes={round.closerNotes} id={round.id} officialFeedback={round.officialFeedback} officialResult={round.officialResult} startsAt={round.startsAt} status={round.status} version={round.version} /></div></div><Dialog description="Update the schedule, meeting access, and preparation details for this round." onOpenChange={setEditing} open={editing} title="Edit interview"><InterviewEditForm onCancel={() => setEditing(false)} round={round} /></Dialog></Card>;
}
