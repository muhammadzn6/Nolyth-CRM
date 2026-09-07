import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, listLeads, getCurrentActor, listUsers, listCompanies, listProfiles } from "../../lib/api-client";
import { Card, ErrorState } from "@orbit/ui";
import type { LeadListQuery } from "@orbit/contracts";
import { CsvExportButton } from "../../components/data/csv-export-button";
import { LeadPageActions } from "../../components/leads/lead-page-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

type PipelineStage = NonNullable<LeadListQuery["pipelineStage"]>;
type LeadsRouteProps = { searchParams: Promise<{ new?: string | string[]; pipelineStage?: string | string[] }> };

export default async function LeadsRoute({ searchParams }: LeadsRouteProps) {
  const query = await searchParams;
  const showApplicationIntake = query.new === "application";
  const rawPipelineStage = Array.isArray(query.pipelineStage) ? query.pipelineStage[0] : query.pipelineStage;
  const pipelineStage = (["APPLIED", "ACTIVE", "INTERVIEW", "OFFER", "PLACEMENT"] as const).find((stage) => stage === rawPipelineStage) as PipelineStage | undefined;
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let leads;
  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let companies: Awaited<ReturnType<typeof listCompanies>> = [];
  let profiles: Awaited<ReturnType<typeof listProfiles>> | undefined;
  try {
    [leads, users, companies] = await Promise.all([
      listLeads(pipelineStage ? { pipelineStage } : {}, cookie),
      actor.role === "ADMIN" ? listUsers(cookie) : Promise.resolve([]),
      listCompanies(cookie),
    ]);
  }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load leads."} title="Leads unavailable" /></AppShell>; }
  const userNames = new Map(users.map((user) => [user.id, user.displayName]));
  const companyNames = new Map(companies.map((company) => [company.id, company.canonicalName]));
  if (actor.role === "BD") profiles = await listProfiles({}, cookie);
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1500px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Pipeline</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Applications</h1><p className="mt-1.5 text-sm text-muted-foreground">Browse every submitted role, recruiter response, and owner handoff.</p></div><div className="flex flex-wrap gap-2"><LeadPageActions actor={actor} defaultOpen={showApplicationIntake && actor.role === "BD"} profiles={profiles?.items ?? []} /><CsvExportButton columns={[{ key: "jobTitle", label: "Job title" }, { key: "companyName", label: "Company" }, { key: "status", label: "Status" }, { key: "appliedDate", label: "Applied" }, { key: "currentOwnerId", label: "Owner" }]} filename="orbit-leads.csv" rows={leads.items} /></div></div><Card className="overflow-hidden p-0"><div className="data-scroll-region max-h-[calc(100vh-13rem)] min-h-[28rem] overflow-auto"><table aria-label="Application records" className="w-full min-w-[760px] text-left text-sm"><thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shadow-[0_1px_0_var(--border)]"><tr><th className="px-5 py-3.5">Role</th><th className="px-5 py-3.5">Company</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Applied</th><th className="px-5 py-3.5">Owner</th></tr></thead><tbody className="divide-y divide-border">{leads.items.map((lead) => <tr className="transition-colors hover:bg-primary/5" key={lead.id}><td className="px-5 py-4 font-semibold"><Link className="text-foreground hover:text-primary" href={`/leads/${lead.id}`}>{lead.jobTitle}</Link></td><td className="px-5 py-4 text-muted-foreground">{lead.companyName ?? companyNames.get(lead.companyId) ?? "Unlinked company"}</td><td className="px-5 py-4"><span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{lead.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-muted-foreground">{lead.appliedDate}</td><td className="px-5 py-4 text-muted-foreground">{actor.role === "BD" ? "You" : userNames.get(lead.currentOwnerId) ?? (actor.role === "CLOSER" ? "Pipeline owner" : "Unassigned")}</td></tr>)}{leads.items.length === 0 && <tr><td className="px-5 py-10 text-center text-muted-foreground" colSpan={5}>No applications in this view.</td></tr>}</tbody></table></div></Card></div></AppShell>;
}
