"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input } from "@orbit/ui";
import { cancelInterview, recordInterviewAttendance, saveInterviewNotes, saveOfficialInterviewResult } from "../../lib/api-client";
import { Dialog } from "../ui/dialog";

type InterviewActionsProps = {
  actorRole: string;
  id: string;
  version: number;
  status: string;
  startsAt?: string;
  closerNotes?: string | null;
  officialFeedback?: string | null;
  officialResult?: string | null;
};

function isOfficialOutcome(result?: string | null): result is "PASSED" | "FAILED" {
  return result === "PASSED" || result === "FAILED";
}

function compatibilityFeedback(officialFeedback?: string | null, officialResult?: string | null) {
  const legacyResult = officialResult && !isOfficialOutcome(officialResult) ? officialResult : "";
  if (!legacyResult) return officialFeedback ?? "";
  if (!officialFeedback || officialFeedback === legacyResult) return legacyResult;
  return `${legacyResult}\n\n${officialFeedback}`;
}

export function InterviewActions(props: InterviewActionsProps) {
  return <InterviewActionsState key={`${props.id}:${props.version}`} {...props} />;
}

function InterviewActionsState({ actorRole, id, version, status, startsAt, closerNotes, officialFeedback, officialResult }: InterviewActionsProps) {
  const router = useRouter();
  const persistedFeedback = compatibilityFeedback(officialFeedback, officialResult);
  const [pending, setPending] = useState<string>(); const [error, setError] = useState<string>(); const [notes, setNotes] = useState(closerNotes ?? ""); const [feedback, setFeedback] = useState(persistedFeedback); const [outcome, setOutcome] = useState<"PASSED" | "FAILED" | "">(isOfficialOutcome(officialResult) ? officialResult : ""); const [cancelReason, setCancelReason] = useState(""); const [cancelOpen, setCancelOpen] = useState(false); const [attendanceClock, setAttendanceClock] = useState(() => Date.now());
  useEffect(() => {
    if (!startsAt) return;
    const boundary = new Date(startsAt).getTime();
    const delay = boundary - Date.now();
    if (!Number.isFinite(boundary) || delay <= 0) return;
    const timer = window.setTimeout(() => setAttendanceClock(Date.now()), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [attendanceClock, startsAt]);
  const attendanceUnavailable = Boolean(startsAt && new Date(startsAt).getTime() > attendanceClock);
  async function run(actionId: string, action: () => Promise<unknown>) { setPending(actionId); setError(undefined); try { await action(); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Interview action failed."); } finally { setPending(undefined); } }
  return <div className="mt-4 grid gap-3"><div className="flex flex-wrap gap-2">{actorRole === "CLOSER" && ["SCHEDULED", "RESCHEDULE_REQUIRED"].includes(status) ? <><Button disabled={Boolean(pending) || attendanceUnavailable} loading={pending === "attended"} onClick={() => void run("attended", () => recordInterviewAttendance(id, "ATTENDED", version))} size="sm">{pending === "attended" ? "Saving…" : "Mark attended"}</Button><Button disabled={Boolean(pending) || attendanceUnavailable} loading={pending === "missed"} onClick={() => void run("missed", () => recordInterviewAttendance(id, "MISSED", version))} size="sm" variant="ghost">{pending === "missed" ? "Saving…" : "Mark missed"}</Button>{attendanceUnavailable ? <p className="w-full text-xs text-muted-foreground">Available after interview starts.</p> : null}</> : null}{actorRole !== "CLOSER" && ["SCHEDULED", "RESCHEDULE_REQUIRED"].includes(status) ? <Button disabled={Boolean(pending)} onClick={() => setCancelOpen(true)} size="sm" variant="ghost">Cancel interview</Button> : null}</div>{actorRole === "CLOSER" && ["COMPLETED", "WAITING_FEEDBACK", "PASSED", "FAILED"].includes(status) ? <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><label className="sr-only" htmlFor={`notes-${id}`}>Closer notes</label><Input id={`notes-${id}`} onChange={(event) => setNotes(event.target.value)} placeholder="Closer notes" value={notes} /><Button disabled={Boolean(pending) || !notes.trim()} loading={pending === "notes"} onClick={() => void run("notes", () => saveInterviewNotes(id, notes, version))} size="sm" variant="secondary">{pending === "notes" ? "Saving…" : "Save notes"}</Button></div> : null}{actorRole !== "CLOSER" && status === "WAITING_FEEDBACK" ? <div className="grid gap-2 sm:grid-cols-[11rem_1fr_auto]"><label className="sr-only" htmlFor={`outcome-${id}`}>Official outcome</label><select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" id={`outcome-${id}`} onChange={(event) => setOutcome(event.target.value as "PASSED" | "FAILED" | "")} value={outcome}><option value="">Select outcome</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option></select><label className="sr-only" htmlFor={`feedback-${id}`}>Official feedback</label><Input id={`feedback-${id}`} onChange={(event) => setFeedback(event.target.value)} placeholder="Official feedback (optional)" value={feedback} /><Button disabled={Boolean(pending) || !outcome} loading={pending === "outcome"} onClick={() => outcome && void run("outcome", () => saveOfficialInterviewResult(id, outcome, feedback, version))} size="sm" variant="secondary">{pending === "outcome" ? "Saving…" : "Save outcome"}</Button></div> : null}{["COMPLETED", "PASSED", "FAILED"].includes(status) && (closerNotes || persistedFeedback) ? <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">{closerNotes ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Closer notes</dt><dd className="mt-1 text-sm leading-6 text-foreground">{closerNotes}</dd></div> : null}{persistedFeedback ? <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Official feedback</dt><dd className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{persistedFeedback}</dd></div> : null}</dl> : null}{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}<Dialog description="This keeps the interview in the application history and removes it from active schedules." onOpenChange={setCancelOpen} open={cancelOpen} title="Cancel interview"><div className="grid gap-5"><label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={`cancel-${id}`}>Cancellation reason<Input autoFocus id={`cancel-${id}`} onChange={(event) => setCancelReason(event.target.value)} placeholder="Why is this interview being cancelled?" value={cancelReason} /></label><div className="flex justify-end gap-2"><Button disabled={Boolean(pending)} onClick={() => setCancelOpen(false)} variant="ghost">Keep interview</Button><Button disabled={Boolean(pending) || !cancelReason.trim()} loading={pending === "cancel"} onClick={() => void run("cancel", async () => { await cancelInterview(id, version, cancelReason); setCancelOpen(false); })}>{pending === "cancel" ? "Cancelling…" : "Cancel interview"}</Button></div></div></Dialog></div>;
}
