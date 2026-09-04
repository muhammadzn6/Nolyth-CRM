import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { CommentSummary, CommunicationSummary } from "@orbit/contracts";
import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { OfferActions } from "../../../../components/offers/offer-actions";
import { CollaborationForm } from "../../../../components/leads/collaboration-form";
import { CollaborationEditForm } from "../../../../components/leads/collaboration-edit-form";
import { OfferForm } from "../../../../components/offers/offer-form";
import { ApiClientError, getCurrentActor, getLead, listActivity, listLeadComments, listLeadCommunications, listLeadOffers } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead workspace" };
const sections = ["communications", "comments", "offers", "activity"] as const;
type Section = (typeof sections)[number];

export default async function LeadSectionRoute({ params }: { params: Promise<{ leadId: string; section: string }> }) {
  const { leadId, section } = await params;
  if (!sections.includes(section as Section)) notFound();
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  try {
    const lead = await getLead(leadId, cookie);
    const value = section === "communications" ? await listLeadCommunications(leadId, cookie) : section === "comments" ? await listLeadComments(leadId, cookie) : section === "offers" ? await listLeadOffers(leadId, cookie) : await listActivity({ leadId }, cookie);
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1100px] gap-5"><Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href={`/leads/${leadId}`}>← {lead.jobTitle}</Link><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Lead workspace</p><h1 className="mt-2 text-2xl font-bold capitalize text-foreground">{section}</h1><p className="mt-1.5 text-sm text-muted-foreground">{lead.company.canonicalName ? String(lead.company.canonicalName) : "Application record"}</p></div>{section === "comments" || section === "communications" ? <CollaborationForm kind={section} leadId={leadId} /> : null}{section === "offers" ? <OfferForm leadId={leadId} /> : null}{value.length === 0 ? <EmptyState description={`No ${section} have been recorded for this lead yet.`} title={`No ${section}`} /> : <section className="grid gap-3">{value.map((item) => <Card className="p-5" key={item.id}>{section === "offers" && "status" in item ? <OfferForm leadId={leadId} offer={item} /> : null}<p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{String("action" in item ? item.action : "type" in item ? item.type : "status" in item ? item.status : "Comment")}</p><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{String("body" in item ? item.body : "message" in item ? item.message : "details" in item ? item.details : "subject" in item && item.subject ? item.subject : "Recorded workspace event")}</p><p className="mt-3 text-xs text-muted-foreground">{String("occurredAt" in item ? item.occurredAt : "createdAt" in item ? item.createdAt : "")}</p>{section === "comments" || section === "communications" ? <CollaborationEditForm item={item as CommentSummary | CommunicationSummary} /> : null}{section === "offers" && "status" in item ? <OfferActions id={item.id} startDate={item.startDate} status={item.status} version={item.version} /> : null}</Card>)}</section>}</div></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this workspace section."} title="Workspace unavailable" /></AppShell>;
  }
}
