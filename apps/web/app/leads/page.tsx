import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, listLeads, getCurrentActor, listUsers, listCompanies } from "../../lib/api-client";
import { Card, ErrorState } from "@orbit/ui";
import { CsvExportButton } from "../../components/data/csv-export-button";
import { BulkImportForm } from "../../components/data/bulk-import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

export default async function LeadsRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let leads;
  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let companies: Awaited<ReturnType<typeof listCompanies>> = [];
  try {
    [leads, users, companies] = await Promise.all([
      listLeads({}, cookie),
      actor.role === "ADMIN" ? listUsers(cookie) : Promise.resolve([]),
      listCompanies(cookie),
    ]);
  }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load leads."} title="Leads unavailable" /></AppShell>; }
  const userNames = new Map(users.map((user) => [user.id, user.displayName]));
  const companyNames = new Map(companies.map((company) => [company.id, company.canonicalName]));
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1500px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Pipeline</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Leads</h1><p className="mt-1.5 text-sm text-muted-foreground">Applications and ownership across candidate profiles.</p></div><CsvExportButton columns={[{ key: "jobTitle", label: "Job title" }, { key: "companyName", label: "Company" }, { key: "status", label: "Status" }, { key: "appliedDate", label: "Applied" }, { key: "currentOwnerId", label: "Owner" }]} filename="orbit-leads.csv" rows={leads.items} /></div><BulkImportForm kind="lead" /><Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-4">Role</th><th className="px-5 py-4">Company</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Applied</th><th className="px-5 py-4">Owner</th></tr></thead><tbody className="divide-y divide-border">{leads.items.map((lead) => <tr className="hover:bg-surface-subtle" key={lead.id}><td className="px-5 py-4 font-semibold"><Link className="text-primary hover:underline" href={`/leads/${lead.id}`}>{lead.jobTitle}</Link></td><td className="px-5 py-4 text-muted-foreground">{lead.companyName ?? companyNames.get(lead.companyId) ?? "Unlinked company"}</td><td className="px-5 py-4"><span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{lead.status.replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-muted-foreground">{lead.appliedDate}</td><td className="px-5 py-4 text-muted-foreground">{actor.role === "BD" ? "You" : userNames.get(lead.currentOwnerId) ?? (actor.role === "CLOSER" ? "Pipeline owner" : "Unassigned")}</td></tr>)}{leads.items.length === 0 && <tr><td className="px-5 py-10 text-center text-muted-foreground" colSpan={5}>No active leads yet.</td></tr>}</tbody></table></div></Card></div></AppShell>;
}
