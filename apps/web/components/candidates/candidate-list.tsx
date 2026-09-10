"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { CandidateStatus, CandidateSummary, CreateCandidate, SessionUser, UpdateCandidate } from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import { ApiClientError, createCandidate, listCandidates } from "../../lib/api-client";
import { CandidateForm } from "./candidate-form";
import { CsvExportButton } from "../data/csv-export-button";
import { BulkImportForm } from "../data/bulk-import-form";
import { Dialog } from "../ui/dialog";

function message(reason: unknown, fallback: string) {
  return reason instanceof ApiClientError ? reason.message : fallback;
}

export function CandidateList({ actor }: { actor: SessionUser }) {
  const [candidates, setCandidates] = useState<CandidateSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CandidateStatus | "">("");
  const [appliedFilters, setAppliedFilters] = useState<{ search: string; status: CandidateStatus | "" }>({ search: "", status: "" });
  const canManage = actor.role === "ADMIN" && actor.isActive;

  const load = useCallback(async (query: string, candidateStatus: CandidateStatus | "" = "") => {
    if (!canManage) return;
    setLoading(true);
    setError(undefined);
    try {
      const page = await listCandidates({
        ...(query ? { search: query } : {}),
        ...(candidateStatus ? { status: candidateStatus } : {}),
        limit: 50,
      });
      setCandidates(page.items);
    } catch (reason) {
      setError(message(reason, "Orbit could not load candidates. Try again."));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load("");
    if (new URLSearchParams(window.location.search).get("new") === "candidate") setCreateOpen(true);
  }, [load]);

  const counts = useMemo(() => ({
    active: candidates?.filter((candidate) => candidate.status === "ACTIVE").length ?? 0,
    archived: candidates?.filter((candidate) => candidate.status === "ARCHIVED").length ?? 0,
  }), [candidates]);
  const filtersApplied = Boolean(appliedFilters.search || appliedFilters.status);
  const canClearFilters = Boolean(search.trim() || status || filtersApplied);

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    setAppliedFilters({ search: query, status });
    await load(query, status);
  }

  async function clearFilters() {
    setSearch("");
    setStatus("");
    setAppliedFilters({ search: "", status: "" });
    await load("", "");
  }

  async function handleCreate(input: CreateCandidate | UpdateCandidate): Promise<boolean> {
    setCreating(true);
    setNotice(undefined);
    try {
      const created = await createCandidate(input as CreateCandidate);
      setCandidates((current) => [created, ...(current ?? [])]);
      setNotice("Candidate created");
      setCreateOpen(false);
      return true;
    } catch (reason) {
      setError(message(reason, "Orbit could not create this candidate. Try again."));
      return false;
    } finally {
      setCreating(false);
    }
  }

  if (!canManage) {
    return <UnauthorizedState description="Only active administrators can manage candidate records." />;
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Talent records</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Candidates</h1>
        </div>
        <div className="flex flex-wrap gap-2"><Button aria-label="Add candidate" onClick={() => setCreateOpen(true)}>Add candidate</Button><Button aria-label="Import candidates" onClick={() => setImportOpen(true)} variant="secondary">Import CSV</Button><CsvExportButton columns={[{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "email", label: "Email" }, { key: "status", label: "Status" }, { key: "timezone", label: "Timezone" }]} filename="orbit-candidates.csv" rows={candidates ?? []} /><Button aria-label="Refresh candidates" disabled={loading} loading={loading} onClick={() => void load(appliedFilters.search, appliedFilters.status)} variant="secondary">{loading ? "Refreshing…" : "Refresh"}</Button></div>
      </div>

      <div aria-label="Candidate summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/70 py-3 text-sm">
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-semibold text-foreground" title="Candidates in this view">{candidates?.length ?? "—"}</span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Active candidates"><span aria-hidden="true" className="size-1.5 rounded-full bg-success" /><span className="font-semibold text-success">{candidates ? counts.active : "—"}</span><span>active</span></span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Archived candidates"><span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" /><span className="font-semibold text-foreground">{candidates ? counts.archived : "—"}</span><span>archived</span></span>
      </div>

      <Dialog description="Create the person record first; job-search profiles stay separate." onOpenChange={setCreateOpen} open={createOpen} title="Add candidate">
        <CandidateForm onSubmit={handleCreate} pending={creating} surface={false} />
      </Dialog>
      <Dialog description="Upload a validated CSV without leaving the candidate directory." onOpenChange={setImportOpen} open={importOpen} title="Import candidates">
        <BulkImportForm kind="candidate" onComplete={() => { setImportOpen(false); void load(appliedFilters.search, appliedFilters.status); }} surface={false} />
      </Dialog>

      {notice ? <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p> : null}

      <Card className="p-4 sm:p-5">
        <form aria-label="Filter candidates" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-end" onSubmit={handleFilter}>
          <Field htmlFor="candidate-search" label="Search candidates">
            <Input id="candidate-search" onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" value={search} />
          </Field>
          <Field htmlFor="candidate-status" label="Status">
            <select
              className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15"
              id="candidate-status"
              onChange={(event) => setStatus(event.target.value as CandidateStatus | "")}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <Button className="flex-1 md:flex-none" disabled={loading} type="submit" variant="secondary">Apply</Button>
            {canClearFilters ? <Button onClick={() => void clearFilters()} variant="ghost">Clear</Button> : null}
          </div>
        </form>
      </Card>

      {loading && candidates === null ? <LoadingState label="Loading candidates" /> : null}
      {error ? <ErrorState actionLabel="Retry" description={error} onAction={() => void load(appliedFilters.search, appliedFilters.status)} title="Candidates unavailable" /> : null}
      {!loading && !error && candidates?.length === 0 && filtersApplied ? <EmptyState description="Try another name, email, or status." title="No candidates match these filters" /> : null}
      {!loading && !error && candidates?.length === 0 && !filtersApplied ? <EmptyState description="Use Add candidate to create the first person record." title="No candidates yet" /> : null}

      {!error && candidates && candidates.length > 0 ? (
        <Card aria-label="Candidate records" className="overflow-hidden p-0">
          <div className="hidden border-b border-border/80 bg-surface-subtle px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(240px,1.4fr)_minmax(160px,0.8fr)_minmax(180px,0.9fr)_auto_4rem] md:gap-5">
            <span>Candidate</span><span>Location</span><span>Timezone</span><span>Status</span><span />
          </div>
          <div className="data-scroll-region max-h-[calc(100vh-23rem)] min-h-[22rem] divide-y divide-border/70 overflow-y-auto">
            {candidates.map((candidate) => (
              <article className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-subtle md:grid-cols-[minmax(240px,1.4fr)_minmax(160px,0.8fr)_minmax(180px,0.9fr)_auto_4rem] md:items-center md:gap-5" key={candidate.id}>
                <div className="min-w-0"><Link className="font-semibold text-foreground outline-none group-hover:text-primary focus-visible:text-primary" href={`/candidates/${candidate.id}`}>{candidate.firstName} {candidate.lastName}</Link><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground" title={candidate.email ?? "No email recorded"}><span aria-hidden="true">@</span>{candidate.email ?? "No email recorded"}</p></div>
                <div title="Location"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Location</span><p className="flex items-center gap-1.5 text-sm text-foreground"><span aria-hidden="true" className="text-primary">⌖</span>{candidate.location ?? "Not recorded"}</p></div>
                <div title="Timezone"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Timezone</span><p className="flex items-center gap-1.5 text-sm text-foreground"><span aria-hidden="true" className="text-primary">◷</span>{candidate.timezone}</p></div>
                <div title={candidate.status === "ACTIVE" ? "Active" : "Archived"}><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Status</span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${candidate.status === "ACTIVE" ? "bg-success-soft text-success" : "bg-surface-subtle text-muted-foreground"}`}><span aria-hidden="true">{candidate.status === "ACTIVE" ? "✓" : "—"}</span>{candidate.status === "ACTIVE" ? "Active" : "Archived"}</span></div>
                <Link aria-label={`Open ${candidate.firstName} ${candidate.lastName}`} className="font-semibold text-primary hover:underline md:text-right" href={`/candidates/${candidate.id}`}>Open<span aria-hidden="true"> →</span></Link>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
