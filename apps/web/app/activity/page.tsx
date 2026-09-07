import type { Metadata } from "next";
import { Fragment } from "react";
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
  const day = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Audit trail</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Activity</h1><p className="mt-1.5 text-sm text-muted-foreground">A chronological record of changes across the workspace.</p></div><span className="w-fit rounded-full bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">{events.length} recent events</span></div>{events.length === 0 ? <EmptyState description="New workspace actions will appear here." title="No activity yet" /> : <Card className="overflow-hidden p-0"><div className="border-b border-border bg-surface-subtle px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Latest first</div><section aria-label="Workspace activity" className="data-scroll-region max-h-[calc(100vh-15rem)] min-h-[28rem] overflow-y-auto px-5 py-2">{events.map((event, index) => <Fragment key={event.id}>{index === 0 || day(events[index - 1]!.occurredAt) !== day(event.occurredAt) ? <h2 className="sticky top-0 z-10 -mx-5 border-y border-border bg-surface/95 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">{day(event.occurredAt)}</h2> : null}<article className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-0"><span className="mt-1.5 size-2 rounded-full bg-primary ring-4 ring-primary-soft" /><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5"><div><p className="text-sm font-semibold capitalize text-foreground">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{event.entityType.replaceAll("_", " ").toLowerCase()}{event.actorNameSnapshot ? ` · by ${event.actorNameSnapshot}` : ""}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(event.occurredAt))}</time></div></article></Fragment>)}</section></Card>}</div></AppShell>;
}
