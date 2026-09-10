"use client";

import type {
  CalendarConnection,
  CloserDashboardData,
  CloserDashboardExternalMeeting,
  CloserDashboardMeeting,
  InterviewSummary,
  SessionUser,
} from "@orbit/contracts";
import { Button, Card, CardTitle } from "@orbit/ui";
import { businessDateDisplay } from "../../lib/business-day";
import { CalendarWorkspace } from "../calendar/calendar-workspace";
import { CloserLifetimeFunnel } from "./closer-lifetime-funnel";
import styles from "./closer-dashboard.module.css";

type CloserDashboardProps = {
  actor: SessionUser;
  data?: CloserDashboardData;
  calendarInterviews?: InterviewSummary[];
  error?: string;
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function activityLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function interviewLabel(interview: InterviewSummary) {
  return `${titleCase(interview.roundType)} · Round ${interview.roundNumber}`;
}

function interviewTime(interview: InterviewSummary) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: interview.timezone,
  }).format(new Date(interview.startsAt));
}

function dashboardTimestamp(value: string, timezone: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value))} · ${timezone}`;
}

function interviewDate(interview: InterviewSummary) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: interview.timezone,
  }).format(new Date(interview.startsAt));
}

function calendarState(connection: CalendarConnection) {
  if (connection.status === "CONNECTED") {
    return {
      title: "Connected",
      description: connection.calendarName ?? connection.email ?? "Candidate calendars are connected.",
    };
  }
  if (connection.status === "SYNCING") {
    return {
      title: "Syncing",
      description: "Candidate calendars are syncing your Orbit meetings.",
    };
  }
  if (connection.status === "EXPIRED") {
    return {
      title: "Reconnect required",
      description: "A candidate calendar permission has expired. Ask an Admin to reconnect it.",
    };
  }
  return {
    title: "Not connected",
    description: "No assigned candidate calendar is connected yet. Ask an Admin to connect it.",
  };
}

function EmptyState({ children }: { children: string }) {
  return <p className="py-5 text-sm text-muted-foreground">{children}</p>;
}

function dashboardDateKey(value: Date | string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDaysToDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

type UpcomingInterview = { startsAt: string; status?: InterviewSummary["status"] };

function CloserPulse({ data, upcomingInterviews }: { data: CloserDashboardData; upcomingInterviews: UpcomingInterview[] }) {
  const now = new Date();
  const today = dashboardDateKey(now, data.timezone);
  const finalDay = addDaysToDateKey(today, 6);
  const nextSevenDays = upcomingInterviews.filter((interview) => {
    if (interview.status && !["SCHEDULED", "RESCHEDULE_REQUIRED"].includes(interview.status)) return false;
    const startsAtDate = new Date(interview.startsAt);
    const dateKey = dashboardDateKey(startsAtDate, data.timezone);
    return startsAtDate >= now && dateKey >= today && dateKey <= finalDay;
  }).length;
  const items = [
    ["Rounds today", data.todayMeetings.length, "#primary-calendar"],
    ["Rounds · 7 days", nextSevenDays, "#primary-calendar"],
    ["Feedback due", data.needsFeedback.length, "#attention"],
    ["Conflicts", data.conflicts.length, "#attention"],
  ] as const;
  return <div aria-label="Closer summary" className={styles.summary}>
    {items.map(([label, value, href]) => <a aria-label={`${label}: ${value}`} href={href} key={label}><span>{label}</span><strong>{value}</strong></a>)}
  </div>;
}

function externalTime(meeting: CloserDashboardExternalMeeting) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: meeting.timezone }).format(new Date(meeting.startsAt));
}

function Agenda({ meetings, externalMeetings }: { meetings: InterviewSummary[]; externalMeetings: CloserDashboardExternalMeeting[] }) {
  const items = [
    ...meetings.map((meeting) => ({ kind: "interview" as const, startsAt: meeting.startsAt, meeting })),
    ...externalMeetings.map((meeting) => ({ kind: "external" as const, startsAt: meeting.startsAt, meeting })),
  ].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  return (
    <Card aria-label="Today’s agenda" className="editorial-surface-lines p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Today’s agenda</CardTitle>
        </div>
        <a aria-label="View calendar" className="text-lg font-bold leading-none text-primary hover:text-primary-hover" href="#primary-calendar" title="View calendar">→</a>
      </header>
      {items.length === 0 ? <EmptyState>No meetings on your agenda today.</EmptyState> : (
        <ol className="mt-5 divide-y divide-border">
          {items.map((item) => item.kind === "interview" ? (
            <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0" key={item.meeting.id}>
              <time className="text-sm font-semibold text-foreground">{interviewTime(item.meeting)} · {item.meeting.timezone}</time><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{interviewLabel(item.meeting)}</p><p className="mt-1 text-xs text-muted-foreground">{item.meeting.interviewer ?? item.meeting.location ?? "Interview details available in Orbit."}</p></div>
            </li>
          ) : (
            <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0" key={item.meeting.id}>
              <time className="text-sm font-semibold text-foreground">{externalTime(item.meeting)} · {item.meeting.timezone}</time><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{item.meeting.title}</p><p className="mt-1 text-xs text-muted-foreground">External Google Calendar event{item.meeting.location ? ` · ${item.meeting.location}` : ""}</p></div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function NextMeetingBriefing({ meeting }: { meeting: CloserDashboardMeeting | null }) {
  return (
    <section aria-label="Next interview briefing" className={styles.briefing}>
      <header className={styles.sectionHeader}>
        <div><p className={styles.eyebrow}>Up next</p><h2>Next interview</h2></div>
        {meeting ? <span className={styles.statusPill}>{titleCase(meeting.status)}</span> : null}
      </header>
      {meeting ? (
        <div className={styles.briefingBody}>
          <div className={styles.briefingLead}>
            <p>{meeting.jobTitle}</p>
            <span>{meeting.candidateName} · {meeting.companyName}</span>
          </div>
          <p className={styles.meetingTime}>{interviewDate(meeting)} · {interviewTime(meeting)} · {meeting.timezone}</p>
          <dl className={styles.briefingDetails}>
            <div><dt>Round</dt><dd>{interviewLabel(meeting)}</dd></div>
            <div><dt>Interviewer</dt><dd>{meeting.interviewer ?? "Not specified"}</dd></div>
            <div><dt>Profile</dt><dd>{meeting.profileName}</dd></div>
            <div><dt>Preparation</dt><dd>{meeting.preparationNotes ?? "No preparation notes added."}</dd></div>
          </dl>
          <div className={styles.briefingActions}>
            <a href={`/leads/${meeting.leadId}`}>Open application</a>
            {meeting.meetingLink ? <a className={styles.primaryAction} href={meeting.meetingLink}>Join meeting</a> : null}
          </div>
        </div>
      ) : <EmptyState>No upcoming meeting is scheduled.</EmptyState>}
    </section>
  );
}

function AssignedApplications({ applications }: { applications: CloserDashboardData["assignedApplications"] }) {
  return (
    <Card aria-label="Active interview pipeline" className={`${styles.supportCard} ${styles.pipelineCard}`}>
      <header className={styles.supportHeader}>
        <div><p className={styles.eyebrow}>Active work</p><CardTitle>Active interview pipeline</CardTitle></div>
        <a href="/leads">View all →</a>
      </header>
      {applications.length === 0 ? <EmptyState>No active applications are assigned to you.</EmptyState> : (
        <ul className={styles.scrollList}>
          {applications.map((application) => (
            <li key={application.id}>
              <a href={`/leads/${application.id}`}>
                <div>
                  <p>{application.jobTitle}</p>
                  <span>{application.candidateName} · {application.companyName}</span>
                  <small>{application.profileName}</small>
                </div>
                <span className={styles.pipelineMeta}><b>{titleCase(application.status)}</b>{application.nextInterviewAt ? <time>{dashboardTimestamp(application.nextInterviewAt, "America/New_York")}</time> : <small>No interview scheduled</small>}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NeedsAttention({ data }: { data: CloserDashboardData }) {
  const count = data.needsFeedback.length + data.openTasks.length + data.conflicts.length;
  return (
    <section aria-label="Needs attention" className={`${styles.attention} ${count ? styles.attentionActive : ""}`} id="attention">
      <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>Work queue</p><h2>Needs attention</h2></div><span className={styles.attentionCount}>{count}</span></header>
      {count === 0 ? <div className={styles.clearState}><span>✓</span><p><strong>You’re clear for now</strong><small>No feedback, tasks, or conflicts need action.</small></p></div> : <div className={styles.attentionList}>
        {data.conflicts.map((meeting) => <a href="#primary-calendar" key={meeting.id}><span className={styles.dangerDot} /><p><strong>Reschedule required</strong><small>{interviewLabel(meeting)} · {interviewTime(meeting)}</small></p><b title="Open conflict" aria-label="Open conflict">→</b></a>)}
        {data.needsFeedback.map((meeting) => <a href={`/leads/${meeting.leadId}/interviews?edit=${meeting.id}`} key={meeting.id}><span className={styles.warningDot} /><p><strong>Record interview feedback</strong><small>{interviewLabel(meeting)} · {meeting.interviewer ?? "Interviewer"}</small></p><b title="Record feedback" aria-label="Record feedback">→</b></a>)}
        {data.openTasks.map((task) => <a href="/tasks" key={task.id}><span className={styles.neutralDot} /><p><strong>{task.title}</strong><small>Due {dashboardTimestamp(task.dueAt, data.timezone)}</small></p><b title={`Priority: ${titleCase(task.priority)}`} aria-label={`Priority: ${titleCase(task.priority)}`}>{titleCase(task.priority)}</b></a>)}
      </div>}
    </section>
  );
}

function Updates({ data }: { data: CloserDashboardData }) {
  const items = [
    ...data.notifications.map((notification) => ({ id: `notification-${notification.id}`, title: notification.title, description: notification.message, occurredAt: notification.createdAt, href: "/notifications" })),
    ...data.recentActivity.map((activity) => ({ id: `activity-${activity.id}`, title: activityLabel(activity.action), description: activity.actorNameSnapshot ?? "Orbit", occurredAt: activity.occurredAt, href: "/activity" })),
  ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  return (
    <Card aria-label="Recent updates" className={`${styles.supportCard} ${styles.updatesCard}`}>
      <header className={styles.supportHeader}><div><p className={styles.eyebrow}>Activity</p><CardTitle>Recent updates</CardTitle></div><nav aria-label="Recent update views" className={styles.updateViews}><a href="/activity">Activity</a><span>/</span><a href="/notifications">Alerts</a></nav></header>
      {items.length === 0 ? <EmptyState>No recent updates.</EmptyState> : <ol className={styles.updateList}>{items.slice(0, 8).map((item) => <li key={item.id}><a href={item.href}><span className={styles.updateDot} /><p><strong>{item.title}</strong><small>{item.description}</small></p><time>{dashboardTimestamp(item.occurredAt, data.timezone)}</time></a></li>)}</ol>}
    </Card>
  );
}

function CalendarStatus({ connection, timezone }: { connection: CalendarConnection; timezone: string }) {
  const state = calendarState(connection);
  const syncedAt = connection.lastSyncedAt ? `Synced ${dashboardTimestamp(connection.lastSyncedAt, timezone)}` : null;
  return <a aria-label={`Calendar: ${state.title}. ${state.description}${syncedAt ? `. ${syncedAt}` : ""}`} className={styles.calendarStatus} href="/settings" title={state.description}><span className={connection.status === "CONNECTED" ? styles.connectedDot : styles.disconnectedDot} /><span>Calendar · <strong>{state.title}</strong>{syncedAt ? <small>{syncedAt}</small> : null}</span><b>Settings →</b></a>;
}

export function CloserDashboard({ actor, data, calendarInterviews, error }: CloserDashboardProps) {
  const firstName = actor.displayName.split(" ")[0];
  const dashboard = data ?? {
    timezone: "UTC",
    assignedApplications: [],
    nextMeeting: null,
    todayMeetings: [],
    externalMeetings: [],
    needsFeedback: [],
    openTasks: [],
    conflicts: [],
    notifications: [],
    recentActivity: [],
    lifetimeFunnel: {
      applicationsHandled: 0,
      interviewsScheduled: 0,
      callsAttended: 0,
      interviewRounds: 0,
      attendedRounds: 0,
      cancelledRounds: 0,
      averageRoundsPerInterviewLead: null,
      roundAttendanceRate: null,
      offers: 0,
      placements: 0,
    },
    calendarConnection: { connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" as const },
  };
  const today = new Date();
  const businessDate = businessDateDisplay(today, dashboard.timezone);
  const assignedInterviews = dashboard.assignedApplications.flatMap((application) => application.nextInterviewAt ? [{ startsAt: application.nextInterviewAt }] : []);
  const upcomingInterviews = calendarInterviews
    ? calendarInterviews.map((interview) => ({ startsAt: interview.startsAt, status: interview.status }))
    : assignedInterviews.length > 0
      ? assignedInterviews
      : dashboard.todayMeetings.map((interview) => ({ startsAt: interview.startsAt, status: interview.status }));

  return (
    <div className={`editorial-dashboard mx-auto max-w-[1500px] ${styles.dashboard}`}>
      <div aria-label="Closer dashboard context" className="editorial-hero"><div className="editorial-date-rail"><span className="editorial-date-number">{businessDate.day}</span><span><strong>{businessDate.label}</strong><small>Week {businessDate.week} · {businessDate.year}</small></span><Button aria-label="Refresh dashboard" onClick={() => window.location.reload()} variant="secondary">Refresh</Button></div><div className="editorial-greeting"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Closer command center</p><h1>Good morning, {firstName}</h1><p>Your calls, preparation, and feedback at a glance.</p></div></div>
      {error ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground" role="status">{error}</p> : null}
      <section aria-label="Closer operational workspace" className={styles.workbench}>
        <section aria-label="Primary calendar" className={styles.calendarPanel} id="primary-calendar"><CalendarWorkspace actor={actor} businessTimeZone={dashboard.timezone} interviews={calendarInterviews ?? dashboard.todayMeetings} externalMeetings={dashboard.externalMeetings} embedded /></section>
        <aside aria-label="Closer control rail" className={styles.controlRail}>
          <div className={styles.summaryRegion}><CloserPulse data={dashboard} upcomingInterviews={upcomingInterviews} /><CalendarStatus connection={dashboard.calendarConnection} timezone={dashboard.timezone} /></div>
          <NextMeetingBriefing meeting={dashboard.nextMeeting} />
          <NeedsAttention data={dashboard} />
        </aside>
      </section>
      <section className={styles.supportGrid}><AssignedApplications applications={dashboard.assignedApplications} /><Updates data={dashboard} /></section>
      <section className="mt-5"><CloserLifetimeFunnel totals={dashboard.lifetimeFunnel} /></section>
    </div>
  );
}
