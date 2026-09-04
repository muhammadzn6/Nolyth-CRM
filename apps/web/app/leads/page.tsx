import type { Metadata } from "next";
import { leadStatusSchema } from "@orbit/contracts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, listLeads, getCurrentActor, listUsers, listProfiles } from "../../lib/api-client";
import { Card, ErrorState } from "@orbit/ui";
import { CsvExportButton } from "../../components/data/csv-export-button";
import { BulkImportForm } from "../../components/data/bulk-import-form";
import { LeadCaptureForm } from "../../components/leads/lead-capture-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Applications" };

export default async function LeadsRoute({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const requestedStatus = leadStatusSchema.safeParse((await searchParams)?.status).success
    ? leadStatusSchema.parse((await searchParams)?.status)
    : undefined;
  let leads;
  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let profiles: Awaited<ReturnType<typeof listProfiles>> = { items: [], nextCursor: null };
  try {
    [leads, users, profiles] = await Promise.all([
      listLeads({ status: requestedStatus }, cookie),
      actor.role === "ADMIN" ? listUsers(cookie) : Promise.resolve([]),
      actor.role === "BD" ? listProfiles({}, cookie) : Promise.resolve({ items: [], nextCursor: null }),
    ]);
  }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load applications."} title="Applications unavailable" /></AppShell>; }
  const userNames = new Map(users.map((user) => [user.id, user.displayName]));
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1500px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Pipeline</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Applications</h1><p className="mt-1.5 text-sm text-muted-foreground">Track every application from submission to recruiter response and interview.</p></div><CsvExportButton columns={[{ key: "jobTitle", label: "Job title" }, { key: "companyName", label: "Company" }, { key: "status", label: "Status" }, { key: "appliedDate", label: "Applied" }, { key: "currentOwnerId", label: "Owner" }]} filename="orbit-applications.csv" rows={leads.items} /></div>{actor.role === "BD" && profiles.items.length > 0 ? <LeadCaptureForm actorId={actor.id} profiles={profiles.items} /> : null}<BulkImportForm kind="lead" /><Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-4">Role</th><th className="px-5 py-4">Company</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Applied</th><th className="px-5 py-4">Owner</th></tr></thead><tbody className="divide-y divide-border">{leads.items.map((lead) => <tr className="hover:bg-surface-subtle" key={lead.id}><td className="px-5 py-4 font-semibold"><Link className="text-primary hover:underline" href={`/leads/${lead.id}`}>{lead.jobTitle}</Link></td><td className="px-5 py-4 text-muted-foreground">{lead.companyName ?? "Company not recorded"}</td><td className="px-5 py-4"><span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{lead.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-muted-foreground">{lead.appliedDate}</td><td className="px-5 py-4 text-muted-foreground">{actor.role === "BD" ? "You" : userNames.get(lead.currentOwnerId) ?? (actor.role === "CLOSER" ? "Pipeline owner" : "Unassigned")}</td></tr>)}{leads.items.length === 0 && <tr><td className="px-5 py-10 text-center text-muted-foreground" colSpan={5}>No applications yet.</td></tr>}</tbody></table></div></Card></div></AppShell>;
}
