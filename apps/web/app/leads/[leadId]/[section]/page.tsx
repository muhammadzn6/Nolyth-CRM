import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { ActivityEventSummary, CommentSummary, CommunicationSummary, OfferSummary } from "@orbit/contracts";
import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { OfferActions } from "../../../../components/offers/offer-actions";
import { CollaborationEditForm } from "../../../../components/leads/collaboration-edit-form";
import { CommunicationTimeline } from "../../../../components/leads/communication-timeline";
import { CollaborationCreateAction, OfferDialogAction } from "../../../../components/leads/lead-workspace-actions";
import { LeadWorkspaceShell } from "../../../../components/leads/lead-workspace-shell";
import { ApiClientError, getCurrentActor, getLead, listActivity, listLeadComments, listLeadCommunications, listLeadOffers } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead workspace" };

const sections = ["communications", "comments", "offers", "activity"] as const;
type Section = (typeof sections)[number];

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function formatDate(value: string, timeZone: string): string {
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(date);
}

function humanize(value: string): string {
  const normalized = value.replaceAll(".", " ").replaceAll("_", " ").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function activityActor(item: ActivityEventSummary): string {
  const name = item.actorNameSnapshot ?? "Orbit automation";
  if (!item.actorRoleSnapshot || name.toUpperCase().includes(`(${item.actorRoleSnapshot})`)) return name;
  return `${name} · ${item.actorRoleSnapshot}`;
}

function CommentRecords({ actorId, actorRole, items, timeZone }: { actorId: string; actorRole: "ADMIN" | "BD" | "CLOSER"; items: CommentSummary[]; timeZone: string }) {
  return <section aria-label="comments records" className="grid min-w-0 gap-3">{items.map((item) => <Card className="min-w-0 p-5" key={item.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{humanize(item.visibility)}</p><time className="text-xs text-muted-foreground">{formatDateTime(item.createdAt, timeZone)}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.body}</p>{actorRole === "ADMIN" || item.authorId === actorId ? <CollaborationEditForm item={item} sharedOnly={actorRole === "CLOSER"} timezone={timeZone} /> : null}</Card>)}</section>;
}

function OfferRecords({ items, leadId, timeZone }: { items: OfferSummary[]; leadId: string; timeZone: string }) {
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  return <section aria-label="offers records" className="grid min-w-0 gap-3">{items.map((item) => {
    const milestone = item.startedAt
      ? `Started ${formatDateTime(item.startedAt, timeZone)}`
      : item.startDate
        ? `Starts ${formatDate(item.startDate, timeZone)}`
        : item.acceptedAt
          ? `Accepted ${formatDateTime(item.acceptedAt, timeZone)}`
          : `Created ${formatDateTime(item.createdAt, timeZone)}`;
    return <Card className="min-w-0 p-5" key={item.id}><div className="flex min-w-0 flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{humanize(item.status)}</p><p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground">{item.compensationCurrency} {number.format(Number(item.compensationAmount))}</p><p className="mt-1 text-sm font-medium text-muted-foreground">{item.employmentType}</p></div><OfferDialogAction leadId={leadId} offer={item} timezone={timeZone} /></div><p className="mt-5 whitespace-pre-wrap break-words border-t border-border pt-4 text-sm leading-6 text-foreground">{item.details}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{milestone}</span>{item.decisionDeadline ? <span>Decision due {formatDateTime(item.decisionDeadline, timeZone)}</span> : null}</div><OfferActions id={item.id} startDate={item.startDate} startedAt={item.startedAt} status={item.status} version={item.version} /></Card>;
  })}</section>;
}

function ActivityRecords({ items, timeZone }: { items: ActivityEventSummary[]; timeZone: string }) {
  return <Card className="min-w-0 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border bg-surface-subtle px-5 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Latest activity</p><span className="text-xs font-semibold text-muted-foreground">{items.length} {items.length === 1 ? "event" : "events"}</span></div><ol aria-label="activity records" className="max-h-[42rem] overflow-y-auto px-5">{items.map((item, index) => <li className="relative grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-0" key={item.id}><span className="mt-1.5 size-2 rounded-full bg-primary ring-4 ring-primary-soft" />{index < items.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[0.22rem] top-7 w-px bg-border" /> : null}<div className="min-w-0 sm:flex sm:items-start sm:justify-between sm:gap-5"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{humanize(item.action)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{activityActor(item)} · {humanize(item.entityType)}</p></div><time className="mt-2 block shrink-0 text-xs text-muted-foreground sm:mt-0">{formatDateTime(item.occurredAt, timeZone)}</time></div></li>)}</ol></Card>;
}

export default async function LeadSectionRoute({ params }: { params: Promise<{ leadId: string; section: string }> }) {
  const { leadId, section } = await params;
  if (!sections.includes(section as Section)) notFound();
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (actor.role === "CLOSER" && section === "offers") notFound();

  try {
    const lead = await getLead(leadId, cookie);
    const value = section === "communications" ? await listLeadCommunications(leadId, cookie) : section === "comments" ? await listLeadComments(leadId, cookie) : section === "offers" ? await listLeadOffers(leadId, cookie) : await listActivity({ leadId }, cookie);
    const actorTimezone = actor.timezone ?? "UTC";
    const contacts = lead.contacts.map((entry) => entry.contact);
    const createAction = section === "comments"
      ? <CollaborationCreateAction contacts={contacts} initialVisibility={actor.role === "CLOSER" ? "SHARED_WITH_CLOSER" : "INTERNAL_TEAM"} kind="comments" leadId={leadId} sharedOnly={actor.role === "CLOSER"} timezone={actorTimezone} />
      : section === "communications" && actor.role !== "CLOSER"
        ? <CollaborationCreateAction contacts={contacts} kind="communications" leadId={leadId} recruiterResponse={lead.status === "APPLIED"} timezone={actorTimezone} />
        : section === "offers"
          ? <OfferDialogAction leadId={leadId} timezone={actorTimezone} />
          : null;
    const content = value.length === 0
      ? <EmptyState description={`No ${section} have been recorded for this lead yet.`} title={`No ${section}`} />
      : section === "communications"
        ? <CommunicationTimeline contacts={contacts} editable={actor.role !== "CLOSER"} items={value as CommunicationSummary[]} timeZone={actorTimezone} />
        : section === "comments"
          ? <CommentRecords actorId={actor.id} actorRole={actor.role} items={value as CommentSummary[]} timeZone={actorTimezone} />
          : section === "offers"
            ? <OfferRecords items={value as OfferSummary[]} leadId={leadId} timeZone={actorTimezone} />
            : <ActivityRecords items={value as ActivityEventSummary[]} timeZone={actorTimezone} />;

    return <AppShell actor={actor}><LeadWorkspaceShell activeSection={section as Section} actorRole={actor.role} headerAction={createAction} lead={lead}>{content}</LeadWorkspaceShell></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this workspace section."} title="Workspace unavailable" /></AppShell>;
  }
}
