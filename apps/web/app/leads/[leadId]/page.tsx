import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { UserSummary } from "@orbit/contracts";
import { Card, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, getLead, listCloserEligibility, listUsers } from "../../../lib/api-client";
import { LeadCloserAssignment } from "../../../components/leads/lead-closer-assignment";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailRoute({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let lead;
  try { lead = await getLead(leadId, cookie); }
  catch (reason) { if (reason instanceof ApiClientError && reason.status === 404) notFound(); return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this lead."} title="Lead unavailable" /></AppShell>; }
  let availableClosers: UserSummary[] = [];
  if (actor.role === "ADMIN" || actor.role === "BD") {
    try {
      const [users, eligibility] = await Promise.all([listUsers(cookie), listCloserEligibility(lead.profileId, cookie)]);
      const eligibleIds = new Set(eligibility.filter((assignment) => !assignment.endedAt).map((assignment) => assignment.userId));
      availableClosers = users.filter((user) => user.role === "CLOSER" && user.isActive && eligibleIds.has(user.id));
    } catch {
      availableClosers = [];
    }
  }
  const ownerNames = new Map(availableClosers.map((user) => [user.id, user.displayName]));
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href="/leads">← Leads</Link><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Application</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{lead.jobTitle}</h1><p className="mt-1.5 text-sm text-muted-foreground">{lead.company.canonicalName ? String(lead.company.canonicalName) : "Company"} · Applied {lead.appliedDate}</p></div><span className="w-fit rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{lead.status.replaceAll("_", " ")}</span></div><section className="grid gap-4 md:grid-cols-2"><Card className="p-5"><h2 className="text-base font-bold text-foreground">Lead details</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Location</dt><dd className="mt-1 text-foreground">{lead.location ?? "Not provided"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workplace</dt><dd className="mt-1 text-foreground">{lead.workplaceType ?? "Not provided"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Source</dt><dd className="mt-1 text-foreground">Application source</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Application URL</dt><dd className="mt-1 truncate"><a className="text-primary hover:underline" href={lead.rawUrl}>{lead.rawUrl}</a></dd></div></dl></Card><Card className="p-5"><h2 className="text-base font-bold text-foreground">Ownership</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">BD owner</dt><dd className="mt-1 text-foreground">{actor.role === "BD" ? "You" : "Assigned BD"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Responsible Closer</dt><dd className="mt-1 text-foreground">{actor.role === "CLOSER" ? "You" : lead.responsibleCloserId ? ownerNames.get(lead.responsibleCloserId) ?? "Assigned closer" : "Not assigned"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Profile</dt><dd className="mt-1"><Link className="text-primary hover:underline" href={`/profiles/${lead.profileId}`}>Open candidate profile</Link></dd></div></dl></Card></section>{availableClosers.length > 0 ? <LeadCloserAssignment closers={availableClosers} lead={lead} /> : null}<Card className="p-5"><h2 className="text-base font-bold text-foreground">Contacts</h2>{lead.contacts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{lead.contacts.map((contact) => <div className="rounded-xl border border-border bg-surface-subtle p-4" key={String(contact.id)}><p className="font-semibold text-foreground">{String(contact.name ?? "Unnamed contact")}</p><p className="mt-1 text-sm text-muted-foreground">{String(contact.title ?? "No title")}</p>{contact.email ? <a className="mt-2 block text-sm text-primary hover:underline" href={`mailto:${String(contact.email)}`}>{String(contact.email)}</a> : null}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No contacts attached.</p>}</Card><nav aria-label="Lead workspace sections" className="grid gap-3 sm:grid-cols-4">{[["Communications", "communications"], ["Comments", "comments"], ["Offers", "offers"], ["Activity", "activity"]].map(([label, section]) => <Card className="p-4 transition hover:border-primary/40" key={section}><Link className="font-semibold text-primary hover:underline" href={`/leads/${lead.id}/${section}`}>{label} →</Link></Card>)}</nav></div></AppShell>;
}
