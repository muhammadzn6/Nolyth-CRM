import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listActivity } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

export default async function ActivityRoute({ searchParams }: { searchParams?: Promise<{ companyId?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const companyId = (await searchParams)?.companyId;
  let events;
  try { events = await listActivity({ companyId, limit: 40 }, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load activity."} title="Activity unavailable" /></AppShell>; }
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1100px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Audit trail</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Activity</h1><p className="mt-1.5 text-sm text-muted-foreground">A chronological record of changes across the workspace.</p></div>{events.length === 0 ? <EmptyState description="New workspace actions will appear here." title="No activity yet" /> : <Card className="divide-y divide-border p-5">{events.map((event) => <article className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5" key={event.id}><div><p className="text-sm font-semibold capitalize text-foreground">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{event.entityType.replaceAll("_", " ").toLowerCase()}{event.actorNameSnapshot ? ` · by ${event.actorNameSnapshot}` : ""}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}</time></article>)}</Card>}</div></AppShell>;
}
