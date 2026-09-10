"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  ActivityEventSummary,
  Assignment,
  CalendarConnection,
  CreateProfile,
  DocumentSummary,
  InterviewSummary,
  LeadSummary,
  ProfileSummary,
  SessionUser,
  TaskSummary,
  UpdateProfile,
  UserSummary,
} from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, UnauthorizedState } from "@orbit/ui";

import {
  activateProfile,
  ApiClientError,
  archiveDocument,
  archiveProfile,
  assignBd,
  endBdAssignment,
  endCloserEligibility,
  getDashboard,
  getDocumentDownloadUrl,
  getProfile,
  listActivity,
  listBdAssignments,
  listCloserEligibility,
  listDocuments,
  listLeadInterviewRounds,
  listLeads,
  listTasks,
  listUsers,
  pauseProfile,
  restoreProfile,
  setCloserEligibility,
  updateProfile,
  uploadDocument,
  uploadDocumentVersion,
  type DashboardData,
  type ProfileDetail,
} from "../../lib/api-client";
import { GoogleCalendarConnection } from "../calendar/google-calendar-connection";
import { TaskActions } from "../tasks/task-actions";
import { Dialog } from "../ui/dialog";
import { ProfileForm } from "./profile-form";

export type ProfileWorkspaceTab = "overview" | "leads" | "interviews" | "tasks" | "documents" | "team" | "activity" | "analytics";

type Notice = { tone: "success" | "danger"; message: string };
type InterviewRecord = InterviewSummary & { lead?: LeadSummary };

const tabs: Array<{ id: ProfileWorkspaceTab; label: string; adminOnly?: boolean }> = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "interviews", label: "Interviews" },
  { id: "tasks", label: "Tasks" },
  { id: "documents", label: "Documents" },
  { id: "team", label: "Team", adminOnly: true },
  { id: "activity", label: "Activity" },
  { id: "analytics", label: "Analytics" },
];

const selectClasses = "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none";

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof ApiClientError ? reason.message : fallback;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function statusClasses(status: string): string {
  if (["ACTIVE", "COMPLETED", "PASSED", "PLACED", "STARTED"].includes(status)) return "bg-success-soft text-success";
  if (["ARCHIVED", "CANCELLED", "CANCELED", "FAILED", "CLOSED"].includes(status)) return "bg-danger-soft text-danger";
  if (["PAUSED", "RESCHEDULE_REQUIRED", "WAITING_FEEDBACK", "HIGH"].includes(status)) return "bg-warning-soft text-warning-foreground";
  return "bg-info-soft text-info";
}

function sourceHost(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ""); }
  catch { return "Job link"; }
}

function SectionHeading({ action, eyebrow, title, description }: { action?: ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ProfileWorkspace({
  actor,
  profileId,
  calendar,
  activeTab = "overview",
}: {
  actor: SessionUser;
  profileId: string;
  calendar: CalendarConnection;
  activeTab?: ProfileWorkspaceTab | string;
}) {
  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab as ProfileWorkspaceTab : "overview";
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [bdAssignments, setBdAssignments] = useState<Assignment[]>([]);
  const [closerEligibility, setCloserEligibilityState] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [activity, setActivity] = useState<ActivityEventSummary[]>([]);
  const [analytics, setAnalytics] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [unauthorized, setUnauthorized] = useState(false);
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [archiveReason, setArchiveReason] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [selectedBd, setSelectedBd] = useState("");
  const [selectedCloser, setSelectedCloser] = useState("");
  const [selectedFile, setSelectedFile] = useState<File>();
  const [documentType, setDocumentType] = useState<"CV" | "COVER_LETTER" | "SUPPORTING" | "OTHER">("CV");
  const [editOpen, setEditOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const isAdmin = actor.role === "ADMIN" && actor.isActive;
  const canEditProfile = ["ADMIN", "BD"].includes(actor.role) && actor.isActive;
  const timeZone = actor.timezone || "UTC";

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setUnauthorized(false);
    try {
      const loadedProfile = await getProfile(profileId);
      setProfile(loadedProfile);

      if (currentTab === "leads") {
        setLeads((await listLeads({ profileId, limit: 100 })).items);
      } else if (currentTab === "interviews") {
        const leadRows = (await listLeads({ profileId, limit: 100 })).items;
        const rounds = (await Promise.all(leadRows.map(async (lead) => (await listLeadInterviewRounds(lead.id)).map((round) => ({ ...round, lead }))))).flat();
        setInterviews(rounds.sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()));
      } else if (currentTab === "tasks") {
        setTasks(await listTasks({ profileId, limit: 100 }));
      } else if (currentTab === "documents") {
        setDocuments(await listDocuments(profileId));
      } else if (currentTab === "team") {
        if (!isAdmin) { setUnauthorized(true); return; }
        const [bds, closers, team] = await Promise.all([listBdAssignments(profileId), listCloserEligibility(profileId), listUsers()]);
        setBdAssignments(bds);
        setCloserEligibilityState(closers);
        setUsers(team);
      } else if (currentTab === "activity") {
        setActivity(await listActivity({ profileId, limit: 100 }));
      } else if (currentTab === "analytics") {
        setAnalytics(await getDashboard(undefined, { profileId }));
      }
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 403) setUnauthorized(true);
      else setError(errorMessage(reason, "Orbit could not load this profile section. Try again."));
    } finally {
      setLoading(false);
    }
  }, [currentTab, isAdmin, profileId]);

  useEffect(() => { void load(); }, [load]);

  const activeBds = useMemo(() => bdAssignments.filter((assignment) => !assignment.endedAt), [bdAssignments]);
  const activeClosers = useMemo(() => closerEligibility.filter((assignment) => !assignment.endedAt), [closerEligibility]);
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
      setEditOpen(false);
      setNotice({ tone: "success", message: "Profile updated" });
      return true;
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update this profile.") });
      return false;
    } finally { setPending(undefined); }
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
      setLifecycleOpen(false);
      setNotice({ tone: "success", message: `Profile ${action === "restore" ? "restored to draft" : `${action}d`}` });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not change this profile status.") });
    } finally { setPending(undefined); }
  }

  async function addTeamMember(kind: "bd" | "closer") {
    const userId = kind === "bd" ? selectedBd : selectedCloser;
    if (!userId) return;
    setPending(`add-${kind}`);
    setNotice(undefined);
    try {
      const added = kind === "bd" ? await assignBd(profileId, userId) : await setCloserEligibility(profileId, userId);
      if (kind === "bd") { setBdAssignments((current) => [added, ...current]); setSelectedBd(""); }
      else { setCloserEligibilityState((current) => [added, ...current]); setSelectedCloser(""); }
      setNotice({ tone: "success", message: kind === "bd" ? "BD assigned" : "Closer eligibility added" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not update the profile team.") });
    } finally { setPending(undefined); }
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
      if (kind === "bd") setBdAssignments((current) => current.map(update));
      else setCloserEligibilityState((current) => current.map(update));
      setAssignmentReason("");
      setNotice({ tone: "success", message: kind === "bd" ? "BD assignment ended" : "Closer eligibility ended" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not end this assignment.") });
    } finally { setPending(undefined); }
  }

  async function uploadSelectedDocument() {
    if (!selectedFile) { setNotice({ tone: "danger", message: "Choose a document first." }); return; }
    setPending("document");
    setNotice(undefined);
    try {
      const created = await uploadDocument(profileId, { file: selectedFile, type: documentType, title: selectedFile.name.replace(/\.[^.]+$/, "") });
      setDocuments((current) => [created, ...current]);
      setSelectedFile(undefined);
      setDocumentOpen(false);
      setNotice({ tone: "success", message: "Document uploaded" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not upload this document.") });
    } finally { setPending(undefined); }
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
    try {
      await archiveDocument(item.id, "Archived from the profile workspace");
      setDocuments((current) => current.map((document) => document.id === item.id ? { ...document, archivedAt: new Date().toISOString() } : document));
      setNotice({ tone: "success", message: "Document archived" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not archive this document.") });
    } finally { setPending(undefined); }
  }

  async function replaceDocumentVersion(item: DocumentSummary, file: File) {
    setPending(`replace-${item.id}`);
    try {
      const updated = await uploadDocumentVersion(item.id, profileId, file);
      setDocuments((current) => current.map((document) => document.id === item.id ? updated : document));
      setNotice({ tone: "success", message: "Document version uploaded" });
    } catch (reason) {
      setNotice({ tone: "danger", message: errorMessage(reason, "Orbit could not upload this document version.") });
    } finally { setPending(undefined); }
  }

  if (loading && !profile) return <LoadingState label="Loading profile workspace" />;
  if (unauthorized) return <UnauthorizedState description="This profile section is outside your current role or assignment scope." />;
  if (error || !profile) return <ErrorState actionLabel="Retry" description={error ?? "The profile was not found."} onAction={() => void load()} title="Profile unavailable" />;

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link className="text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href={actor.role === "CLOSER" ? "/leads" : `/candidates/${profile.candidate.id}`}>{actor.role === "CLOSER" ? "← Assigned applications" : `← ${profile.candidate.preferredName ?? `${profile.candidate.firstName} ${profile.candidate.lastName}`}`}</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{profile.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(profile.status)}`}>{humanize(profile.status)}</span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{profile.description ?? "No profile description yet."}</p>
        </div>
        {currentTab === "overview" ? <div className="flex flex-wrap gap-2">
          {canEditProfile && profile.status !== "ARCHIVED" ? <Button onClick={() => setEditOpen(true)} variant="secondary">Edit profile</Button> : null}
          {isAdmin ? <Button onClick={() => setLifecycleOpen(true)} variant="ghost">Manage lifecycle</Button> : null}
          {!canEditProfile ? <span className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm font-semibold text-info">Read-only workspace</span> : null}
        </div> : null}
      </header>

      {profile.status === "ARCHIVED" ? <Card className="border-warning/30 bg-warning-soft p-4"><p className="font-semibold text-warning-foreground">Archived profile</p><p className="mt-1 text-sm text-muted-foreground">{profile.archiveReason ?? "No archive reason recorded."}</p></Card> : null}
      {notice ? <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === "success" ? "border-success/20 bg-success-soft text-success" : "border-danger/20 bg-danger-soft text-danger"}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.message}</p> : null}

      <nav aria-label="Profile sections" className="overflow-x-auto border-b border-border/70 pb-2">
        <div className="flex min-w-max gap-1">
          {visibleTabs.map((tab) => <Link aria-current={currentTab === tab.id ? "page" : undefined} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${currentTab === tab.id ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"}`} href={tab.id === "overview" ? `/profiles/${profileId}` : `/profiles/${profileId}/${tab.id}`} key={tab.id}>{tab.label}</Link>)}
        </div>
      </nav>

      {currentTab === "overview" ? <>
        <Card className="rounded-[1.5rem] p-5 shadow-[0_14px_36px_rgba(35,42,58,0.04)] sm:p-6">
          <section aria-label="Profile overview" className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Candidate</p><p className="mt-1.5 font-semibold text-foreground">{profile.candidate.firstName} {profile.candidate.lastName}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Target roles</p><p className="mt-1.5 font-semibold text-foreground">{profile.targetRoles.join(", ") || "—"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Locations</p><p className="mt-1.5 font-semibold text-foreground">{profile.preferredLocations.join(", ") || "—"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Compensation</p><p className="mt-1.5 font-semibold text-foreground">{profile.targetCompensation ? `${profile.defaultCurrency} ${profile.targetCompensation}${profile.compensationPeriod ? ` / ${profile.compensationPeriod.toLowerCase()}` : ""}` : "—"}</p></div>
          </section>
        </Card>
        <GoogleCalendarConnection canManage={isAdmin} profileId={profileId} initialConnection={calendar} />
      </> : null}

      {currentTab === "leads" ? <section className="grid gap-4">
        <SectionHeading eyebrow="Applications" title="Leads" description="Every application submitted with this profile, ordered by the API." />
        {leads.length === 0 ? <EmptyState description="Applications created for this profile will appear here." title="No leads yet" /> : <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-border bg-surface-subtle text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Applied</th><th className="px-5 py-3 text-right">Application</th></tr></thead><tbody className="divide-y divide-border">{leads.map((lead) => <tr className="transition hover:bg-primary/5" key={lead.id}><td className="px-5 py-4"><Link className="font-semibold text-foreground hover:text-primary hover:underline" href={`/leads/${lead.id}`}>{lead.jobTitle}</Link>{lead.isImportant ? <span className="ml-2 text-warning-foreground" title="Important">★</span> : null}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(lead.status)}`}>{humanize(lead.status)}</span></td><td className="px-5 py-4 text-sm text-muted-foreground">{sourceHost(lead.canonicalUrl ?? lead.rawUrl)}</td><td className="px-5 py-4 text-sm text-muted-foreground">{lead.appliedDate}</td><td className="px-5 py-4 text-right"><Link className="text-sm font-semibold text-primary hover:underline" href={`/leads/${lead.id}`}>Open →</Link></td></tr>)}</tbody></table></div>
        </Card>}
      </section> : null}

      {currentTab === "interviews" ? <section className="grid gap-4">
        <SectionHeading eyebrow="Schedule" title="Interview rounds" description="Past and upcoming rounds connected to this profile’s applications." />
        {interviews.length === 0 ? <EmptyState description="Scheduled interview rounds will appear here." title="No interviews yet" /> : <Card className="overflow-hidden p-0"><div className="divide-y divide-border">{interviews.map((round) => <article className="grid gap-3 px-5 py-4 transition hover:bg-primary/5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={round.id}><div><div className="flex flex-wrap items-center gap-2"><Link className="font-bold text-foreground hover:text-primary hover:underline" href={`/leads/${round.leadId}/interviews`}>{round.lead?.jobTitle ?? `Round ${round.roundNumber}`}</Link><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(round.status)}`}>{humanize(round.status)}</span></div><p className="mt-1 text-sm text-muted-foreground">Round {round.roundNumber} · {humanize(round.roundType)}{round.interviewer ? ` · ${round.interviewer}` : ""}</p></div><time className="text-sm font-semibold text-foreground" dateTime={round.startsAt}>{formatDateTime(round.startsAt, timeZone)}</time></article>)}</div></Card>}
      </section> : null}

      {currentTab === "tasks" ? <section className="grid gap-4">
        <SectionHeading eyebrow="Work queue" title="Tasks" description="Follow-ups and preparation assigned within this profile." />
        {tasks.length === 0 ? <EmptyState description="Profile-scoped tasks will appear here." title="No tasks yet" /> : <Card className="overflow-hidden p-0"><div className="divide-y divide-border">{tasks.map((task) => <article className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" key={task.id}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">{task.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(task.status)}`}>{humanize(task.status)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(task.priority)}`}>{humanize(task.priority)}</span></div><p className="mt-1 text-sm text-muted-foreground">{humanize(task.type)} · Due {formatDateTime(task.dueAt, timeZone)}</p>{task.leadId ? <Link className="mt-2 inline-block text-sm font-semibold text-primary hover:underline" href={`/leads/${task.leadId}`}>Open application →</Link> : null}</div>{task.status === "OPEN" ? <TaskActions taskId={task.id} version={task.version} /> : null}</article>)}</div></Card>}
      </section> : null}

      {currentTab === "documents" ? <section className="grid gap-4">
        <SectionHeading action={isAdmin ? <Button onClick={() => setDocumentOpen(true)}>Upload document</Button> : undefined} eyebrow="Profile files" title="Documents" description="Current CVs and supporting material associated with this search." />
        {documents.length === 0 ? <EmptyState description="No documents have been added to this profile." title="No documents yet" /> : <Card className="overflow-hidden p-0"><div className="divide-y divide-border">{documents.map((item) => <article className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center" key={item.id}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">{item.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.archivedAt ? "bg-surface-subtle text-muted-foreground" : "bg-success-soft text-success"}`}>{item.archivedAt ? "Archived" : "Current"}</span></div><p className="mt-1 text-sm text-muted-foreground">{humanize(item.type)} · {item.versions?.length ?? 0} version(s)</p></div><div className="flex flex-wrap gap-2">{!item.archivedAt ? <Button disabled={Boolean(pending)} loading={pending === `download-${item.id}`} onClick={() => void downloadDocument(item)} size="sm" variant="secondary">Download</Button> : null}{isAdmin && !item.archivedAt ? <><label className="sr-only" htmlFor={`replace-${item.id}`}>Replace {item.title}</label><Input accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" className="max-w-52" disabled={Boolean(pending)} id={`replace-${item.id}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceDocumentVersion(item, file); event.target.value = ""; }} type="file" /><Button disabled={Boolean(pending)} onClick={() => void archiveDocumentRecord(item)} size="sm" variant="ghost">Archive</Button></> : null}</div></article>)}</div></Card>}
        {!isAdmin ? <p className="text-xs font-semibold text-muted-foreground">Only Admins can add, replace, or archive profile documents.</p> : null}
      </section> : null}

      {currentTab === "team" && isAdmin ? <section className="grid gap-4">
        <SectionHeading action={<Button onClick={() => setTeamOpen(true)}>Manage team</Button>} eyebrow="Access" title="Profile team" description="BD ownership and Closers eligible to attend interviews for this profile." />
        <div className="grid gap-4 xl:grid-cols-2"><Card className="p-5"><h3 className="font-bold text-foreground">Assigned BDs</h3><div className="mt-4 grid gap-2">{activeBds.length ? activeBds.map((assignment) => <div className="rounded-xl bg-surface-subtle px-4 py-3" key={assignment.id}><p className="font-semibold text-foreground">{userName(assignment.userId)}</p><p className="mt-1 text-xs text-muted-foreground">Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p></div>) : <p className="text-sm text-muted-foreground">No active BD assignment.</p>}</div></Card><Card className="p-5"><h3 className="font-bold text-foreground">Eligible Closers</h3><div className="mt-4 grid gap-2">{activeClosers.length ? activeClosers.map((assignment) => <div className="rounded-xl bg-surface-subtle px-4 py-3" key={assignment.id}><p className="font-semibold text-foreground">{userName(assignment.userId)}</p><p className="mt-1 text-xs text-muted-foreground">Eligible since {new Date(assignment.assignedAt).toLocaleDateString()}</p></div>) : <p className="text-sm text-muted-foreground">No eligible Closers.</p>}</div></Card></div>
      </section> : null}

      {currentTab === "activity" ? <section className="grid gap-4">
        <SectionHeading eyebrow="Audit trail" title="Activity" description="Recorded changes and operational events for this profile." />
        {activity.length === 0 ? <EmptyState description="Profile activity will appear here as work progresses." title="No activity yet" /> : <Card className="overflow-hidden p-0"><ol className="divide-y divide-border">{activity.map((item) => <li className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center" key={item.id}><div><p className="font-semibold text-foreground">{humanize(item.action.replaceAll(".", " "))}</p><p className="mt-1 text-sm text-muted-foreground">{item.actorNameSnapshot ?? "Orbit system"}{item.actorRoleSnapshot ? ` · ${humanize(item.actorRoleSnapshot)}` : ""}</p></div><time className="text-xs font-semibold text-muted-foreground" dateTime={item.occurredAt}>{formatDateTime(item.occurredAt, timeZone)}</time></li>)}</ol></Card>}
      </section> : null}

      {currentTab === "analytics" ? <section className="grid gap-4">
        <SectionHeading eyebrow="Performance" title="Analytics" description="Profile-scoped applications, outcomes, and operational health." />
        {!analytics ? <EmptyState description="Analytics are not available for this profile yet." title="No analytics yet" /> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          ["Applications", analytics.kpis.applications], ["Responses", analytics.kpis.responses], ["Interview leads", analytics.kpis.interviews], ["Interview rounds", analytics.kpis.interviewRounds], ["Offers", analytics.kpis.offers], ["Placements", analytics.kpis.placements], ["Starts", analytics.kpis.starts], ["Overdue tasks", analytics.kpis.overdueTasks],
        ].map(([label, value]) => <Card className="p-5" key={label}><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground">{value}</p></Card>)}</div><div className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="font-bold text-foreground">Pipeline status</h3><div className="mt-4 grid gap-3">{analytics.breakdowns.statuses.map((item) => <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0" key={item.key}><span className="text-sm text-muted-foreground">{humanize(item.key)}</span><strong className="text-foreground">{item.count}</strong></div>)}</div></Card><Card className="p-5"><h3 className="font-bold text-foreground">Application sources</h3><div className="mt-4 grid gap-3">{analytics.breakdowns.sources.map((item) => <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0" key={item.key}><span className="text-sm text-muted-foreground">{humanize(item.key)}</span><strong className="text-foreground">{item.count}</strong></div>)}</div></Card></div></>}
      </section> : null}

      <Dialog description="Update the role, location, compensation, and work preferences for this search." onOpenChange={setEditOpen} open={editOpen} title="Edit profile"><ProfileForm embedded initial={profile} onSubmit={saveProfile} pending={pending === "save"} /></Dialog>
      <Dialog description="Change the profile’s availability without mixing lifecycle controls into the daily workspace." onOpenChange={setLifecycleOpen} open={lifecycleOpen} title="Manage profile lifecycle"><div className="grid gap-4">{profile.status !== "ARCHIVED" ? <Field htmlFor="archive-reason" hint="Required only when archiving" label="Archive reason"><Input id="archive-reason" onChange={(event) => setArchiveReason(event.target.value)} placeholder="Candidate paused the search" value={archiveReason} /></Field> : null}<div className="flex flex-wrap gap-2">{profile.status === "DRAFT" || profile.status === "PAUSED" ? <Button disabled={Boolean(pending)} loading={pending === "activate"} onClick={() => void changeStatus("activate")}>Activate profile</Button> : null}{profile.status === "ACTIVE" ? <Button disabled={Boolean(pending)} loading={pending === "pause"} onClick={() => void changeStatus("pause")} variant="secondary">Pause profile</Button> : null}{profile.status !== "ARCHIVED" ? <Button disabled={Boolean(pending)} loading={pending === "archive"} onClick={() => void changeStatus("archive")} variant="danger">Archive profile</Button> : <Button disabled={Boolean(pending)} loading={pending === "restore"} onClick={() => void changeStatus("restore")}>Restore profile</Button>}</div></div></Dialog>
      <Dialog description="Assign active team members or end access with a recorded reason." onOpenChange={setTeamOpen} open={teamOpen} title="Manage profile team"><div className="grid gap-6"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field htmlFor="assign-bd" label="Assign BD"><select className={selectClasses} id="assign-bd" onChange={(event) => setSelectedBd(event.target.value)} value={selectedBd}><option value="">Select active BD</option>{availableBds.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></Field><Button className="self-end" disabled={!selectedBd || Boolean(pending)} loading={pending === "add-bd"} onClick={() => void addTeamMember("bd")}>Assign BD</Button></div><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field htmlFor="assign-closer" label="Add eligible Closer"><select className={selectClasses} id="assign-closer" onChange={(event) => setSelectedCloser(event.target.value)} value={selectedCloser}><option value="">Select active Closer</option>{availableClosers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></Field><Button className="self-end" disabled={!selectedCloser || Boolean(pending)} loading={pending === "add-closer"} onClick={() => void addTeamMember("closer")}>Add Closer</Button></div><Field htmlFor="assignment-reason" hint="Required before ending access" label="Assignment change reason"><Input id="assignment-reason" onChange={(event) => setAssignmentReason(event.target.value)} placeholder="Coverage changed" value={assignmentReason} /></Field><div className="grid gap-2">{activeBds.map((assignment) => <div className="flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3" key={assignment.id}><span className="text-sm font-semibold">{userName(assignment.userId)} · BD</span><Button disabled={Boolean(pending)} onClick={() => void endTeamMember("bd", assignment)} size="sm" variant="ghost">End access</Button></div>)}{activeClosers.map((assignment) => <div className="flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3" key={assignment.id}><span className="text-sm font-semibold">{userName(assignment.userId)} · Closer</span><Button disabled={Boolean(pending)} onClick={() => void endTeamMember("closer", assignment)} size="sm" variant="ghost">End access</Button></div>)}</div></div></Dialog>
      <Dialog description="Add the current CV or supporting material to this profile." onOpenChange={setDocumentOpen} open={documentOpen} title="Upload document"><div className="grid gap-4 sm:grid-cols-[1fr_180px]"><Field htmlFor="profile-document" label="Document" hint="PDF, DOCX, PNG, or JPG · 25 MB max"><Input accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" id="profile-document" onChange={(event) => setSelectedFile(event.target.files?.[0])} type="file" /></Field><Field htmlFor="document-type" label="Type"><select className={selectClasses} id="document-type" onChange={(event) => setDocumentType(event.target.value as typeof documentType)} value={documentType}><option value="CV">CV</option><option value="COVER_LETTER">Cover letter</option><option value="SUPPORTING">Supporting</option><option value="OTHER">Other</option></select></Field><Button className="sm:col-span-2 sm:justify-self-end" disabled={!selectedFile || Boolean(pending)} loading={pending === "document"} onClick={() => void uploadSelectedDocument()}>Upload document</Button></div></Dialog>
    </div>
  );
}
