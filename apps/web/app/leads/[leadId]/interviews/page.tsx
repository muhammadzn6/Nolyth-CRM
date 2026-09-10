import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserSummary } from "@orbit/contracts";
import { EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { InterviewRoundCard } from "../../../../components/interviews/interview-edit-form";
import { InterviewCreateAction } from "../../../../components/leads/lead-workspace-actions";
import { LeadWorkspaceShell } from "../../../../components/leads/lead-workspace-shell";
import { ApiClientError, getCurrentActor, getLead, getProfile, listCloserEligibility, listLeadInterviewRounds, listUsers } from "../../../../lib/api-client";

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
    const [rounds, profile] = await Promise.all([listLeadInterviewRounds(leadId, cookie), getProfile(lead.profileId, cookie)]);
    let closers: UserSummary[] = [];
    if (actor.role === "ADMIN" || actor.role === "BD") {
      const [users, eligibility] = await Promise.all([listUsers(cookie), listCloserEligibility(lead.profileId, cookie)]);
      const eligibleIds = new Set(eligibility.filter((assignment) => !assignment.endedAt).map((assignment) => assignment.userId));
      closers = users.filter((user) => user.role === "CLOSER" && user.isActive && eligibleIds.has(user.id));
    }
    const closerNames = new Map(closers.map((closer) => [closer.id, closer.displayName]));
    if (actor.role === "CLOSER") closerNames.set(actor.id, actor.displayName);
    const action = actor.role === "ADMIN" || actor.role === "BD" ? <InterviewCreateAction closers={closers} leadId={leadId} timezone={profile.candidate.timezone} /> : null;

    return <AppShell actor={actor}><LeadWorkspaceShell activeSection="interviews" actorRole={actor.role} headerAction={action} lead={lead}>{rounds.length === 0 ? <EmptyState description="Scheduled rounds will appear here." title="No interviews" /> : <section aria-label="Interview rounds" className="grid min-w-0 gap-3">{rounds.map((round) => <InterviewRoundCard actorRole={actor.role} closerName={round.closerId ? closerNames.get(round.closerId) : undefined} initiallyEditing={round.id === editId} key={round.id} round={round} />)}</section>}</LeadWorkspaceShell></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load lead interviews."} title="Interviews unavailable" /></AppShell>;
  }
}
