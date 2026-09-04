"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { CandidateSummary, CreateProfile, SessionUser, UpdateCandidate } from "@orbit/contracts";
import { Button, Card, ErrorState, LoadingState, UnauthorizedState } from "@orbit/ui";

import { ApiClientError, createProfile, getCandidate, updateCandidate, type CandidateDetail } from "../../lib/api-client";
import { CandidateForm } from "./candidate-form";
import { ProfileForm } from "../profiles/profile-form";

export function CandidateDetailView({ actor, candidateId }: { actor: SessionUser; candidateId: string }) {
  const [candidate, setCandidate] = useState<CandidateDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setCandidate(await getCandidate(candidateId));
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 403) setError("You do not have access to this candidate.");
      else setError(reason instanceof ApiClientError ? reason.message : "Orbit could not load this candidate.");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => { void load(); }, [load]);

  async function saveCandidate(input: UpdateCandidate): Promise<boolean> {
    if (!candidate) return false;
    setPending(true);
    try {
      const updated = await updateCandidate(candidate.id, input, candidate.version);
      setCandidate((current) => current ? { ...current, ...updated } : current);
      setNotice("Candidate updated");
      return true;
    } catch (reason) {
      setNotice(reason instanceof ApiClientError ? reason.message : "Orbit could not update this candidate.");
      return false;
    } finally { setPending(false); }
  }

  async function addProfile(input: CreateProfile): Promise<boolean> {
    if (!candidate) return false;
    setPending(true);
    try {
      const created = await createProfile(input);
      setCandidate((current) => current ? { ...current, profiles: [created, ...current.profiles] } : current);
      setNotice("Profile created");
      return true;
    } catch (reason) {
      setNotice(reason instanceof ApiClientError ? reason.message : "Orbit could not create this profile.");
      return false;
    } finally { setPending(false); }
  }

  if (loading) return <LoadingState label="Loading candidate" />;
  if (error) return <ErrorState actionLabel="Retry" description={error} onAction={() => void load()} title="Candidate unavailable" />;
  if (!candidate) return <UnauthorizedState description="This candidate is outside your current access scope." />;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href="/candidates">← Candidates</Link>
      <div><h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{candidate.preferredName ?? `${candidate.firstName} ${candidate.lastName}`}</h1><p className="mt-1.5 text-sm text-muted-foreground">Candidate record and job-search profiles</p></div>
      {notice ? <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p> : null}
      <CandidateForm initial={candidate} onSubmit={(input) => saveCandidate(input as UpdateCandidate)} pending={pending} />
      <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Job searches</p><h2 className="mt-2 text-lg font-bold text-foreground">Profiles</h2></div><span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{candidate.profiles.length}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{candidate.profiles.map((profile) => <Link className="rounded-xl border border-border p-4 hover:border-primary/40" href={`/profiles/${profile.id}`} key={profile.id}><p className="font-semibold text-foreground">{profile.name}</p><p className="mt-1 text-sm text-muted-foreground">{profile.status} · {profile.targetRoles.join(", ") || "Roles not set"}</p></Link>)}{candidate.profiles.length === 0 ? <p className="text-sm text-muted-foreground">No profiles yet. Create the first job-search profile below.</p> : null}</div></Card>
      <ProfileForm candidateId={candidate.id} onSubmit={(input) => addProfile(input as CreateProfile)} pending={pending} />
      <Button onClick={() => void load()} variant="secondary">Refresh candidate</Button>
    </div>
  );
}
