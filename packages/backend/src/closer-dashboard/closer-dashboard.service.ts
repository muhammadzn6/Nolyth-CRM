import type {
  ActivityEventSummary,
  CalendarConnection,
  CloserDashboardData,
  CloserDashboardMeeting,
  CloserDashboardExternalMeeting,
  CloserDashboardApplication,
  InterviewSummary,
  NotificationSummary,
  TaskSummary,
} from "@orbit/contracts";

import { AuthorizationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";
import type { LeadsDatabase } from "../leads/leads.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { GoogleCalendarService } from "../calendar/google-calendar.service";

const MEETING_LIMIT = 5;
const TASK_LIMIT = 5;
const FEEDBACK_AND_CONFLICT_LIMIT = 5;
const ACTIVITY_AND_NOTIFICATION_LIMIT = 10;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function interview(row: Record<string, unknown>): InterviewSummary {
  return {
    id: String(row.id),
    leadId: String(row.leadId),
    roundNumber: Number(row.roundNumber),
    roundType: row.roundType as InterviewSummary["roundType"],
    status: row.status as InterviewSummary["status"],
    closerId: String(row.closerId),
    creatorId: String(row.creatorId),
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    timezone: String(row.timezone),
    originalDatetimeText: String(row.originalDatetimeText),
    interviewer: (row.interviewer as string | null) ?? null,
    meetingLink: (row.meetingLink as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    preparationNotes: (row.preparationNotes as string | null) ?? null,
    closerNotes: (row.closerNotes as string | null) ?? null,
    officialFeedback: (row.officialFeedback as string | null) ?? null,
    officialResult: (row.officialResult as string | null) ?? null,
    attendance: (row.attendance as InterviewSummary["attendance"]) ?? null,
    googleSyncStatus: (row.googleSyncStatus as InterviewSummary["googleSyncStatus"]) ?? null,
    version: Number(row.version),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function task(row: Record<string, unknown>): TaskSummary {
  return {
    id: String(row.id),
    profileId: String(row.profileId),
    leadId: (row.leadId as string | null) ?? null,
    assigneeId: String(row.assigneeId),
    creatorId: String(row.creatorId),
    type: row.type as TaskSummary["type"],
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    priority: row.priority as TaskSummary["priority"],
    status: row.status as TaskSummary["status"],
    dueAt: iso(row.dueAt),
    completedAt: row.completedAt ? iso(row.completedAt) : null,
    completedNotes: (row.completedNotes as string | null) ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    version: Number(row.version),
  };
}

function notification(row: Record<string, unknown>): NotificationSummary {
  return {
    id: String(row.id),
    recipientId: String(row.recipientId),
    type: String(row.type),
    title: String(row.title),
    message: String(row.message),
    relatedEntityType: (row.relatedEntityType as string | null) ?? null,
    relatedEntityId: (row.relatedEntityId as string | null) ?? null,
    createdAt: iso(row.createdAt),
    readAt: row.readAt ? iso(row.readAt) : null,
  };
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedDateParts(value: Date, timezone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function instantForZonedDate(parts: ZonedDateParts, timezone: string) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let instant = target;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const resolved = zonedDateParts(new Date(instant), timezone);
    instant += target - Date.UTC(
      resolved.year,
      resolved.month - 1,
      resolved.day,
      resolved.hour,
      resolved.minute,
      resolved.second,
    );
  }

  return new Date(instant);
}

export function zonedDayBounds(value: Date, timezone: string) {
  const day = zonedDateParts(value, timezone);
  const nextDay = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));

  return {
    start: instantForZonedDate({ ...day, hour: 0, minute: 0, second: 0 }, timezone),
    end: instantForZonedDate({
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    }, timezone),
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function meetingWithContext(row: Record<string, unknown>): CloserDashboardMeeting {
  const lead = record(row.lead);
  const profile = record(lead.profile);
  const candidate = record(profile.candidate);
  const preferredName = candidate.preferredName;
  const candidateName = typeof preferredName === "string" && preferredName.trim()
    ? preferredName
    : [candidate.firstName, candidate.lastName].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ") || "Candidate";

  return {
    ...interview(row),
    candidateName,
    profileName: typeof profile.name === "string" && profile.name.trim() ? profile.name : "Candidate profile",
    jobTitle: typeof lead.jobTitle === "string" && lead.jobTitle.trim() ? lead.jobTitle : "Job opportunity",
    companyName: typeof lead.companyName === "string" && lead.companyName.trim() ? lead.companyName : "Company",
  };
}

function applicationWithContext(row: Record<string, unknown>): CloserDashboardApplication {
  const profile = record(row.profile);
  const candidate = record(profile.candidate);
  const preferredName = candidate.preferredName;
  const candidateName = typeof preferredName === "string" && preferredName.trim()
    ? preferredName
    : [candidate.firstName, candidate.lastName].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ") || "Candidate";

  return {
    id: String(row.id),
    profileId: String(row.profileId),
    candidateName,
    profileName: typeof profile.name === "string" && profile.name.trim() ? profile.name : "Candidate profile",
    jobTitle: typeof row.jobTitle === "string" && row.jobTitle.trim() ? row.jobTitle : "Job opportunity",
    companyName: typeof row.companyName === "string" && row.companyName.trim() ? row.companyName : "Company",
    status: String(row.status),
    nextInterviewAt: row.nextInterviewAt instanceof Date ? row.nextInterviewAt.toISOString() : typeof row.nextInterviewAt === "string" ? row.nextInterviewAt : null,
  };
}

function externalMeeting(event: { id: string; summary: string; description?: string; location?: string | null; start: { dateTime: string; timeZone?: string }; end: { dateTime: string; timeZone?: string } }, timezone: string): CloserDashboardExternalMeeting {
  const location = event.location ?? null;
  return {
    id: event.id,
    title: event.summary,
    startsAt: new Date(event.start.dateTime).toISOString(),
    endsAt: new Date(event.end.dateTime).toISOString(),
    timezone: event.start.timeZone ?? timezone,
    location,
    meetingLink: location?.startsWith("http") ? location : null,
    description: event.description ?? null,
  };
}

export class CloserDashboardService {
  constructor(
    private readonly database: LeadsDatabase,
    private readonly notificationsService: NotificationsService,
    private readonly now = () => new Date(),
    private readonly googleCalendar?: GoogleCalendarService,
  ) {}

  async get(actor: Actor): Promise<CloserDashboardData> {
    if (!actor.isActive || actor.role !== "CLOSER") {
      throw new AuthorizationError();
    }

    const now = this.now();
    const closer = await this.database.user.findUnique({
      where: { id: actor.id },
      select: { timezone: true },
    });
    const timezone = typeof closer?.timezone === "string" ? closer.timezone : "UTC";
    // The dashboard calendar is anchored to Pakistan time for every role.
    // Keep operational day counts and external-event windows aligned with it;
    // `timezone` remains the closer's preference for activity timestamps.
    const calendarTimezone = "Asia/Karachi";
    const { start: startOfToday, end: endOfToday } = zonedDayBounds(now, calendarTimezone);
    const assignedLeads = await this.database.jobLead.findMany({
      where: { responsibleCloserId: actor.id, status: { notIn: ["CLOSED", "STARTED"] } },
      select: {
        id: true,
        profileId: true,
        jobTitle: true,
        companyName: true,
        companyId: true,
        status: true,
        interviews: {
          where: { status: "SCHEDULED", startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          take: 1,
          select: { startsAt: true },
        },
        profile: { select: { name: true, candidate: { select: { firstName: true, lastName: true, preferredName: true } } } },
      },
    });
    const profileIds = [...new Set(assignedLeads.map((row) => String(row.profileId)))];
    console.info("[Orbit backend] closer dashboard request", { actorId: actor.id, timezone, calendarTimezone, now: now.toISOString(), startOfToday: startOfToday.toISOString(), endOfToday: endOfToday.toISOString() });
    const externalEvents = this.googleCalendar
        ? Promise.all(profileIds.map((profileId) => this.googleCalendar!.listUpcomingEventsForProfile(actor, profileId, startOfToday, endOfToday)))
        .then((groups) => groups.flat())
        .then((events) => {
          console.info("[Orbit backend] Google Calendar events loaded", { actorId: actor.id, profileIds, count: events.length });
          return events.map((event) => externalMeeting(event, timezone));
        })
      .catch((error: unknown) => {
        console.error("[Orbit backend] Google Calendar events failed", { actorId: actor.id, profileIds, error: error instanceof Error ? error.message : String(error) });
        return [];
      })
      : Promise.resolve([]);
    const calendarStatuses: Promise<CalendarConnection[]> = this.googleCalendar
      ? Promise.all(profileIds.map((profileId) => this.googleCalendar!.statusForProfile(actor, profileId)))
      : Promise.resolve([] as CalendarConnection[]);
    const [nextMeeting, todayMeetings, needsFeedback, openTasks, conflicts, notifications, recentActivity, statuses, externalMeetings] = await Promise.all([
      this.database.interviewRound.findFirst({
        where: { closerId: actor.id, status: "SCHEDULED", startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        include: {
          lead: {
            select: {
              jobTitle: true,
              companyName: true,
              profile: {
                select: {
                  name: true,
                  candidate: { select: { firstName: true, lastName: true, preferredName: true } },
                },
              },
            },
          },
        },
      }),
      this.database.interviewRound.findMany({
        where: { closerId: actor.id, status: "SCHEDULED", startsAt: { gte: startOfToday, lt: endOfToday } },
        orderBy: { startsAt: "asc" },
        take: MEETING_LIMIT,
      }),
      this.database.interviewRound.findMany({
        where: { closerId: actor.id, status: "WAITING_FEEDBACK" },
        orderBy: { endsAt: "desc" },
        take: FEEDBACK_AND_CONFLICT_LIMIT,
      }),
      this.database.task.findMany({
        where: { assigneeId: actor.id, status: "OPEN" },
        orderBy: { dueAt: "asc" },
        take: TASK_LIMIT,
      }),
      this.database.interviewRound.findMany({
        where: { closerId: actor.id, status: "RESCHEDULE_REQUIRED" },
        orderBy: { startsAt: "asc" },
        take: FEEDBACK_AND_CONFLICT_LIMIT,
      }),
      this.database.notification.findMany({
        where: { recipientId: actor.id },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_AND_NOTIFICATION_LIMIT,
      }),
      this.notificationsService.activity(actor, { limit: ACTIVITY_AND_NOTIFICATION_LIMIT }),
      calendarStatuses,
      externalEvents,
    ]);
    const connectedStatuses = statuses.filter((value: CalendarConnection) => value.connected);
    const calendarConnection = connectedStatuses.length > 0
      ? { connected: true, email: connectedStatuses.length === 1 ? connectedStatuses[0].email : "Candidate calendars", calendarName: `${connectedStatuses.length} connected`, lastSyncedAt: connectedStatuses[0].lastSyncedAt, status: "CONNECTED" as const }
      : { connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" as const };

    console.info("[Orbit backend] closer dashboard result", { actorId: actor.id, orbitMeetings: todayMeetings.length, externalMeetings: externalMeetings.length, calendarStatus: calendarConnection.status });

    return {
      timezone,
      assignedApplications: assignedLeads.map((lead) => applicationWithContext({ ...lead, nextInterviewAt: (lead.interviews as Array<{ startsAt: Date }> | undefined)?.[0]?.startsAt ?? null })),
      nextMeeting: nextMeeting ? meetingWithContext(nextMeeting) : null,
      todayMeetings: todayMeetings.map(interview),
      needsFeedback: needsFeedback.map(interview),
      openTasks: openTasks.map(task),
      conflicts: conflicts.map(interview),
      notifications: notifications.map(notification),
      recentActivity: recentActivity as ActivityEventSummary[],
      calendarConnection,
      externalMeetings,
    };
  }
}
