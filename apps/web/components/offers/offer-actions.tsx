"use client";

import { useState } from "react";

import { Button, Input } from "@orbit/ui";
import { decideOffer, placeOffer, startPlacement } from "../../lib/api-client";

export function OfferActions({ id, status, startDate, version }: { id: string; status: "OFFERED" | "ACCEPTED" | "DECLINED"; startDate: string | null; version: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [date, setDate] = useState(startDate ?? "");
  async function run(action: () => Promise<unknown>) {
    setPending(true); setError(undefined);
    try { await action(); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Offer action failed."); } finally { setPending(false); }
  }
  return <div className="mt-4 grid gap-2"><div className="flex flex-wrap gap-2">{status === "OFFERED" ? <><Button disabled={pending} onClick={() => void run(() => decideOffer(id, "ACCEPTED", version))} size="sm">Accept</Button><Button disabled={pending} onClick={() => void run(() => decideOffer(id, "DECLINED", version))} size="sm" variant="ghost">Decline</Button></> : null}{status === "ACCEPTED" && !startDate ? <div className="flex gap-2"><label className="sr-only" htmlFor={`start-${id}`}>Placement start date</label><Input id={`start-${id}`} onChange={(event) => setDate(event.target.value)} type="date" value={date} /><Button disabled={pending || !date} onClick={() => void run(() => placeOffer(id, date, version))} size="sm">Confirm start date</Button></div> : null}{status === "ACCEPTED" && startDate ? <Button disabled={pending} onClick={() => void run(() => startPlacement(id, version))} size="sm">Mark started</Button> : null}</div>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</div>;
}
