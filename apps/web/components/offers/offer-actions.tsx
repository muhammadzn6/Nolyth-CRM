"use client";

import { useState } from "react";

import { Button, Input } from "@orbit/ui";
import { decideOffer, placeOffer, startPlacement } from "../../lib/api-client";

export function OfferActions({ id, status, startDate, startedAt, version }: { id: string; status: "OFFERED" | "ACCEPTED" | "DECLINED"; startDate: string | null; startedAt: string | null; version: number }) {
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [date, setDate] = useState(startDate ?? "");
  async function run(actionId: string, action: () => Promise<unknown>) {
    setPending(actionId); setError(undefined);
    try { await action(); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Offer action failed."); } finally { setPending(undefined); }
  }
  return <div className="mt-4 grid gap-2"><div className="flex flex-wrap gap-2">{status === "OFFERED" ? <><Button disabled={Boolean(pending)} loading={pending === "accept"} onClick={() => void run("accept", () => decideOffer(id, "ACCEPTED", version))} size="sm">{pending === "accept" ? "Accepting…" : "Accept"}</Button><Button disabled={Boolean(pending)} loading={pending === "decline"} onClick={() => void run("decline", () => decideOffer(id, "DECLINED", version))} size="sm" variant="ghost">{pending === "decline" ? "Declining…" : "Decline"}</Button></> : null}{status === "ACCEPTED" && !startDate ? <div className="flex gap-2"><label className="sr-only" htmlFor={`start-${id}`}>Placement start date</label><Input id={`start-${id}`} onChange={(event) => setDate(event.target.value)} type="date" value={date} /><Button disabled={Boolean(pending) || !date} loading={pending === "place"} onClick={() => void run("place", () => placeOffer(id, date, version))} size="sm">{pending === "place" ? "Confirming…" : "Confirm start date"}</Button></div> : null}{status === "ACCEPTED" && startDate && !startedAt ? <Button disabled={Boolean(pending)} loading={pending === "start"} onClick={() => void run("start", () => startPlacement(id, version))} size="sm">{pending === "start" ? "Starting…" : "Mark started"}</Button> : null}</div>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>;
}
