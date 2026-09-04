"use client";

import type {
  CalendarConnection,
  CloserDashboardData,
  CloserDashboardExternalMeeting,
  CloserDashboardMeeting,
  InterviewSummary,
  SessionUser,
} from "@orbit/contracts";
import { Button, Card, CardDescription, CardTitle } from "@orbit/ui";
import { GoogleCalendarConnection } from "../calendar/google-calendar-connection";
import { CalendarWorkspace } from "../calendar/calendar-workspace";

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
      tone: "text-success",
    };
  }
  if (connection.status === "SYNCING") {
    return {
      title: "Syncing",
      description: "Candidate calendars are syncing your Orbit meetings.",
      tone: "text-info",
    };
  }
  if (connection.status === "EXPIRED") {
    return {
      title: "Reconnect required",
      description: "A candidate calendar permission has expired. Ask an Admin to reconnect it.",
      tone: "text-warning-foreground",
    };
  }
  return {
    title: "Not connected",
    description: "No assigned candidate calendar is connected yet. Ask an Admin to connect it.",
    tone: "text-muted-foreground",
  };
}

function EmptyState({ children }: { children: string }) {
  return <p className="py-5 text-sm text-muted-foreground">{children}</p>;
}

function CloserPulse({ data }: { data: CloserDashboardData }) {
  const items = [
    ["Today", data.todayMeetings.length, "text-foreground"],
    ["This week", data.assignedApplications.length, "text-foreground"],
    ["Feedback due", data.needsFeedback.length, data.needsFeedback.length ? "text-warning-foreground" : "text-success"],
    ["Conflicts", data.conflicts.length, data.conflicts.length ? "text-danger" : "text-success"],
  ] as const;
  return <div aria-label="Closer workload summary" className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border bg-surface sm:grid-cols-4 sm:divide-y-0">
    {items.map(([label, value, tone]) => <div className="px-4 py-3 first:pl-0 sm:px-4" key={label}><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold tracking-[-0.04em] ${tone}`}>{value}</p></div>)}
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
    <Card aria-label="Today’s agenda" className="p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Today’s agenda</CardTitle>
          <CardDescription className="mt-1">Your scheduled interviews, in order.</CardDescription>
        </div>
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
    <Card className="p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Up next</p>
      <CardTitle className="mt-2">Next meeting briefing</CardTitle>
      {meeting ? (
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">{interviewLabel(meeting)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{interviewDate(meeting)} · {interviewTime(meeting)} · {meeting.timezone}</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</dt><dd className="mt-1 text-foreground">{meeting.candidateName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</dt><dd className="mt-1 text-foreground">{meeting.profileName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunity</dt><dd className="mt-1 text-foreground">{meeting.jobTitle} at {meeting.companyName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interviewer</dt><dd className="mt-1 text-foreground">{meeting.interviewer ?? "Not specified"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preparation</dt><dd className="mt-1 leading-6 text-foreground">{meeting.preparationNotes ?? "No preparation notes added."}</dd></div>
          </dl>
          {meeting.meetingLink ? <a className="inline-flex text-sm font-semibold text-primary hover:text-primary-hover" href={meeting.meetingLink}>Join meeting</a> : null}
        </div>
      ) : <EmptyState>No upcoming meeting is scheduled.</EmptyState>}
    </Card>
  );
}

function AssignedApplications({ applications }: { applications: CloserDashboardData["assignedApplications"] }) {
  return (
    <Card aria-label="Assigned applications" className="p-5 sm:p-6">
      <header>
        <CardTitle>Assigned applications</CardTitle>
        <CardDescription className="mt-1">Candidates and opportunities assigned to you.</CardDescription>
      </header>
      {applications.length === 0 ? <EmptyState>No active applications are assigned to you.</EmptyState> : (
        <ul className="mt-5 divide-y divide-border">
          {applications.map((application) => (
            <li className="py-4 first:pt-0 last:pb-0" key={application.id}>
              <a className="block rounded-lg transition hover:bg-surface-subtle" href={`/leads/${application.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{application.candidateName}</p>
                    <p className="mt-1 text-sm text-foreground">{application.jobTitle} at {application.companyName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{application.profileName} · {titleCase(application.status)}</p>
                  </div>
                  {application.nextInterviewAt ? <time className="shrink-0 text-xs font-semibold text-primary">Next interview</time> : null}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FeedbackQueue({ meetings }: { meetings: InterviewSummary[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <header><CardTitle>Feedback to record</CardTitle><CardDescription className="mt-1">Close the loop on completed interviews.</CardDescription></header>
      {meetings.length === 0 ? <EmptyState>No feedback is waiting.</EmptyState> : <ol className="mt-5 space-y-3">{meetings.map((meeting) => <li className="rounded-xl border border-border p-4" key={meeting.id}><p className="text-sm font-semibold text-foreground">{interviewLabel(meeting)}</p><p className="mt-1 text-xs text-muted-foreground">{meeting.interviewer ?? "Interview feedback"} · ended {interviewDate(meeting)} · {meeting.timezone}</p></li>)}</ol>}
    </Card>
  );
}

function ActionQueue({ data }: { data: CloserDashboardData }) {
  return (
    <Card className="p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4"><div><CardTitle>Work queue</CardTitle><CardDescription className="mt-1">The next actions and scheduling issues needing attention.</CardDescription></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/tasks">Open queue</a></header>
      {data.openTasks.length === 0 && data.conflicts.length === 0 ? <EmptyState>Queue is clear.</EmptyState> : <div className="mt-5 space-y-3">{data.conflicts.map((meeting) => <a className="block rounded-xl border border-danger/30 bg-danger-soft p-4" href="/" key={meeting.id}><p className="text-sm font-semibold text-danger">Reschedule required</p><p className="mt-1 text-xs text-foreground">{interviewLabel(meeting)} · {interviewTime(meeting)} · {meeting.timezone}</p></a>)}{data.openTasks.map((task) => <a className="block rounded-xl border border-border p-4 transition hover:border-border-strong hover:bg-surface-subtle" href="/tasks" key={task.id}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-foreground">{task.title}</p><span className="shrink-0 text-xs font-semibold text-muted-foreground">{titleCase(task.priority)}</span></div><p className="mt-1 text-xs text-muted-foreground">Due {dashboardTimestamp(task.dueAt, data.timezone)}</p></a>)}</div>}
    </Card>
  );
}

function Updates({ data }: { data: CloserDashboardData }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 sm:p-6"><header className="flex items-start justify-between gap-4"><div><CardTitle>Recent activity</CardTitle><CardDescription className="mt-1">Changes in your assigned work.</CardDescription></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/activity">View all</a></header>{data.recentActivity.length === 0 ? <EmptyState>No recent activity.</EmptyState> : <ol className="mt-5 divide-y divide-border">{data.recentActivity.slice(0, 5).map((activity) => <li className="py-3 first:pt-0 last:pb-0" key={activity.id}><p className="text-sm font-semibold text-foreground">{activityLabel(activity.action)}</p><p className="mt-1 text-xs text-muted-foreground">{activity.actorNameSnapshot ?? "Orbit"} · {dashboardTimestamp(activity.occurredAt, data.timezone)}</p></li>)}</ol>}</Card>
      <Card className="p-5 sm:p-6"><header className="flex items-start justify-between gap-4"><div><CardTitle>Notifications</CardTitle><CardDescription className="mt-1">Latest reminders and updates.</CardDescription></div><a className="text-xs font-semibold text-primary hover:text-primary-hover" href="/notifications">View all</a></header>{data.notifications.length === 0 ? <EmptyState>No notifications right now.</EmptyState> : <ol className="mt-5 divide-y divide-border">{data.notifications.slice(0, 4).map((notification) => <li className="py-3 first:pt-0 last:pb-0" key={notification.id}><p className="text-sm font-semibold text-foreground">{notification.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.message}</p></li>)}</ol>}</Card>
    </div>
  );
}

function CalendarConnectionCard({ connection, timezone }: { connection: CalendarConnection; timezone: string }) {
  const state = calendarState(connection);
  return <Card className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Candidate calendars</p><CardTitle className="mt-2">Google Calendar</CardTitle><p className={`mt-4 text-sm font-semibold ${state.tone}`}>{state.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{state.description}</p>{connection.lastSyncedAt ? <p className="mt-3 text-xs text-muted-foreground">Last synced {dashboardTimestamp(connection.lastSyncedAt, timezone)}</p> : null}</Card>;
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
    calendarConnection: { connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" as const },
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Closer workspace</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Today’s schedule</h1><p className="mt-1.5 text-sm text-muted-foreground">Calls, preparation, and feedback assigned to you.</p></div><Button aria-label="Refresh dashboard" onClick={() => window.location.reload()} variant="secondary">Refresh</Button></header>
      {error ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground" role="status">{error}</p> : null}
      <section className="mt-5"><CloserPulse data={dashboard} /></section>
      <section aria-label="Primary calendar" className="mt-5"><CalendarWorkspace actor={actor} interviews={calendarInterviews ?? dashboard.todayMeetings} externalMeetings={dashboard.externalMeetings} embedded /></section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]"><NextMeetingBriefing meeting={dashboard.nextMeeting} /><ActionQueue data={dashboard} /></section>
      <section className="mt-5"><AssignedApplications applications={dashboard.assignedApplications} /></section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"><FeedbackQueue meetings={dashboard.needsFeedback} /><CalendarConnectionCard connection={dashboard.calendarConnection} timezone={dashboard.timezone} /></section>
      <section className="mt-5"><Updates data={dashboard} /></section>
    </div>
  );
}
