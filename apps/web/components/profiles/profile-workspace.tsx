"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Assignment, CalendarConnection, CreateProfile, DocumentSummary, ProfileSummary, SessionUser, UpdateProfile, UserSummary } from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import {
  activateProfile,
  ApiClientError,
  archiveProfile,
  archiveDocument,
  assignBd,
  endBdAssignment,
  endCloserEligibility,
  getProfile,
  getDocumentDownloadUrl,
  listBdAssignments,
  listCloserEligibility,
  listDocuments,
  listUsers,
  pauseProfile,
  restoreProfile,
  setCloserEligibility,
  updateProfile,
  uploadDocument,
  uploadDocumentVersion,
  type ProfileDetail,
} from "../../lib/api-client";
import { ProfileForm } from "./profile-form";
import { GoogleCalendarConnection } from "../calendar/google-calendar-connection";

type Notice = { tone: "success" | "danger"; message: string };

const selectClasses = "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none";

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof ApiClientError ? reason.message : fallback;
}

function statusClasses(status: ProfileSummary["status"]): string {
  if (status === "ACTIVE") return "bg-success-soft text-success";
  if (status === "ARCHIVED") return "bg-danger-soft text-danger";
  if (status === "PAUSED") return "bg-warning-soft text-warning-foreground";
  return "bg-info-soft text-info";
}

export function ProfileWorkspace({
  actor,
  profileId,
  calendar,
}: {
  actor: SessionUser;
  profileId: string;
  calendar: CalendarConnection;
}) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [bdAssignments, setBdAssignments] = useState<Assignment[] | null>(null);
  const [closerEligibility, setCloserEligibilityState] = useState<Assignment[] | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [unauthorized, setUnauthorized] = useState(false);
  const [teamError, setTeamError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [archiveReason, setArchiveReason] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [selectedBd, setSelectedBd] = useState("");
  const [selectedCloser, setSelectedCloser] = useState("");
  const [selectedFile, setSelectedFile] = useState<File>();
  const [documentType, setDocumentType] = useState<"CV" | "COVER_LETTER" | "SUPPORTING" | "OTHER">("CV");
  const isAdmin = actor.role === "ADMIN" && actor.isActive;
  const canEditProfile = ["ADMIN", "BD"].includes(actor.role) && actor.isActive;

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setUnauthorized(false);
    setTeamError(undefined);
    try {
      const loaded = await getProfile(profileId);
      setProfile(loaded);
      const teamResults = await Promise.allSettled([
        listBdAssignments(profileId),
        listCloserEligibility(profileId),
        isAdmin ? listUsers() : Promise.resolve([]),
        listDocuments(profileId),
      ]);
      if (teamResults[0].status === "fulfilled") setBdAssignments(teamResults[0].value);
      if (teamResults[1].status === "fulfilled") setCloserEligibilityState(teamResults[1].value);
      if (teamResults[2].status === "fulfilled") setUsers(teamResults[2].value);
      if (teamResults[3].status === "fulfilled") setDocuments(teamResults[3].value);
      if (teamResults.some((result) => result.status === "rejected")) {
        setTeamError("Some team details could not be loaded. Refresh before changing assignments.");
      }
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 403) setUnauthorized(true);
      else setError(errorMessage(reason, "Orbit could not load this profile. Try again."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeBds = useMemo(() => bdAssignments?.filter((assignment) => !assignment.endedAt) ?? [], [bdAssignments]);
  const activeClosers = useMemo(() => closerEligibility?.filter((assignment) => !assignment.endedAt) ?? [], [closerEligibility]);
  const availableBds = users.filter((user) => user.role === "BD" && user.isActive && !activeBds.some((assignment) => assignment.userId === user.id));
  const availableClosers = users.filter((user) => user.role === "CLOSER" && user.isActive && !activeClosers.some((assignment) => assignment.userId === user.id));

  function userName(userId: string): string {
    return users.find((user) => user.id === userId)?.displayName ?? (actor.id === userId ? actor.displayName : "Assigned teammate");
  }

  function mergeSummary(summary: ProfileSummary) {
    setProfile((current) => current ? { ...summary, candidate: current.candidate } : null);
  }

  async function saveProfile(input: CreateProfile | UpdateProfile): Promise<boolean> {
    if (!profile) return false;
    setPending("save");
    setNotice(undefined);
    try {
      mergeSummary(await updateProfile(profile.id, input as UpdateProfile, profile.version));
      setNotice({ tone: "success", message: "Profile updated" });
      return true;
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update this profile.") });
      return false;
    } finally {
      setPending(undefined);
    }
  }

  async function changeStatus(action: "activate" | "pause" | "archive" | "restore") {
    if (!profile) return;
    if (action === "archive" && !archiveReason.trim()) {
      setNotice({ tone: "danger", message: "Enter an archive reason first." });
      return;
    }
    setPending(action);
    setNotice(undefined);
    try {
      const updated = action === "activate"
        ? await activateProfile(profile.id, profile.version)
        : action === "pause"
          ? await pauseProfile(profile.id, profile.version)
          : action === "archive"
            ? await archiveProfile(profile.id, archiveReason, profile.version)
            : await restoreProfile(profile.id, profile.version);
      mergeSummary(updated);
      setArchiveReason("");
      setNotice({ tone: "success", message: `Profile ${action === "restore" ? "restored to draft" : `${action}d`}` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not change this profile status.") });
    } finally {
      setPending(undefined);
    }
  }

  async function addTeamMember(kind: "bd" | "closer") {
    const userId = kind === "bd" ? selectedBd : selectedCloser;
    if (!userId) return;
    setPending(`add-${kind}`);
    setNotice(undefined);
    try {
      const added = kind === "bd" ? await assignBd(profileId, userId) : await setCloserEligibility(profileId, userId);
      if (kind === "bd") {
        setBdAssignments((current) => [added, ...(current ?? [])]);
        setSelectedBd("");
      } else {
        setCloserEligibilityState((current) => [added, ...(current ?? [])]);
        setSelectedCloser("");
      }
      setNotice({ tone: "success", message: kind === "bd" ? "BD assigned" : "Closer eligibility added" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update the profile team.") });
    } finally {
      setPending(undefined);
    }
  }

  async function endTeamMember(kind: "bd" | "closer", assignment: Assignment) {
    if (!assignmentReason.trim()) {
      setNotice({ tone: "danger", message: "Enter an assignment change reason first." });
      return;
    }
    setPending(`end-${assignment.id}`);
    setNotice(undefined);
    try {
      if (kind === "bd") await endBdAssignment(profileId, assignment.id, assignmentReason);
      else await endCloserEligibility(profileId, assignment.id, assignmentReason);
      const endedAt = new Date().toISOString();
      const update = (item: Assignment) => item.id === assignment.id ? { ...item, endedAt, endedReason: assignmentReason.trim() } : item;
      if (kind === "bd") setBdAssignments((current) => current?.map(update) ?? null);
      else setCloserEligibilityState((current) => current?.map(update) ?? null);
      setAssignmentReason("");
      setNotice({ tone: "success", message: kind === "bd" ? "BD assignment ended" : "Closer eligibility ended" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not end this assignment.") });
    } finally {
      setPending(undefined);
    }
  }

  async function uploadSelectedDocument() {
    if (!selectedFile) { setNotice({ tone: "danger", message: "Choose a document first." }); return; }
    setPending("document");
    setNotice(undefined);
    try {
      const created = await uploadDocument(profileId, { file: selectedFile, type: documentType, title: selectedFile.name.replace(/\.[^.]+$/, "") });
      setDocuments((current) => [created, ...current]);
      setSelectedFile(undefined);
      setNotice({ tone: "success", message: "Document uploaded" });
      const input = document.getElementById("profile-document") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (reason) { setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not upload this document.") }); }
    finally { setPending(undefined); }
  }

  async function downloadDocument(item: DocumentSummary) {
    const version = item.versions?.find((candidate) => candidate.id === item.currentVersionId) ?? item.versions?.[0];
    if (!version) { setNotice({ tone: "danger", message: "This document has no downloadable version." }); return; }
    setPending(`download-${item.id}`);
    try { window.location.assign(await getDocumentDownloadUrl(item.id, version.id)); }
    catch (reason) { setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not prepare the download.") }); }
    finally { setPending(undefined); }
  }

  async function archiveDocumentRecord(item: DocumentSummary) {
    if (!window.confirm(`Archive ${item.title}?`)) return;
    setPending(`archive-document-${item.id}`);
    try { await archiveDocument(item.id, "Archived from the profile workspace"); setDocuments((current) => current.map((document) => document.id === item.id ? { ...document, archivedAt: new Date().toISOString() } : document)); setNotice({ tone: "success", message: "Document archived" }); }
    catch (reason) { setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not archive this document.") }); }
    finally { setPending(undefined); }
  }

  async function replaceDocumentVersion(item: DocumentSummary, file: File) {
    setPending(`replace-${item.id}`);
    try { const updated = await uploadDocumentVersion(item.id, profileId, file); setDocuments((current) => current.map((document) => document.id === item.id ? updated : document)); setNotice({ tone: "success", message: "Document version uploaded" }); }
    catch (reason) { setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not upload this document version.") }); }
    finally { setPending(undefined); }
  }

  if (loading && !profile) return <LoadingState label="Loading profile workspace" />;
  if (unauthorized) return <UnauthorizedState description="This profile is outside your current assignment scope." />;
  if (error || !profile) return <ErrorState actionLabel="Retry" description={error ?? "The profile was not found."} onAction={() => void load()} title="Profile unavailable" />;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href={`/candidates/${profile.candidate.id}`}>← {profile.candidate.preferredName ?? `${profile.candidate.firstName} ${profile.candidate.lastName}`}</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{profile.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(profile.status)}`}>{profile.status[0]}{profile.status.slice(1).toLowerCase()}</span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{profile.description ?? "No profile description yet."}</p>
        </div>
        {!canEditProfile ? <p className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm font-semibold text-info">Read-only workspace</p> : null}
      </div>

      {profile.status === "ARCHIVED" ? <Card className="border-warning/30 bg-warning-soft p-4"><p className="font-semibold text-warning-foreground">Archived profile</p><p className="mt-1 text-sm text-muted-foreground">{profile.archiveReason ?? "No archive reason recorded."}</p></Card> : null}
      {notice ? <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.message}</p> : null}

      <nav aria-label="Profile sections" className="overflow-x-auto border-b border-border/70 pb-2">
        <div className="flex min-w-max gap-1">
          {["Overview", "Leads", "Interviews", "Work queue", "Documents", "Team", "Activity", "Analytics"].map((item, index) => <Link aria-current={index === 0 ? "page" : undefined} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${index === 0 ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"}`} href={index === 0 ? `/profiles/${profileId}` : `/profiles/${profileId}/${item === "Work queue" ? "tasks" : item.toLowerCase()}`} key={item}>{item}</Link>)}
        </div>
      </nav>

      <Card className="p-4 sm:p-5">
        <section aria-label="Profile overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Candidate</p><p className="mt-1.5 font-semibold text-foreground">{profile.candidate.firstName} {profile.candidate.lastName}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Target roles</p><p className="mt-1.5 font-semibold text-foreground">{profile.targetRoles.join(", ") || "—"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Locations</p><p className="mt-1.5 font-semibold text-foreground">{profile.preferredLocations.join(", ") || "—"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Compensation</p><p className="mt-1.5 font-semibold text-foreground">{profile.targetCompensation ? `${profile.defaultCurrency} ${profile.targetCompensation}${profile.compensationPeriod ? ` / ${profile.compensationPeriod.toLowerCase()}` : ""}` : "—"}</p></div>
        </section>
      </Card>

        <GoogleCalendarConnection canManage={isAdmin} profileId={profileId} initialConnection={calendar} />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-bold text-foreground">Documents</h2><p className="mt-1 text-sm text-muted-foreground">Private profile files stored in Orbit object storage.</p></div><span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info">{documents.length}</span></div>
        <div className="mt-4 grid gap-2">{documents.map((item) => <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3 sm:flex-row sm:items-center" key={item.id}><div><p className="text-sm font-semibold text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.type.replaceAll("_", " ")} · {item.versions?.length ?? 0} version(s)</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">{item.archivedAt ? "Archived" : "Current"}</span>{!item.archivedAt ? <Button disabled={Boolean(pending)} onClick={() => void downloadDocument(item)} size="sm" variant="secondary">{pending === `download-${item.id}` ? "Preparing…" : "Download"}</Button> : null}{isAdmin && !item.archivedAt ? <><label className="sr-only" htmlFor={`replace-${item.id}`}>Replace {item.title}</label><Input accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" disabled={Boolean(pending)} id={`replace-${item.id}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceDocumentVersion(item, file); event.target.value = ""; }} type="file" /></> : null}{isAdmin && !item.archivedAt ? <Button disabled={Boolean(pending)} onClick={() => void archiveDocumentRecord(item)} size="sm" variant="ghost">Archive</Button> : null}</div></div>)}{documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded for this profile yet.</p> : null}</div>
        {isAdmin ? <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-border-strong p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"><Field htmlFor="profile-document" label="Upload document" hint="PDF, DOCX, PNG, or JPG · 25 MB max"><Input accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" id="profile-document" onChange={(event) => setSelectedFile(event.target.files?.[0])} type="file" /></Field><Field htmlFor="document-type" label="Type"><select className={selectClasses} id="document-type" onChange={(event) => setDocumentType(event.target.value as typeof documentType)} value={documentType}><option value="CV">CV</option><option value="COVER_LETTER">Cover letter</option><option value="SUPPORTING">Supporting</option><option value="OTHER">Other</option></select></Field><Button disabled={!selectedFile || Boolean(pending)} onClick={() => void uploadSelectedDocument()}>{pending === "document" ? "Uploading…" : "Upload"}</Button></div> : <p className="mt-4 text-xs text-muted-foreground">Only Admins can upload or replace profile documents.</p>}
      </Card>

      <section aria-label="Profile team" className="grid gap-4 xl:grid-cols-2">
        {teamError ? <p className="xl:col-span-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-foreground" role="alert">{teamError}</p> : null}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">Assigned BDs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Business development users with active profile access.</p>
          <div className="mt-4 grid gap-2">
            {activeBds.length === 0 ? <EmptyState description="An Admin can assign an active BD." title="No assigned BDs" /> : activeBds.map((assignment) => <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3" key={assignment.id}><div><p className="text-sm font-semibold text-foreground">{userName(assignment.userId)}</p><p className="text-xs text-muted-foreground">Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p></div>{isAdmin ? <Button aria-label={`End BD assignment for ${userName(assignment.userId)}`} disabled={Boolean(pending)} onClick={() => void endTeamMember("bd", assignment)} size="sm" variant="ghost">End</Button> : null}</div>)}
          </div>
          {isAdmin ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="assign-bd">BD team member</label><select className={selectClasses} id="assign-bd" onChange={(event) => setSelectedBd(event.target.value)} value={selectedBd}><option value="">Select active BD</option>{availableBds.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select><Button disabled={!selectedBd || Boolean(pending)} onClick={() => void addTeamMember("bd")}>Assign BD</Button></div> : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">Eligible Closers</h2>
          <p className="mt-1 text-sm text-muted-foreground">Closers permitted to support interviews for this profile.</p>
          <div className="mt-4 grid gap-2">
            {activeClosers.length === 0 ? <EmptyState description="An Admin can add an active Closer." title="No eligible Closers" /> : activeClosers.map((assignment) => <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3" key={assignment.id}><div><p className="text-sm font-semibold text-foreground">{userName(assignment.userId)}</p><p className="text-xs text-muted-foreground">Eligible since {new Date(assignment.assignedAt).toLocaleDateString()}</p></div>{isAdmin ? <Button aria-label={`End Closer eligibility for ${userName(assignment.userId)}`} disabled={Boolean(pending)} onClick={() => void endTeamMember("closer", assignment)} size="sm" variant="ghost">End</Button> : null}</div>)}
          </div>
          {isAdmin ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="assign-closer">Eligible Closer</label><select className={selectClasses} id="assign-closer" onChange={(event) => setSelectedCloser(event.target.value)} value={selectedCloser}><option value="">Select active Closer</option>{availableClosers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select><Button disabled={!selectedCloser || Boolean(pending)} onClick={() => void addTeamMember("closer")}>Add eligible Closer</Button></div> : null}
        </Card>
        {isAdmin ? <Field className="xl:col-span-2" htmlFor="assignment-reason" hint="Required before ending access" label="Assignment change reason"><Input id="assignment-reason" onChange={(event) => setAssignmentReason(event.target.value)} placeholder="Coverage changed" value={assignmentReason} /></Field> : null}
      </section>

      {canEditProfile ? (
        <>
          {profile.status !== "ARCHIVED" ? <ProfileForm initial={profile} onSubmit={saveProfile} pending={pending === "save"} /> : null}
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">Profile lifecycle</h2>
            <p className="mt-1 text-sm text-muted-foreground">Status changes use the latest loaded version and are enforced again by the API.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              {profile.status !== "ARCHIVED" ? <Field className="flex-1" htmlFor="archive-reason" label="Archive reason" hint="Required to archive"><Input id="archive-reason" onChange={(event) => setArchiveReason(event.target.value)} placeholder="Candidate paused the search" value={archiveReason} /></Field> : null}
              <div className="flex flex-wrap gap-2">
                {profile.status === "DRAFT" || profile.status === "PAUSED" ? <Button disabled={Boolean(pending)} onClick={() => void changeStatus("activate")}>Activate profile</Button> : null}
                {profile.status === "ACTIVE" ? <Button disabled={Boolean(pending)} onClick={() => void changeStatus("pause")} variant="secondary">Pause profile</Button> : null}
                {profile.status !== "ARCHIVED" ? <Button disabled={Boolean(pending)} onClick={() => void changeStatus("archive")} variant="danger">Archive profile</Button> : <Button disabled={Boolean(pending)} onClick={() => void changeStatus("restore")}>Restore profile</Button>}
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
