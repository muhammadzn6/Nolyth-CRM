import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, getDashboard, getProfile, listActivity, listDocuments, listLeadInterviewRounds, listLeads, listTasks } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile workspace" };
const tabs = ["leads", "interviews", "tasks", "documents", "team", "activity", "analytics"] as const;

export default async function ProfileTabRoute({ params }: { params: Promise<{ profileId: string; tab: string }> }) {
  const { profileId, tab } = await params;
  if (!tabs.includes(tab as (typeof tabs)[number])) notFound();
  const cookie = (await headers()).get("cookie") ?? undefined; const actor = await getCurrentActor(cookie); if (!actor) redirect("/login");
  try {
    const profile = await getProfile(profileId, cookie);
    const profileLeads = tab === "interviews" ? (await listLeads({ profileId }, cookie)).items : [];
    const data = tab === "leads" ? (await listLeads({ profileId }, cookie)).items : tab === "tasks" ? await listTasks({ profileId }, cookie) : tab === "interviews" ? (await Promise.all(profileLeads.map((lead) => listLeadInterviewRounds(lead.id, cookie)))).flat() : tab === "documents" ? await listDocuments(profileId, cookie) : tab === "activity" ? await listActivity({ profileId }, cookie) : tab === "analytics" ? [await getDashboard(cookie, { profileId })] : [];
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1100px] gap-5"><Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href={`/profiles/${profileId}`}>← {profile.name}</Link><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Profile workspace</p><h1 className="mt-2 text-2xl font-bold capitalize text-foreground">{tab}</h1><p className="mt-1.5 text-sm text-muted-foreground">Profile-scoped work and records.</p></div>{tab === "team" ? <Card className="p-5"><p className="text-sm text-muted-foreground">Team assignments are managed from the profile overview.</p><Link className="mt-3 inline-block font-semibold text-primary hover:underline" href={`/profiles/${profileId}`}>Open profile overview →</Link></Card> : data.length === 0 ? <EmptyState description={`No ${tab} are available for this profile yet.`} title={`No ${tab}`} /> : <section className="grid gap-3">{data.map((item, index) => <Card className="p-5" key={"id" in item ? item.id : index}><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{String("jobTitle" in item ? item.jobTitle : "title" in item ? item.title : "action" in item ? item.action : "kpis" in item ? "Analytics summary" : "Interview round")}</p><p className="mt-2 text-sm text-foreground">{String("companyId" in item ? "Employer-linked application" : "message" in item ? item.message : "description" in item && item.description ? item.description : "occurredAt" in item ? item.occurredAt : "Record available")}</p></Card>)}</section>}</div></AppShell>;
  } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this profile tab."} title="Profile tab unavailable" /></AppShell>; }
}
