"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { CandidateSummary, CreateProfile, SessionUser, UpdateCandidate } from "@orbit/contracts";
import { Button, Card, ErrorState, LoadingState, UnauthorizedState } from "@orbit/ui";

import { ApiClientError, createProfile, getCandidate, updateCandidate, type CandidateDetail } from "../../lib/api-client";
import { CandidateForm } from "./candidate-form";
import { ProfileForm } from "../profiles/profile-form";
import { Dialog } from "../ui/dialog";

type Notice = { tone: "success" | "danger"; message: string };

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

export function CandidateDetailView({ actor, candidateId }: { actor: SessionUser; candidateId: string }) {
  const [candidate, setCandidate] = useState<CandidateDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const canManage = actor.role === "ADMIN" && actor.isActive;

  const load = useCallback(async () => {
    if (!canManage) return;
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
  }, [canManage, candidateId]);

  useEffect(() => { void load(); }, [load]);

  async function saveCandidate(input: UpdateCandidate): Promise<boolean> {
    if (!candidate) return false;
    setPending(true);
    try {
      const updated = await updateCandidate(candidate.id, input, candidate.version);
      setCandidate((current) => current ? { ...current, ...updated } : current);
      setNotice({ tone: "success", message: "Candidate updated" });
      setEditOpen(false);
      return true;
    } catch (reason) {
      setNotice({ tone: "danger", message: reason instanceof ApiClientError ? reason.message : "Orbit could not update this candidate." });
      return false;
    } finally { setPending(false); }
  }

  async function addProfile(input: CreateProfile): Promise<boolean> {
    if (!candidate) return false;
    setPending(true);
    try {
      const created = await createProfile(input);
      setCandidate((current) => current ? { ...current, profiles: [created, ...current.profiles] } : current);
      setNotice({ tone: "success", message: "Profile created" });
      setProfileOpen(false);
      return true;
    } catch (reason) {
      setNotice({ tone: "danger", message: reason instanceof ApiClientError ? reason.message : "Orbit could not create this profile." });
      return false;
    } finally { setPending(false); }
  }

  if (!canManage) return <UnauthorizedState description="Only active administrators can manage candidate records." />;
  if (loading) return <LoadingState label="Loading candidate" />;
  if (error) return <ErrorState actionLabel="Retry" description={error} onAction={() => void load()} title="Candidate unavailable" />;
  if (!candidate) return <UnauthorizedState description="This candidate is outside your current access scope." />;

  const fullName = `${candidate.firstName} ${candidate.lastName}`;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href="/candidates">← Candidates</Link>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{fullName}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${candidate.status === "ACTIVE" ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground"}`}>{candidate.status === "ACTIVE" ? "Active" : "Archived"}</span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">Candidate record and job-search profiles{candidate.preferredName && candidate.preferredName !== candidate.firstName ? ` · Prefers ${candidate.preferredName}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setNotice(undefined); setEditOpen(true); }} variant="secondary">Edit candidate</Button>
          <Button onClick={() => { setNotice(undefined); setProfileOpen(true); }}>Add profile</Button>
        </div>
      </header>

      {notice ? <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.message}</p> : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border/70 px-5 py-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Contact record</p>
          <h2 className="mt-1.5 text-lg font-bold tracking-[-0.02em] text-foreground">Candidate details</h2>
        </div>
        <dl className="grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Full name", fullName],
            ["Preferred name", valueOrDash(candidate.preferredName)],
            ["Email", valueOrDash(candidate.email)],
            ["Phone", valueOrDash(candidate.phone)],
            ["Location", valueOrDash(candidate.location)],
            ["Timezone", valueOrDash(candidate.timezone)],
          ].map(([label, value]) => <div className="bg-surface px-5 py-4 sm:px-6" key={label}><dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1.5 break-words text-sm font-semibold text-foreground">{value}</dd></div>)}
        </dl>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Job searches</p><h2 className="mt-1.5 text-lg font-bold text-foreground">Profiles</h2></div>
          <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{candidate.profiles.length}</span>
        </div>
        {candidate.profiles.length > 0 ? <div className="divide-y divide-border/70">{candidate.profiles.map((profile) => <Link className="group flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center sm:px-6" href={`/profiles/${profile.id}`} key={profile.id}><div className="min-w-0"><p className="font-semibold text-foreground group-hover:text-primary">{profile.name}</p><p className="mt-1 truncate text-sm text-muted-foreground">{profile.targetRoles.join(", ") || "Roles not set"} · {profile.preferredLocations.join(", ") || "Locations not set"}</p></div><div className="flex shrink-0 items-center gap-3"><span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{profile.status.replaceAll("_", " ")}</span><span className="font-semibold text-primary">Open →</span></div></Link>)}</div> : <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">No profiles yet. Add a job-search profile to begin managing applications.</p>}
      </Card>

      <Dialog description="Update this candidate’s contact and location details." onOpenChange={setEditOpen} open={editOpen} title="Edit candidate">
        <CandidateForm initial={candidate} onSubmit={(input) => saveCandidate(input as UpdateCandidate)} pending={pending} surface={false} />
      </Dialog>
      <Dialog description="Create a separate job-search profile for roles, locations, and compensation preferences." onOpenChange={setProfileOpen} open={profileOpen} title="Add profile">
        <ProfileForm candidateId={candidate.id} embedded onSubmit={(input) => addProfile(input as CreateProfile)} pending={pending} />
      </Dialog>
    </div>
  );
}
