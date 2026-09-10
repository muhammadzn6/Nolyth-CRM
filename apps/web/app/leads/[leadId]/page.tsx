import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { LeadDetail, UserSummary } from "@orbit/contracts";
import { Card, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../components/layout/app-shell";
import { JobLinkActions } from "../../../components/leads/job-link-actions";
import { LeadCloserAssignment } from "../../../components/leads/lead-closer-assignment";
import { LeadEditAction } from "../../../components/leads/lead-edit-action";
import { LeadActionCenter } from "../../../components/leads/lead-action-center";
import { LeadWorkspaceShell } from "../../../components/leads/lead-workspace-shell";
import { ApiClientError, getCurrentActor, getLead, getProfile, listCloserEligibility, listUsers } from "../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead" };

const nextActions: Record<LeadDetail["status"], { href: string; label: string }> = {
  APPLIED: { href: "communications", label: "Track the recruiter response" },
  RESPONSE_RECEIVED: { href: "interviews", label: "Schedule the first interview" },
  INTERVIEWING: { href: "interviews", label: "Manage interview rounds" },
  OFFER_RECEIVED: { href: "offers", label: "Review the offer" },
  OFFER_ACCEPTED: { href: "offers", label: "Confirm placement details" },
  PLACED: { href: "activity", label: "Track the placement" },
  STARTED: { href: "activity", label: "Review the completed journey" },
  CLOSED: { href: "activity", label: "Review closure history" },
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd></div>;
}

function compensationLabel(lead: LeadDetail) {
  if (!lead.compensationMin && !lead.compensationMax) return "Not provided";
  const currency = lead.compensationCurrency ?? "USD";
  const period = lead.compensationPeriod === "HOURLY" ? "hour" : "year";
  const format = (value: string | null) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)) : "—";
  return `${format(lead.compensationMin)} – ${format(lead.compensationMax)} / ${period}`;
}

export default async function LeadDetailRoute({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");

  let lead: LeadDetail;
  try {
    lead = await getLead(leadId, cookie);
  } catch (reason) {
    if (reason instanceof ApiClientError && reason.status === 404) notFound();
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this lead."} title="Lead unavailable" /></AppShell>;
  }

  let availableClosers: UserSummary[] = [];
  let candidateTimezone = "UTC";
  if (actor.role === "ADMIN" || actor.role === "BD") {
    try {
      const [users, eligibility, profile] = await Promise.all([listUsers(cookie), listCloserEligibility(lead.profileId, cookie), getProfile(lead.profileId, cookie)]);
      candidateTimezone = profile.candidate.timezone;
      const eligibleIds = new Set(eligibility.filter((assignment) => !assignment.endedAt).map((assignment) => assignment.userId));
      availableClosers = users.filter((user) => user.role === "CLOSER" && user.isActive && eligibleIds.has(user.id));
    } catch {
      availableClosers = [];
    }
  }

  const nextAction = nextActions[lead.status];
  const nextHref = nextAction.href === "offers" && actor.role === "CLOSER" ? "activity" : nextAction.href;
  const candidate = lead.profile.candidate;
  const candidateName = candidate.preferredName ?? `${candidate.firstName} ${candidate.lastName}`;

  return (
    <AppShell actor={actor}>
      <LeadWorkspaceShell activeSection="overview" actorRole={actor.role} headerAction={actor.role === "CLOSER" ? undefined : <div className="flex items-center gap-2"><LeadEditAction lead={lead} /><LeadActionCenter actorRole={actor.role} closers={availableClosers} contacts={lead.contacts.map((entry) => entry.contact)} leadId={lead.id} timezone={candidateTimezone} /></div>} lead={lead}>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.75fr)]">
          <div className="grid min-w-0 content-start gap-5">
            <Card className="min-w-0 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Application record</p>
                  <h2 className="mt-1 text-lg font-bold text-foreground">Job details</h2>
                </div>
              </div>
              <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2">
                <Detail label="Source" value={lead.sourceRef.name} />
                <Detail label="Applied" value={lead.appliedDate} />
                <Detail label="Location" value={lead.location ?? "Not provided"} />
                <Detail label="Workplace" value={lead.workplaceType ?? "Not provided"} />
                <Detail label="Employment" value={lead.employmentType ?? "Not provided"} />
                <Detail label="Contract" value={lead.contractType ?? "Not provided"} />
                <Detail label="Salary range" value={compensationLabel(lead)} />
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">Job description</dt>
                  <dd className="mt-1 min-w-0 text-sm"><JobLinkActions canonicalUrl={lead.canonicalUrl} rawUrl={lead.rawUrl} /></dd>
                </div>
                {lead.description ? <div className="min-w-0 sm:col-span-2"><dt className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{lead.description}</dd></div> : null}
              </dl>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <header className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recruiting team</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">Contacts</h2>
              </header>
              {lead.contacts.length ? <div className="divide-y divide-border">{lead.contacts.map((leadContact) => {
                const contact = leadContact.contact;
                return <div className="flex min-w-0 flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={leadContact.id}><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="truncate font-semibold text-foreground">{contact.name}</p>{leadContact.isPrimary ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-primary">Primary</span> : null}</div><p className="mt-0.5 truncate text-sm text-muted-foreground">{contact.title ?? leadContact.role.replaceAll("_", " ")}</p></div>{contact.email ? <a className="min-w-0 break-all text-sm font-semibold text-primary hover:underline sm:text-right" href={`mailto:${contact.email}`}>{contact.email}</a> : null}</div>;
              })}</div> : <p className="px-5 pb-6 text-sm text-muted-foreground sm:px-6">No contacts attached.</p>}
            </Card>
          </div>

          <aside className="min-w-0">
            <Card className="min-w-0 overflow-hidden">
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">People</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">Ownership</h2>
                <dl className="mt-5 grid gap-4">
                  <Detail label="Candidate" value={<Link className="font-semibold text-primary hover:underline" href={`/profiles/${lead.profileId}`}>{candidateName}</Link>} />
                  <Detail label="BD owner" value={lead.currentOwner.displayName} />
                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <Detail label="Responsible Closer" value={lead.responsibleCloser?.displayName ?? "Not assigned"} />
                    {availableClosers.length ? <LeadCloserAssignment closers={availableClosers} lead={lead} /> : null}
                  </div>
                </dl>
              </div>
              <div className="border-t border-border bg-surface-subtle px-5 py-4 sm:px-6">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">Next action</p>
                <Link className="mt-1.5 inline-flex text-sm font-bold text-primary hover:underline" href={`/leads/${lead.id}/${nextHref}`}>{nextAction.label} →</Link>
              </div>
            </Card>
          </aside>
        </div>
      </LeadWorkspaceShell>
    </AppShell>
  );
}
