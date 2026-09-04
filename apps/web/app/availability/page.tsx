import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { AvailabilityEditor } from "../../components/availability/availability-editor";
import { ApiClientError, getAvailability, getCurrentActor } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Availability" };
export default async function AvailabilityRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined; const actor = await getCurrentActor(cookie); if (!actor) redirect("/login");
  try { const availability = await getAvailability(actor.id, cookie); return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Scheduling</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">My availability</h1><p className="mt-1.5 text-sm text-muted-foreground">Set the hours and exceptions used when planning interviews.</p></div><AvailabilityEditor initialExceptions={availability.exceptions} initialRules={availability.rules} /></div></AppShell>; } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load availability."} title="Availability unavailable" /></AppShell>; }
}
