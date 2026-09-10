import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState, Input } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listCandidates, listCompanies, listLeads, listProfiles, listUsers } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

type SearchParams = { q?: string | string[] };

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function statusTone(status: string) {
  if (["PLACED", "STARTED", "ACTIVE"].includes(status)) return "bg-success-soft text-success";
  if (["INTERVIEWING", "RESPONSE_RECEIVED"].includes(status)) return "bg-info-soft text-info";
  return "bg-surface-subtle text-muted-foreground";
}

export default async function SearchRoute({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const query = firstValue((await searchParams)?.q);

  if (!query) {
    return <AppShell actor={actor}><div className="mx-auto max-w-[1100px]"><Card className="p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-action">Orbit search</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground">Find anything</h1><p className="mt-2 text-sm text-muted-foreground">Search people, applications, profiles, companies, or recruiters.</p><form action="/search" className="mt-6" role="search"><label className="sr-only" htmlFor="search-page-input">Search Orbit</label><Input autoFocus id="search-page-input" name="q" placeholder="Search by name, recruiter, company, role, or URL" type="search" /></form></Card></div></AppShell>;
  }

  try {
    const [leads, profiles, companies, candidates, users] = await Promise.all([
      listLeads({ search: query, limit: 30 }, cookie),
      listProfiles({ search: query, limit: 30 }, cookie),
      listCompanies({ search: query, limit: 30 }, cookie),
      actor.role === "ADMIN" ? listCandidates({ search: query, limit: 30 }, cookie) : Promise.resolve({ items: [], nextCursor: null }),
      actor.role === "ADMIN" ? listUsers(cookie) : Promise.resolve([]),
    ]);
    const matchedUsers = users.filter((user) => `${user.displayName} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()));
    const total = leads.items.length + profiles.items.length + companies.length + candidates.items.length + matchedUsers.length;

    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1400px] gap-5"><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-action">Orbit search</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground">Results for “{query}”</h1><p className="mt-1 text-sm text-muted-foreground">{total} matches across your workspace.</p></header><Card className="p-4 sm:p-5"><form action="/search" className="flex gap-3" role="search"><label className="sr-only" htmlFor="search-results-input">Search Orbit</label><Input defaultValue={query} id="search-results-input" name="q" placeholder="Search Orbit" type="search" /><button className="shrink-0 rounded-full bg-action px-4 text-sm font-bold text-action-foreground transition hover:bg-action-hover" type="submit">Search</button></form></Card>{total === 0 ? <EmptyState description="Try a different name, recruiter, company, role, or URL." title="No matches" /> : <div className="grid gap-5 lg:grid-cols-2">{leads.items.length > 0 ? <Card className="overflow-hidden p-0"><SectionHeading count={leads.items.length} title="Applications" /><div className="max-h-[24rem] divide-y divide-border/70 overflow-y-auto">{leads.items.map((lead) => <Link className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-action/5" href={`/leads/${lead.id}`} key={lead.id}><span className="min-w-0"><strong className="block truncate text-sm text-foreground">{lead.jobTitle}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{lead.companyName} · {lead.sourceId}</span></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(lead.status)}`}>{lead.status.replaceAll("_", " ")}</span></Link>)}</div></Card> : null}{profiles.items.length > 0 ? <Card className="overflow-hidden p-0"><SectionHeading count={profiles.items.length} title="Profiles" /><div className="max-h-[24rem] divide-y divide-border/70 overflow-y-auto">{profiles.items.map((profile) => <Link className="block px-4 py-3.5 transition hover:bg-action/5" href={`/profiles/${profile.id}`} key={profile.id}><strong className="block truncate text-sm text-foreground">{profile.name}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{profile.targetRoles.join(" · ") || "Profile"}</span></Link>)}</div></Card> : null}{companies.length > 0 ? <Card className="overflow-hidden p-0"><SectionHeading count={companies.length} title="Companies" /><div className="max-h-[24rem] divide-y divide-border/70 overflow-y-auto">{companies.map((company) => <Link className="block px-4 py-3.5 transition hover:bg-action/5" href={`/leads?search=${encodeURIComponent(company.canonicalName)}`} key={company.id}><strong className="block truncate text-sm text-foreground">{company.canonicalName}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{company.domain ?? company.industry ?? company.location ?? "Company"}</span></Link>)}</div></Card> : null}{candidates.items.length > 0 ? <Card className="overflow-hidden p-0"><SectionHeading count={candidates.items.length} title="Candidates" /><div className="max-h-[24rem] divide-y divide-border/70 overflow-y-auto">{candidates.items.map((candidate) => <Link className="block px-4 py-3.5 transition hover:bg-action/5" href={`/candidates/${candidate.id}`} key={candidate.id}><strong className="block truncate text-sm text-foreground">{candidate.preferredName || `${candidate.firstName} ${candidate.lastName}`}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{candidate.email ?? candidate.location ?? "Candidate"}</span></Link>)}</div></Card> : null}{matchedUsers.length > 0 ? <Card className="overflow-hidden p-0"><SectionHeading count={matchedUsers.length} title="People" /><div className="max-h-[24rem] divide-y divide-border/70 overflow-y-auto">{matchedUsers.map((user) => <div className="px-4 py-3.5" key={user.id}><strong className="block truncate text-sm text-foreground">{user.displayName}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{user.email} · {user.role}</span></div>)}</div></Card> : null}</div>}</div></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not complete this search."} title="Search unavailable" /></AppShell>;
  }
}

function SectionHeading({ count, title }: { count: number; title: string }) {
  const icons: Record<string, string> = { Applications: "□", Profiles: "◎", Companies: "⌂", Candidates: "♙", People: "♙" };
  return <header className="flex items-center justify-between border-b border-border/70 bg-surface-subtle/55 px-4 py-3"><h2 className="inline-flex items-center gap-2 text-sm font-bold text-foreground"><span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-action-soft text-xs text-action">{icons[title] ?? "·"}</span>{title}</h2><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground" title={`${count} ${title.toLowerCase()}`}>{count}</span></header>;
}
