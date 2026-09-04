import type { ActivityEventSummary, InterviewSummary, SessionUser, TaskSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";
import type { DashboardData } from "../../lib/api-client";
import { CalendarWorkspace } from "../calendar/calendar-workspace";

const activities = [
  ["Lead moved to interviewing", "Sarah Ahmed · Senior Product Designer", "8 min ago", "info"],
  ["Interview scheduled", "Marcus Lee · Acme Systems", "24 min ago", "success"],
  ["Follow-up became overdue", "Priya Shah · Northstar Labs", "1 hr ago", "warning"],
  ["New application recorded", "Daniel Kim · Platform Engineer", "2 hrs ago", "neutral"],
] as const;

function activityLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function taskTypeLabel(value: TaskSummary["type"]) {
  return value === "FOLLOW_UP" ? "Follow-up" : value === "PREPARE_INTERVIEW" ? "Interview prep" : "General";
}

function WorkQueuePreview({ tasks }: { tasks: TaskSummary[] }) {
  return <Card aria-label="Work queue" className="mt-5 p-5 sm:p-6"><header className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold text-foreground">Work queue</h2><p className="mt-1 text-xs text-muted-foreground">The next actions assigned in this workspace.</p></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/tasks">Open work queue</a></header>{tasks.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Queue is clear.</p> : <ol className="mt-5 divide-y divide-border">{tasks.slice(0, 4).map((task) => <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={task.id}><span className={`mt-1.5 size-2 shrink-0 rounded-full ${task.priority === "HIGH" ? "bg-danger" : task.priority === "MEDIUM" ? "bg-warning" : "bg-muted-foreground"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{taskTypeLabel(task.type)} · Due {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(task.dueAt))}</p></div><span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{task.priority}</span></li>)}</ol>}</Card>;
}

export function DashboardOverview({ actor, dashboard, recentActivity, calendarInterviews, openTasks = [], error }: { actor: SessionUser; dashboard?: DashboardData; recentActivity?: ActivityEventSummary[]; calendarInterviews?: InterviewSummary[]; openTasks?: TaskSummary[]; error?: string }) {
  const firstName = actor.displayName.split(" ")[0];
  const activityItems = recentActivity?.map((event) => [activityLabel(event.action), entityLabel(event.entityType), new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt)), "info"] as const) ?? activities;
  return <div className="mx-auto max-w-[1500px]">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Today at a glance</h1><p className="mt-1.5 text-sm text-muted-foreground">Interviews, candidate work, and changes that need attention.</p></div><p className="w-fit text-xs font-medium text-muted-foreground">Updated just now · PKT</p></div>
    {error ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground" role="status">{error} Showing the last available workspace layout.</p> : null}
    <section aria-label="Primary calendar" className="mt-7"><CalendarWorkspace actor={actor} interviews={calendarInterviews ?? []} embedded /></section>
    <div aria-label="Workspace pulse" className="mt-4 grid grid-cols-2 divide-x divide-y divide-border border-y border-border bg-surface sm:grid-cols-4 sm:divide-y-0"><div className="px-4 py-3 first:pl-0"><p className="text-[11px] font-semibold text-muted-foreground">Open applications</p><p className="mt-1 text-xl font-bold tracking-[-0.04em] text-foreground">{dashboard?.kpis.applications ?? 0}</p></div><div className="px-4 py-3"><p className="text-[11px] font-semibold text-muted-foreground">Interviews</p><p className="mt-1 text-xl font-bold tracking-[-0.04em] text-foreground">{dashboard?.kpis.interviews ?? 0}</p></div><div className="px-4 py-3"><p className="text-[11px] font-semibold text-muted-foreground">Offers</p><p className="mt-1 text-xl font-bold tracking-[-0.04em] text-success">{dashboard?.kpis.offers ?? 0}</p></div><div className="px-4 py-3"><p className="text-[11px] font-semibold text-muted-foreground">Needs review</p><p className={`mt-1 text-xl font-bold tracking-[-0.04em] ${(dashboard?.kpis.overdueTasks ?? 0) > 0 ? "text-warning-foreground" : "text-foreground"}`}>{dashboard?.kpis.overdueTasks ?? 0}</p></div></div>
    <Card className="mt-5 p-5 sm:p-6"><header className="flex items-center justify-between gap-4"><div><h2 className="text-base font-semibold text-foreground">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Latest changes in your permitted workspace.</p></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/activity">View all activity</a></header><ol className="mt-5 divide-y divide-border">{activityItems.map(([title, context, time, tone]) => <li className="flex gap-3 py-4 first:pt-0 last:pb-0" key={title}><span className={`mt-1 size-2.5 shrink-0 rounded-full ring-4 ${tone === "success" ? "bg-success ring-success-soft" : tone === "warning" ? "bg-warning ring-warning-soft" : tone === "info" ? "bg-info ring-info-soft" : "bg-muted-foreground ring-surface-subtle"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{context}</p></div><time className="shrink-0 text-xs text-muted-foreground">{time}</time></li>)}</ol></Card>
    <WorkQueuePreview tasks={openTasks} />
  </div>;
}
