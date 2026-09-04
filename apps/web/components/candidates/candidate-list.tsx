"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { CandidateSummary, CreateCandidate, SessionUser, UpdateCandidate } from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import { ApiClientError, createCandidate, listCandidates } from "../../lib/api-client";
import { CandidateForm } from "./candidate-form";
import { CsvExportButton } from "../data/csv-export-button";
import { BulkImportForm } from "../data/bulk-import-form";

function message(reason: unknown, fallback: string) {
  return reason instanceof ApiClientError ? reason.message : fallback;
}

export function CandidateList({ actor }: { actor: SessionUser }) {
  const [candidates, setCandidates] = useState<CandidateSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const canManage = actor.role === "ADMIN" && actor.isActive;

  const load = useCallback(async (query: string) => {
    if (!canManage) return;
    setLoading(true);
    setError(undefined);
    try {
      const page = await listCandidates({ ...(query ? { search: query } : {}), limit: 50 });
      setCandidates(page.items);
    } catch (reason) {
      setError(message(reason, "Orbit could not load candidates. Try again."));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load("");
  }, [load]);

  const activeCount = useMemo(
    () => candidates?.filter((candidate) => candidate.status === "ACTIVE").length ?? 0,
    [candidates],
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(search.trim());
  }

  async function handleCreate(input: CreateCandidate | UpdateCandidate): Promise<boolean> {
    setCreating(true);
    setNotice(undefined);
    try {
      const created = await createCandidate(input as CreateCandidate);
      setCandidates((current) => [created, ...(current ?? [])]);
      setNotice("Candidate created");
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
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Create candidate records and organize each job search into a separate profile.</p>
        </div>
        <div className="flex gap-2"><CsvExportButton columns={[{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "email", label: "Email" }, { key: "status", label: "Status" }, { key: "timezone", label: "Timezone" }]} filename="orbit-candidates.csv" rows={candidates ?? []} /><Button aria-label="Refresh candidates" disabled={loading} onClick={() => void load(search.trim())} variant="secondary">{loading ? "Refreshing…" : "Refresh"}</Button></div>
      </div>

      <div aria-label="Candidate summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/70 py-3 text-sm">
        <span className="font-semibold text-foreground">{candidates?.length ?? "—"} shown</span>
        <span className="text-muted-foreground"><span className="font-semibold text-success">{candidates ? activeCount : "—"}</span> active</span>
        <span className="text-muted-foreground">Admin-managed records</span>
      </div>

      <CandidateForm onSubmit={handleCreate} pending={creating} />
      <BulkImportForm kind="candidate" onComplete={() => void load(search.trim())} />

      {notice ? <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p> : null}

      <Card className="p-4 sm:p-5">
        <form aria-label="Search candidates" className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSearch}>
          <Field className="flex-1" htmlFor="candidate-search" label="Search candidates">
            <Input id="candidate-search" onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" value={search} />
          </Field>
          <Button disabled={loading} type="submit" variant="secondary">Search</Button>
        </form>
      </Card>

      {loading && candidates === null ? <LoadingState label="Loading candidates" /> : null}
      {error ? <ErrorState actionLabel="Retry" description={error} onAction={() => void load(search.trim())} title="Candidates unavailable" /> : null}
      {!loading && !error && candidates?.length === 0 ? <EmptyState description="Create a candidate above or change your search." title="No candidates found" /> : null}

      {!error && candidates && candidates.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table aria-label="Candidate records" className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border/80 bg-surface-subtle text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="px-5 py-3.5">Candidate</th><th className="px-5 py-3.5">Location</th><th className="px-5 py-3.5">Timezone</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5" /></tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {candidates.map((candidate) => (
                  <tr className="group transition-colors hover:bg-surface-subtle" key={candidate.id}>
                    <td className="px-5 py-4"><Link className="font-semibold text-foreground outline-none group-hover:text-primary focus-visible:text-primary" href={`/candidates/${candidate.id}`}>{candidate.firstName} {candidate.lastName}</Link><p className="mt-1 text-xs text-muted-foreground">{candidate.email ?? "No email recorded"}</p></td>
                    <td className="px-5 py-4 text-muted-foreground">{candidate.location ?? "—"}</td>
                    <td className="px-5 py-4 text-muted-foreground">{candidate.timezone}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${candidate.status === "ACTIVE" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground"}`}>{candidate.status === "ACTIVE" ? "Active" : "Archived"}</span></td>
                    <td className="px-5 py-4 text-right"><Link aria-label={`Open ${candidate.firstName} ${candidate.lastName}`} className="font-semibold text-primary hover:underline" href={`/candidates/${candidate.id}`}>Open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
