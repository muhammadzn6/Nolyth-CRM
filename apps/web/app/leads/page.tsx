import type { Metadata } from "next";
import Form from "next/form";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { LeadListQuery, LeadStatus, UserRole } from "@orbit/contracts";
import { Button, Card, ErrorState, Field, Input } from "@orbit/ui";

import { CsvExportButton } from "../../components/data/csv-export-button";
import { AppShell } from "../../components/layout/app-shell";
import { LeadPageActions } from "../../components/leads/lead-page-actions";
import {
  ApiClientError,
  getCurrentActor,
  listCompanies,
  listLeads,
  listProfiles,
  listUsers,
} from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

const pipelineStages = ["APPLIED", "ACTIVE", "INTERVIEW", "OFFER", "PLACEMENT"] as const;

type PipelineStage = NonNullable<LeadListQuery["pipelineStage"]>;
type LeadsRouteProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    new?: string | string[];
    pipelineStage?: string | string[];
    search?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function leadsHref({ cursor, pipelineStage, search }: { cursor?: string; pipelineStage?: PipelineStage; search?: string }) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (pipelineStage) params.set("pipelineStage", pipelineStage);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}

function scopeTitle(role: UserRole) {
  if (role === "ADMIN") return "All applications";
  if (role === "BD") return "My applications";
  return "Assigned applications";
}

function scopeDescription(role: UserRole) {
  if (role === "ADMIN") return "Review every submitted role and owner handoff.";
  if (role === "BD") return "Track your submissions and recruiter responses.";
  return "Follow the applications assigned to your interview queue.";
}

function statusLabel(status: LeadStatus) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: LeadStatus) {
  if (status === "APPLIED") return "bg-surface-subtle text-muted-foreground";
  if (status === "RESPONSE_RECEIVED") return "bg-warning-soft text-warning-foreground";
  if (status === "INTERVIEWING") return "bg-info-soft text-info";
  if (status === "OFFER_RECEIVED" || status === "OFFER_ACCEPTED") return "bg-primary/10 text-primary";
  if (status === "PLACED" || status === "STARTED") return "bg-success-soft text-success";
  return "bg-danger-soft text-danger";
}

function formatAppliedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

export default async function LeadsRoute({ searchParams }: LeadsRouteProps) {
  const query = await searchParams;
  const showApplicationIntake = firstValue(query.new) === "application";
  const search = firstValue(query.search);
  const cursor = firstValue(query.cursor);
  const rawPipelineStage = firstValue(query.pipelineStage);
  const pipelineStage = pipelineStages.find((stage) => stage === rawPipelineStage) as PipelineStage | undefined;
  const filtersApplied = Boolean(search || pipelineStage);
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");

  let leads;
  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let companies: Awaited<ReturnType<typeof listCompanies>> = [];
  let profiles: Awaited<ReturnType<typeof listProfiles>> | undefined;

  try {
    [leads, users, companies] = await Promise.all([
      listLeads({
        ...(search ? { search } : {}),
        ...(pipelineStage ? { pipelineStage } : {}),
        ...(cursor ? { cursor } : {}),
        limit: 50,
      }, cookie),
      actor.role === "ADMIN" ? listUsers(cookie) : Promise.resolve([]),
      listCompanies(cookie),
    ]);
  } catch (reason) {
    return (
      <AppShell actor={actor}>
        <ErrorState
          description={reason instanceof ApiClientError ? reason.message : "Orbit could not load leads."}
          title="Leads unavailable"
        />
      </AppShell>
    );
  }

  const userNames = new Map(users.map((user) => [user.id, user.displayName]));
  const companyNames = new Map(companies.map((company) => [company.id, company.canonicalName]));
  if (actor.role === "BD") profiles = await listProfiles({}, cookie);

  const ownerName = (ownerId: string) => {
    if (actor.role === "BD") return "You";
    if (actor.role === "CLOSER") return "Pipeline owner";
    return userNames.get(ownerId) ?? "Unassigned";
  };
  const firstPageHref = leadsHref({ pipelineStage, search });
  const nextPageHref = leads.nextCursor
    ? leadsHref({ cursor: leads.nextCursor, pipelineStage, search })
    : undefined;

  return (
    <AppShell actor={actor}>
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Pipeline</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Applications</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <LeadPageActions actor={actor} defaultOpen={showApplicationIntake && actor.role === "BD"} profiles={profiles?.items ?? []} />
            <CsvExportButton
              columns={[
                { key: "jobTitle", label: "Job title" },
                { key: "companyName", label: "Company" },
                { key: "status", label: "Status" },
                { key: "appliedDate", label: "Applied" },
                { key: "currentOwnerId", label: "Owner" },
              ]}
              filename="orbit-leads.csv"
              rows={leads.items}
            />
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-2 border-b border-border/70 bg-surface-subtle/55 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <div>
              <h2 className="font-bold text-foreground">{scopeTitle(actor.role)}</h2>
              <p className="sr-only">{scopeDescription(actor.role)}</p>
            </div>
            <p className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground" title="Applications in this view">{leads.items.length}</p>
          </div>

          <Form action="/leads" aria-label="Filter applications" className="grid gap-3 border-b border-border/70 p-4 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-end md:p-5" scroll={false}>
            <Field htmlFor="application-search" label="Search applications">
              <Input defaultValue={search} id="application-search" name="search" placeholder="Search applications" />
            </Field>
            <Field htmlFor="application-stage" label="Pipeline stage">
              <select
                className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15"
                defaultValue={pipelineStage ?? ""}
                id="application-stage"
                name="pipelineStage"
              >
                <option value="">All stages</option>
                <option value="APPLIED">Applied</option>
                <option value="ACTIVE">Active</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="PLACEMENT">Placement</option>
              </select>
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1 md:flex-none" type="submit" variant="secondary">Apply</Button>
              {filtersApplied ? <Link className="inline-flex h-10 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-muted-foreground transition hover:bg-surface-subtle hover:text-foreground" href="/leads">Clear</Link> : null}
            </div>
          </Form>

          {leads.items.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-5 py-12 text-center">
              <div className="max-w-md">
                <span aria-hidden="true" className="mx-auto grid size-10 place-items-center rounded-xl bg-info-soft text-info">⌕</span>
                <h2 className="mt-4 text-lg font-bold text-foreground">{filtersApplied ? "No applications match these filters" : "No applications yet"}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {filtersApplied
                    ? "Try another job title, company, or pipeline stage."
                    : actor.role === "BD"
                      ? "Use Add application to record the first submitted role."
                      : "Applications in your role scope will appear here."}
                </p>
                {filtersApplied ? <Link className="mt-4 inline-flex font-semibold text-primary hover:underline" href="/leads">Clear filters</Link> : null}
              </div>
            </div>
          ) : (
            <>
              <div aria-label="Application cards" className="divide-y divide-border/70 sm:hidden">
                {leads.items.map((lead) => (
                  <Link className="block p-5 outline-none transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle" href={`/leads/${lead.id}`} key={lead.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words font-bold leading-5 text-foreground">{lead.jobTitle}</h2>
                        <p className="mt-1 break-words text-sm text-muted-foreground">{lead.companyName ?? companyNames.get(lead.companyId) ?? "Unlinked company"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span>Applied {formatAppliedDate(lead.appliedDate)}</span>
                      <span>Owner: {ownerName(lead.currentOwnerId)}</span>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="data-scroll-region hidden max-h-[calc(100vh-18rem)] min-h-[28rem] overflow-auto sm:block">
                <table aria-label="Application records" className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shadow-[0_1px_0_var(--border)]">
                    <tr><th className="px-5 py-3.5">Role</th><th className="px-5 py-3.5">Company</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Applied</th><th className="px-5 py-3.5">Owner</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {leads.items.map((lead) => (
                      <tr className="transition-colors hover:bg-surface-subtle" key={lead.id}>
                        <td className="px-5 py-4 font-semibold"><Link className="text-foreground outline-none hover:text-primary focus-visible:text-primary" href={`/leads/${lead.id}`}>{lead.jobTitle}</Link></td>
                        <td className="px-5 py-4 text-muted-foreground">{lead.companyName ?? companyNames.get(lead.companyId) ?? "Unlinked company"}</td>
                        <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span></td>
                        <td className="px-5 py-4 text-muted-foreground">{formatAppliedDate(lead.appliedDate)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{ownerName(lead.currentOwnerId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {cursor || nextPageHref ? (
            <nav aria-label="Application pagination" className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 sm:px-5">
              {cursor ? <Link className="text-sm font-semibold text-muted-foreground hover:text-foreground" href={firstPageHref}>First page</Link> : <span />}
              {nextPageHref ? <Link className="text-sm font-semibold text-primary hover:underline" href={nextPageHref}>Next 50<span aria-hidden="true"> →</span></Link> : <span className="text-xs text-muted-foreground">End of results</span>}
            </nav>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
