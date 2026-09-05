import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserSummary } from "@orbit/contracts";
import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { InterviewForm } from "../../../../components/interviews/interview-form";
import { InterviewRoundCard } from "../../../../components/interviews/interview-edit-form";
import { ApiClientError, getCurrentActor, getLead, listCloserEligibility, listLeadInterviewRounds, listUsers } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead interviews" };

export default async function LeadInterviewsRoute({ params, searchParams }: { params: Promise<{ leadId: string }>; searchParams?: Promise<{ edit?: string | string[] }> }) {
  const { leadId } = await params;
  const query = searchParams ? await searchParams : {};
  const editId = Array.isArray(query.edit) ? query.edit[0] : query.edit;
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  try {
    const lead = await getLead(leadId, cookie);
    const rounds = await listLeadInterviewRounds(leadId, cookie);
    let closers: UserSummary[] = [];
    if (actor.role === "ADMIN" || actor.role === "BD") {
      const [users, eligibility] = await Promise.all([listUsers(cookie), listCloserEligibility(lead.profileId, cookie)]);
      const eligibleIds = new Set(eligibility.filter((assignment) => !assignment.endedAt).map((assignment) => assignment.userId));
      closers = users.filter((user) => user.role === "CLOSER" && user.isActive && eligibleIds.has(user.id));
    }
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1100px] gap-5"><Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href={`/leads/${leadId}`}>← {lead.jobTitle}</Link><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Lead workspace</p><h1 className="mt-2 text-2xl font-bold text-foreground">Interviews</h1><p className="mt-1.5 text-sm text-muted-foreground">Schedule and manage interview rounds for this application.</p></div>{actor.role === "ADMIN" || actor.role === "BD" ? <InterviewForm closers={await closers} leadId={leadId} /> : null}{rounds.length === 0 ? <EmptyState description="Scheduled rounds will appear here." title="No interviews" /> : <section className="grid gap-3">{rounds.map((round) => <InterviewRoundCard actorRole={actor.role} initiallyEditing={round.id === editId} key={round.id} round={round} />)}</section>}</div></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load lead interviews."} title="Interviews unavailable" /></AppShell>;
  }
}
