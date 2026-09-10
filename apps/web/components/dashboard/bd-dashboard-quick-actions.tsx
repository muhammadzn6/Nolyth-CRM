"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadDetail, LeadSummary, ProfileSummary, UserSummary } from "@orbit/contracts";

import { getLead, listCloserEligibility, listLeads } from "../../lib/api-client";
import { Button } from "@orbit/ui";
import { CollaborationForm } from "../leads/collaboration-form";
import { InterviewForm } from "../interviews/interview-form";
import { LeadCaptureForm } from "../leads/lead-capture-form";
import { Dialog } from "../ui/dialog";

type DashboardAction = "communication" | "response" | "comment" | "interview";
type ApplicationPickerProps = { applications: LeadSummary[]; profiles: ProfileSummary[]; onSelect: (leadId: string) => void; onSearch?: (query: string) => Promise<LeadSummary[]> };

const actionLabels: Record<DashboardAction, string> = {
  communication: "Log communication",
  response: "Log recruiter response",
  comment: "Add comment",
  interview: "Schedule interview",
};

const statusFilters = [
  ["", "All stages"],
  ["APPLIED", "Applied"],
  ["RESPONSE_RECEIVED", "Response received"],
  ["INTERVIEWING", "Interviewing"],
  ["OFFER_RECEIVED", "Offer received"],
  ["CLOSED", "Closed"],
] as const;

const dateFilters = [
  ["", "Any date"],
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
] as const;

function applicationPlatform(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Job platform";
  }
}

function matchesDateFilter(appliedDate: string, dateFilter: string) {
  if (!dateFilter) return true;
  const applied = new Date(`${appliedDate}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = dateFilter === "today" ? 0 : dateFilter === "7d" ? 7 : 30;
  const earliest = today.getTime() - days * 24 * 60 * 60 * 1000;
  return applied >= earliest && applied <= today.getTime();
}

export function ApplicationPicker({ applications, profiles, onSelect, onSearch }: ApplicationPickerProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [remoteApplications, setRemoteApplications] = useState<LeadSummary[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const profileNames = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.name])), [profiles]);
  const searchPool = useMemo(() => {
    const merged = new Map(applications.map((application) => [application.id, application]));
    remoteApplications.forEach((application) => merged.set(application.id, application));
    return [...merged.values()];
  }, [applications, remoteApplications]);
  const companyOptions = useMemo(() => [...new Set(applications.map((application) => application.companyName).filter(Boolean))].sort(), [applications]);
  const platformOptions = useMemo(() => [...new Set(applications.map((application) => applicationPlatform(application.rawUrl)))].sort(), [applications]);
  const filteredApplications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return searchPool.filter((application) => {
      if (stage && application.status !== stage) return false;
      if (company && application.companyName !== company) return false;
      if (platform && applicationPlatform(application.rawUrl) !== platform) return false;
      if (!matchesDateFilter(application.appliedDate, dateFilter)) return false;
      if (!normalizedSearch) return true;
      return [
        application.jobTitle,
        application.companyName,
        application.rawUrl,
        profileNames.get(application.profileId),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    });
  }, [company, dateFilter, platform, profileNames, search, searchPool, stage]);

  useEffect(() => {
    if (!onSearch || search.trim().length < 2) {
      setRemoteApplications([]);
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    const searchTimer = window.setTimeout(() => {
      setRemoteLoading(true);
      void onSearch(search.trim()).then((results) => {
        if (!cancelled) setRemoteApplications(results);
      }).catch(() => {
        if (!cancelled) setRemoteApplications([]);
      }).finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(searchTimer);
    };
  }, [onSearch, search]);

  const activeFilterCount = [stage, company, platform, dateFilter].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setStage("");
    setCompany("");
    setPlatform("");
    setDateFilter("");
    setActiveIndex(0);
  }

  useEffect(() => {
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredApplications.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && filteredApplications[activeIndex]) {
      event.preventDefault();
      onSelect(filteredApplications[activeIndex].id);
    }
  }

  return <div className="grid gap-3" aria-label="Application picker">
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">⌕</span>
      <input aria-label="Search applications" autoFocus className="h-12 w-full rounded-xl border border-border bg-surface px-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-focus/15" onChange={(event) => { setSearch(event.target.value); setActiveIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder="Search applications" ref={searchRef} value={search} />
    </div>
    <div className="relative flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{remoteLoading ? "Searching…" : `${filteredApplications.length} match${filteredApplications.length === 1 ? "" : "es"}`}</span>
      <button aria-expanded={filtersOpen} aria-label="Filter applications" className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${filtersOpen || activeFilterCount ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`} onClick={() => setFiltersOpen((open) => !open)} type="button">
        <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
        Filter{activeFilterCount ? ` · ${activeFilterCount}` : ""}
      </button>
      {filtersOpen ? <div className="absolute right-0 top-10 z-20 grid w-64 gap-2 rounded-xl border border-border bg-surface p-3 shadow-[0_18px_48px_rgba(17,24,39,0.16)]">
        <select aria-label="Filter applications by company" className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary" onChange={(event) => { setCompany(event.target.value); setActiveIndex(0); }} value={company}><option value="">All companies</option>{companyOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Filter applications by platform" className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary" onChange={(event) => { setPlatform(event.target.value); setActiveIndex(0); }} value={platform}><option value="">All platforms</option>{platformOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Filter applications by date" className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary" onChange={(event) => { setDateFilter(event.target.value); setActiveIndex(0); }} value={dateFilter}>{dateFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filter applications by stage" className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary" onChange={(event) => { setStage(event.target.value); setActiveIndex(0); }} value={stage}>{statusFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {activeFilterCount ? <button className="pt-1 text-left text-xs font-semibold text-primary" onClick={clearFilters} type="button">Clear filters</button> : null}
      </div> : null}
    </div>
    <div aria-label="Application results" className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface-subtle p-1" role="listbox">
      {filteredApplications.map((application, index) => <button aria-selected={index === activeIndex} className={`grid w-full grid-cols-[1fr_auto] gap-2 rounded-lg px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-surface"}`} data-application-id={application.id} key={application.id} onClick={() => onSelect(application.id)} role="option" type="button">
        <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-foreground">{application.jobTitle}</strong><small className="mt-1 flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-1 truncate" title="Company"><svg aria-hidden="true" className="size-3 shrink-0" fill="none" viewBox="0 0 24 24"><path d="M4 21V5l8-2 8 2v16M8 8h1m6 0h1M8 12h1m6 0h1M8 16h1m6 0h1M2 21h20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>{application.companyName ?? "Company"}</span><span aria-hidden="true">·</span><span className="inline-flex min-w-0 items-center gap-1 truncate" title="Profile"><svg aria-hidden="true" className="size-3 shrink-0" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" /></svg>{profileNames.get(application.profileId) ?? "Profile"}</span><span aria-hidden="true">·</span><span className="inline-flex min-w-0 items-center gap-1 truncate" title="Platform"><svg aria-hidden="true" className="size-3 shrink-0" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" /><path d="M4 12h16M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z" stroke="currentColor" strokeWidth="1.6" /></svg>{applicationPlatform(application.rawUrl)}</span></small></span>
        <span className="self-center whitespace-nowrap rounded-full bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">{application.status.replaceAll("_", " ")}</span>
      </button>)}
      {!filteredApplications.length ? <div className="px-3 py-8 text-center text-sm text-muted-foreground"><p>{search || activeFilterCount ? "No matches" : "No applications yet"}</p>{search || activeFilterCount ? <button className="mt-2 text-xs font-semibold text-primary" onClick={clearFilters} type="button">Clear filters</button> : null}</div> : null}
    </div>
  </div>;
}

export function BdDashboardQuickActions({ actorId, applications, closers, profiles, timezone = "America/New_York" }: { actorId: string; applications: LeadSummary[]; closers: UserSummary[]; profiles: ProfileSummary[]; timezone?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [action, setAction] = useState<DashboardAction>();
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [lead, setLead] = useState<LeadDetail>();
  const [eligibleClosers, setEligibleClosers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function chooseAction(nextAction: DashboardAction) {
    setMenuOpen(false);
    setAction(nextAction);
    setSelectedLeadId("");
    setLead(undefined);
    setEligibleClosers([]);
    setError(undefined);
  }

  async function selectApplication(leadId: string) {
    setSelectedLeadId(leadId);
    setLead(undefined);
    setError(undefined);
    if (!leadId) return;
    setLoading(true);
    try {
      const detail = await getLead(leadId);
      setLead(detail);
      if (action === "interview") {
        const eligibility = await listCloserEligibility(detail.profileId);
        const eligibleIds = new Set(eligibility.filter((assignment) => !assignment.endedAt).map((assignment) => assignment.userId));
        setEligibleClosers(closers.filter((closer) => eligibleIds.has(closer.id)));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The application could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const selectedApplication = applications.find((application) => application.id === selectedLeadId);
  const actionForm = lead && action === "interview" ? <InterviewForm closers={eligibleClosers} embedded leadId={lead.id} onSuccess={() => setAction(undefined)} timezone={timezone} /> : lead && action === "comment" ? <CollaborationForm embedded kind="comments" leadId={lead.id} onSuccess={() => setAction(undefined)} /> : lead && action ? <CollaborationForm contacts={lead.contacts.map((entry) => entry.contact)} embedded initialDirection={action === "response" ? "INBOUND" : undefined} kind="communications" leadId={lead.id} onSuccess={() => setAction(undefined)} timezone={timezone} /> : null;

  return <div className="relative"><button aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Add application" className="editorial-add-button" onClick={() => setMenuOpen((value) => !value)} type="button">+ Add application <span aria-hidden="true">›</span></button>{menuOpen ? <div aria-label="BD quick actions" className="absolute left-0 top-14 z-30 grid min-w-64 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_48px_rgba(17,24,39,0.16)]" role="menu"><button className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-subtle" onClick={() => { setMenuOpen(false); setIntakeOpen(true); }} role="menuitem" type="button">Add application</button>{(Object.keys(actionLabels) as DashboardAction[]).map((key) => <button className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-subtle" key={key} onClick={() => void chooseAction(key)} role="menuitem" type="button">{actionLabels[key]}</button>)}</div> : null}<Dialog description="Record the job and recruiter details; the applied date is captured automatically." onOpenChange={setIntakeOpen} open={intakeOpen} title="Add application"><div aria-label="Add application modal"><LeadCaptureForm actorId={actorId} embedded onSuccess={() => setIntakeOpen(false)} profiles={profiles} /></div></Dialog><Dialog description="Choose an application to continue." onOpenChange={(open) => { if (!open) setAction(undefined); }} open={Boolean(action)} title={action ? actionLabels[action] : "Application action"}><div className="grid gap-4">{!selectedLeadId ? <ApplicationPicker applications={applications} onSearch={async (query) => (await listLeads({ limit: 100, search: query })).items} onSelect={(leadId) => void selectApplication(leadId)} profiles={profiles} /> : <><div className="flex items-start justify-between gap-3 rounded-xl bg-surface-subtle px-3 py-2.5"><span className="min-w-0"><strong className="block truncate text-sm text-foreground">{selectedApplication?.jobTitle ?? "Selected application"}</strong><small className="block truncate text-xs text-muted-foreground">{selectedApplication?.companyName ?? "Company not recorded"}</small></span><button className="shrink-0 text-xs font-semibold text-primary" onClick={() => { setSelectedLeadId(""); setLead(undefined); setError(undefined); }} type="button">Change</button></div>{loading ? <p className="text-sm text-muted-foreground" role="status">Loading application…</p> : null}{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}{actionForm}</>}</div></Dialog></div>;
}
