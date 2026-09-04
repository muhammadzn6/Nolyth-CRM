import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listProfiles } from "../../lib/api-client";
import { Card, EmptyState, ErrorState } from "@orbit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profiles" };

export default async function ProfilesRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let page;
  try { page = await listProfiles({}, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load profiles."} title="Profiles unavailable" /></AppShell>; }
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1500px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Job searches</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Profiles</h1><p className="mt-1.5 text-sm text-muted-foreground">Job-search campaigns grouped by candidate.</p></div>{page.items.length === 0 ? <EmptyState description="Create a candidate first, then add a profile." title="No profiles yet" /> : <Card className="overflow-hidden p-0"><div className="divide-y divide-border">{page.items.map((profile) => <Link className="flex flex-col gap-2 px-5 py-4 transition hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between" href={`/profiles/${profile.id}`} key={profile.id}><div><p className="font-semibold text-foreground">{profile.name}</p><p className="mt-1 text-sm text-muted-foreground">{profile.targetRoles.join(", ") || "Roles not set"}</p></div><div className="flex items-center gap-4 text-xs text-muted-foreground"><span>{profile.preferredLocations.join(", ") || "Locations not set"}</span><span className="rounded-full bg-info-soft px-2.5 py-1 font-bold text-info">{profile.status}</span><span aria-hidden="true" className="text-base text-muted-foreground">→</span></div></Link>)}</div></Card>}</div></AppShell>;
}
