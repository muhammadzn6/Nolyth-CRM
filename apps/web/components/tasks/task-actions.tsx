"use client";

import { useState } from "react";

import { Button, Input } from "@orbit/ui";
import { cancelTask, completeTask } from "../../lib/api-client";

export function TaskActions({ taskId, version }: { taskId: string; version: number }) {
  const [pending, setPending] = useState<"complete" | "cancel">();
  const [error, setError] = useState<string>();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  async function finish() {
    setPending("complete"); setError(undefined);
    try { await completeTask(taskId, version); window.location.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Task could not be completed."); }
    finally { setPending(undefined); }
  }

  async function cancel() {
    setPending("cancel"); setError(undefined);
    try { await cancelTask(taskId, version, reason); window.location.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Task could not be cancelled."); }
    finally { setPending(undefined); }
  }

  return <div className="mt-4 grid gap-2">
    <div className="flex flex-wrap gap-2"><Button disabled={Boolean(pending)} loading={pending === "complete"} onClick={() => void finish()} size="sm">{pending === "complete" ? "Completing…" : "Complete"}</Button><Button disabled={Boolean(pending)} onClick={() => setShowCancel((value) => !value)} size="sm" variant="ghost">Cancel</Button></div>
    {showCancel ? <div className="flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor={`cancel-${taskId}`}>Cancellation reason</label><Input id={`cancel-${taskId}`} onChange={(event) => setReason(event.target.value)} placeholder="Cancellation reason" value={reason} /><Button disabled={Boolean(pending) || !reason.trim()} loading={pending === "cancel"} onClick={() => void cancel()} size="sm" variant="secondary">{pending === "cancel" ? "Cancelling…" : "Confirm cancellation"}</Button></div> : null}
    {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}
  </div>;
}
