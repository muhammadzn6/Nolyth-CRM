import type { ActivityEventSummary, InterviewSummary, LeadSummary, SessionUser, TaskSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";
import type { DashboardData } from "../../lib/api-client";
import { CalendarWorkspace } from "../calendar/calendar-workspace";
import { buildDashboardKpis } from "./dashboard-kpis";
import { DashboardSidePanel } from "./dashboard-side-panel";
import { buildBdDashboardKpis, buildBdSecondarySignals } from "./bd-dashboard-kpis";

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

function DashboardKpiStrip({ dashboard, calendarInterviews }: { dashboard?: DashboardData; calendarInterviews?: InterviewSummary[] }) {
  const cards = buildDashboardKpis(dashboard?.kpis ?? {
    applications: 0, responses: 0, interviews: 0, offers: 0, acceptedOffers: 0,
    placements: 0, starts: 0, activePipeline: 0, overdueTasks: 0, responseRate: null,
  }, calendarInterviews?.filter((interview) => interview.status === "RESCHEDULE_REQUIRED").length ?? 0);
  return <section aria-label="Workspace pulse" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{cards.map((card) => <a aria-label={`${card.label}: ${card.value}. ${card.definition}`} className={`rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(23,35,56,0.03)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${card.tone === "warning" ? "border-warning/40 bg-warning-soft" : card.tone === "success" ? "border-success/30 bg-success-soft" : ""}`} href={card.href} key={card.key} title={card.definition}><p className="text-[11px] font-semibold leading-4 text-muted-foreground">{card.label}</p><p className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${card.tone === "warning" ? "text-warning-foreground" : card.tone === "success" ? "text-success" : card.tone === "info" ? "text-info" : "text-foreground"}`}>{card.value.toLocaleString()}</p><p className="mt-1 text-[10px] font-medium text-muted-foreground">View records →</p></a>)}</section>;
}

function BdDashboardKpiStrip({ applications, dashboard, openTasks, calendarInterviews }: { applications: LeadSummary[]; dashboard?: DashboardData; openTasks: TaskSummary[]; calendarInterviews: InterviewSummary[] }) {
  const cards = buildBdDashboardKpis({ applications, openFollowUps: openTasks.length, interviewsToSchedule: applications.filter((application) => application.status === "RESPONSE_RECEIVED").length, now: new Date() });
  return <section aria-label="BD intake pulse" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{cards.map((card) => <a aria-label={`${card.label}: ${card.value}. ${card.definition}`} className={`rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(23,35,56,0.03)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${card.tone === "warning" ? "border-warning/40 bg-warning-soft" : card.tone === "success" ? "border-success/30 bg-success-soft" : ""}`} href={card.href} key={card.key} title={card.definition}><p className="text-[11px] font-semibold leading-4 text-muted-foreground">{card.label}</p><p className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${card.tone === "warning" ? "text-warning-foreground" : card.tone === "success" ? "text-success" : card.tone === "info" ? "text-info" : "text-foreground"}`}>{card.value.toLocaleString()}</p><p className="mt-1 text-[10px] font-medium text-muted-foreground">View records →</p></a>)}</section>;
}

function BdSecondarySignals({ applications, dashboard, openTasks, calendarInterviews }: { applications: LeadSummary[]; dashboard?: DashboardData; openTasks: TaskSummary[]; calendarInterviews: InterviewSummary[] }) {
  const signals = buildBdSecondarySignals({ applications, scheduledInterviews: calendarInterviews.length, interviewsToSchedule: applications.filter((application) => application.status === "RESPONSE_RECEIVED").length, averageResponseTimeHours: dashboard?.kpis.averageResponseTimeHours ?? null });
  const items = [["Interviews scheduled", signals.scheduledInterviews, "/calendar"], ["Interviews to schedule", signals.interviewsToSchedule, "/calendar"], ["Offers received", signals.offers, "/leads?status=OFFER_RECEIVED"], ["Closed / rejected", signals.closed, "/leads?status=CLOSED"], ["Average response time", signals.averageResponseTimeHours == null ? "—" : `${signals.averageResponseTimeHours}h`, "/analytics"], ["Follow-ups due", openTasks.length, "/tasks"]] as const;
  return <section aria-label="BD pipeline signals" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]"><Card className="p-5 sm:p-6"><header><h2 className="text-base font-semibold text-foreground">Pipeline signals</h2><p className="mt-1 text-xs text-muted-foreground">Secondary indicators for recruiter follow-through.</p></header><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(([label, value, href]) => <a className="rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-surface-subtle" href={href} key={label}><p className="text-[11px] font-semibold leading-4 text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold text-foreground">{value}</p></a>)}</div></Card><Card className="p-5 sm:p-6"><header><h2 className="text-base font-semibold text-foreground">Applications by platform</h2><p className="mt-1 text-xs text-muted-foreground">Source distribution in your application records.</p></header>{dashboard?.breakdowns.sources.length ? <ul className="mt-5 divide-y divide-border">{dashboard.breakdowns.sources.slice(0, 5).map((source) => <li className="flex items-center justify-between py-2.5 text-sm first:pt-0" key={source.key}><span className="text-muted-foreground">{source.key}</span><span className="font-semibold text-foreground">{source.count}</span></li>)}</ul> : <p className="mt-5 text-sm text-muted-foreground">Platform data will appear as applications are recorded.</p>}</Card></section>;
}

export function DashboardOverview({ actor, dashboard, recentActivity, calendarInterviews, openTasks = [], applications = [], error }: { actor: SessionUser; dashboard?: DashboardData; recentActivity?: ActivityEventSummary[]; calendarInterviews?: InterviewSummary[]; openTasks?: TaskSummary[]; applications?: LeadSummary[]; error?: string }) {
  const firstName = actor.displayName.split(" ")[0];
  const activityItems = recentActivity?.map((event) => [activityLabel(event.action), entityLabel(event.entityType), new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt)), "info"] as const) ?? activities;
  return <div className="editorial-dashboard mx-auto max-w-[1500px]">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Today at a glance</h1><p className="mt-1.5 text-sm text-muted-foreground">Interviews, candidate work, and changes that need attention.</p></div><p className="w-fit text-xs font-medium text-muted-foreground">Updated just now · PKT</p></div>
    {error ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground" role="status">{error} Showing the last available workspace layout.</p> : null}
    <div className="mt-6">{actor.role === "BD" ? <BdDashboardKpiStrip applications={applications} calendarInterviews={calendarInterviews ?? []} dashboard={dashboard} openTasks={openTasks} /> : <DashboardKpiStrip dashboard={dashboard} calendarInterviews={calendarInterviews} />}</div>
    <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.7fr)]"><section aria-label="Primary calendar"><CalendarWorkspace actor={actor} interviews={calendarInterviews ?? []} embedded /></section><DashboardSidePanel activity={recentActivity ?? []} interviews={calendarInterviews ?? []} tasks={openTasks} /></div>
    {actor.role === "BD" ? <BdSecondarySignals applications={applications} calendarInterviews={calendarInterviews ?? []} dashboard={dashboard} openTasks={openTasks} /> : null}
    <Card className="mt-5 p-5 sm:p-6"><header className="flex items-center justify-between gap-4"><div><h2 className="text-base font-semibold text-foreground">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Latest changes in your permitted workspace.</p></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/activity">View all activity</a></header><ol className="mt-5 divide-y divide-border">{activityItems.map(([title, context, time, tone]) => <li className="flex gap-3 py-4 first:pt-0 last:pb-0" key={title}><span className={`mt-1 size-2.5 shrink-0 rounded-full ring-4 ${tone === "success" ? "bg-success ring-success-soft" : tone === "warning" ? "bg-warning ring-warning-soft" : tone === "info" ? "bg-info ring-info-soft" : "bg-muted-foreground ring-surface-subtle"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{context}</p></div><time className="shrink-0 text-xs text-muted-foreground">{time}</time></li>)}</ol></Card>
    <WorkQueuePreview tasks={openTasks} />
  </div>;
}
