"use client";

import { useState } from "react";

import type { CreateInterview, UserSummary } from "@orbit/contracts";
import { Button, Card, Input } from "@orbit/ui";
import { createLeadInterview } from "../../lib/api-client";
import { zonedLocalDateTimeToIso } from "../../lib/zoned-date-time";

const roundTypes = ["PRE_SCREEN", "RECRUITER", "HR", "TECHNICAL", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "HIRING_MANAGER", "FINAL", "OTHER"] as const;

export function InterviewForm({ leadId, closers, timezone: initialTimezone, embedded = false, onSuccess }: { leadId: string; closers: UserSummary[]; timezone: string; embedded?: boolean; onSuccess?: () => void }) {
  const [closerId, setCloserId] = useState(closers[0]?.id ?? "");
  const [roundType, setRoundType] = useState<CreateInterview["roundType"]>("TECHNICAL");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(initialTimezone);
  const [interviewer, setInterviewer] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [preparationNotes, setPreparationNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    try { const startsAtIso = zonedLocalDateTimeToIso(startsAt, timezone); const endsAtIso = zonedLocalDateTimeToIso(endsAt, timezone); if (endsAtIso <= startsAtIso) throw new Error("End time must be after the start time."); await createLeadInterview(leadId, { closerId, roundType, startsAt: startsAtIso, endsAt: endsAtIso, timezone, originalDatetimeText: `${startsAt}–${endsAt} (${timezone})`, ...(interviewer.trim() ? { interviewer: interviewer.trim() } : {}), ...(meetingLink.trim() ? { meetingLink: meetingLink.trim() } : {}), ...(preparationNotes.trim() ? { preparationNotes: preparationNotes.trim() } : {}) }); onSuccess?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Interview could not be scheduled."); }
    finally { setPending(false); }
  }

  const form = <form className="grid gap-3" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-foreground">Closer<select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setCloserId(event.target.value)} required value={closerId}><option value="">Select a closer</option>{closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.displayName}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-foreground">Round type<select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setRoundType(event.target.value as CreateInterview["roundType"])} value={roundType}>{roundTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-foreground">Starts<Input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label className="grid gap-1 text-sm font-semibold text-foreground">Ends<Input onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label><label className="grid gap-1 text-sm font-semibold text-foreground">Timezone<Input onChange={(event) => setTimezone(event.target.value)} required value={timezone} /></label><label className="grid gap-1 text-sm font-semibold text-foreground">Interviewer<Input onChange={(event) => setInterviewer(event.target.value)} placeholder="Optional" value={interviewer} /></label></div><label className="grid gap-1 text-sm font-semibold text-foreground">Meeting link<Input onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://… (optional)" type="url" value={meetingLink} /></label><label className="grid gap-1 text-sm font-semibold text-foreground">Preparation notes<textarea className="min-h-24 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm font-normal text-foreground" onChange={(event) => setPreparationNotes(event.target.value)} placeholder="Optional context for the closer" value={preparationNotes} /></label><div className="flex items-center gap-3"><Button disabled={pending || !closerId || !startsAt || !endsAt} loading={pending} type="submit">{pending ? "Scheduling…" : "Schedule interview"}</Button>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div></form>;
  return embedded ? form : <Card className="p-5"><h2 className="text-base font-bold text-foreground">Schedule interview</h2><div className="mt-4">{form}</div></Card>;
}
