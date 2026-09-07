import { describe, expect, it, vi } from "vitest";

import type { ActivityEventSummary } from "@orbit/contracts";

import { AuthorizationError } from "../errors/app-error";

import { CloserDashboardService } from "./closer-dashboard.service";

const NOW = new Date("2026-09-03T12:00:00.000Z");

const closer = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
};

const otherCloserId = "10000000-0000-4000-8000-000000000002";

function interview(overrides: Record<string, unknown> = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    leadId: "30000000-0000-4000-8000-000000000001",
    roundNumber: 1,
    roundType: "TECHNICAL",
    status: "SCHEDULED",
    closerId: closer.id,
    creatorId: "10000000-0000-4000-8000-000000000003",
    startsAt: new Date("2026-09-03T14:00:00.000Z"),
    endsAt: new Date("2026-09-03T15:00:00.000Z"),
    timezone: "UTC",
    originalDatetimeText: "September 3, 14:00 UTC",
    interviewer: null,
    meetingLink: null,
    location: null,
    preparationNotes: null,
    closerNotes: null,
    officialFeedback: null,
    officialResult: null,
    attendance: null,
    googleSyncStatus: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function nextMeetingContext(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      jobTitle: "Staff Platform Engineer",
      companyName: "Northstar Labs",
      profile: {
        name: "Platform Engineering",
        candidate: {
          firstName: "Ada",
          lastName: "Lovelace",
          preferredName: null,
        },
      },
    },
    ...overrides,
  };
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    profileId: "50000000-0000-4000-8000-000000000001",
    leadId: null,
    assigneeId: closer.id,
    creatorId: "10000000-0000-4000-8000-000000000003",
    type: "PREPARE_INTERVIEW",
    title: "Prepare candidate briefing",
    description: null,
    priority: "HIGH",
    status: "OPEN",
    dueAt: new Date("2026-09-03T13:00:00.000Z"),
    completedAt: null,
    completedNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    recipientId: closer.id,
    type: "IN_APP",
    title: "Interview scheduled",
    message: "A new interview has been scheduled",
    relatedEntityType: "interview_round",
    relatedEntityId: "20000000-0000-4000-8000-000000000001",
    createdAt: NOW,
    readAt: null,
    ...overrides,
  };
}

function createPersistence({
  interviews = [] as Array<Record<string, unknown>>,
  tasks = [] as Array<Record<string, unknown>>,
  notifications = [] as Array<Record<string, unknown>>,
  companyIds = ["30000000-0000-4000-8000-000000000001"],
  timezone = "UTC",
}: {
  interviews?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  companyIds?: string[];
  timezone?: string;
} = {}) {
  const interviewRound = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const status = where.status as string | undefined;
      const startsAt = where.startsAt as { gte?: Date } | undefined;
      return interviews
        .filter((item) => item.closerId === where.closerId && (!status || item.status === status) && (!startsAt?.gte || (item.startsAt as Date) >= startsAt.gte))
        .sort((left, right) => Number(left.startsAt) - Number(right.startsAt))[0] ?? null;
    }),
    findMany: vi.fn(async ({ where, orderBy, take }: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; take?: number }) => {
      const status = where.status as string | { in: string[] } | undefined;
      const startsAt = where.startsAt as { gte?: Date; lt?: Date } | undefined;
      const filtered = interviews.filter((item) =>
        item.closerId === where.closerId
        && (!status || (typeof status === "string" ? item.status === status : status.in.includes(String(item.status))))
        && (!startsAt?.gte || (item.startsAt as Date) >= startsAt.gte)
        && (!startsAt?.lt || (item.startsAt as Date) < startsAt.lt),
      );
      const sortField = orderBy ? Object.keys(orderBy)[0] : undefined;
      const sorted = sortField
        ? [...filtered].sort((left, right) => Number(left[sortField]) - Number(right[sortField]))
        : filtered;
      return take === undefined ? sorted : sorted.slice(0, take);
    }),
  };
  const taskStore = {
    findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
      const filtered = tasks.filter((item) => item.assigneeId === where.assigneeId && item.status === where.status)
        .sort((left, right) => Number(left.dueAt) - Number(right.dueAt));
      return take === undefined ? filtered : filtered.slice(0, take);
    }),
  };
  const notificationStore = {
    findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
      const filtered = notifications.filter((item) => item.recipientId === where.recipientId)
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
      return take === undefined ? filtered : filtered.slice(0, take);
    }),
  };

  const userStore = {
    findUnique: vi.fn(async () => ({ timezone })),
  };

  return {
    interviewRound,
    task: taskStore,
    notification: notificationStore,
    user: userStore,
      jobLead: {
      findMany: vi.fn().mockResolvedValue(companyIds.map((companyId, index) => ({
        id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        profileId: "50000000-0000-4000-8000-000000000001",
        companyId,
        jobTitle: "Backend Engineer",
        companyName: "Northstar Labs",
        status: "INTERVIEWING",
        interviews: interviews.filter((item) => item.leadId === `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` && item.status === "SCHEDULED" && (item.startsAt as Date) >= NOW).sort((left, right) => Number(left.startsAt) - Number(right.startsAt)).slice(0, 1),
        profile: { name: "Backend Engineering", candidate: { firstName: "Eyong", lastName: "Candidate", preferredName: null } },
      }))),
    },
  };
}

function createService(options: {
  interviews?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  activity?: ActivityEventSummary[];
  timezone?: string;
  companyIds?: string[];
  googleCalendar?: { statusForProfile: ReturnType<typeof vi.fn>; listUpcomingEventsForProfile: ReturnType<typeof vi.fn> };
} = {}) {
  const database = createPersistence(options);
  const notifications = {
    activity: vi.fn().mockResolvedValue(options.activity ?? []),
  };

  return {
    database,
    notifications,
    service: new CloserDashboardService(database as never, notifications as never, () => NOW, options.googleCalendar as never),
  };
}

describe("CloserDashboardService", () => {
  it.each([
    ["an active BD", { ...closer, role: "BD" as const }],
    ["an inactive closer", { ...closer, isActive: false }],
  ])("rejects %s before reading dashboard records", async (_label, actor) => {
    const { service, database, notifications } = createService();

    await expect(service.get(actor)).rejects.toEqual(new AuthorizationError());
    expect(database.interviewRound.findFirst).not.toHaveBeenCalled();
    expect(notifications.activity).not.toHaveBeenCalled();
  });

  it("returns only the active closer's meetings, tasks, and notifications", async () => {
    const { service } = createService({
      interviews: [
        interview(),
        interview({ id: "20000000-0000-4000-8000-000000000002", closerId: otherCloserId, startsAt: new Date("2026-09-03T13:00:00.000Z") }),
        interview({ id: "20000000-0000-4000-8000-000000000003", status: "RESCHEDULE_REQUIRED", startsAt: new Date("2026-09-04T13:00:00.000Z") }),
      ],
      tasks: [
        task(),
        task({ id: "40000000-0000-4000-8000-000000000002", assigneeId: otherCloserId, title: "Other closer task" }),
      ],
      notifications: [
        notification(),
        notification({ id: "60000000-0000-4000-8000-000000000002", recipientId: otherCloserId, title: "Other closer notification" }),
      ],
    });

    const dashboard = await service.get(closer);

    expect(dashboard.assignedApplications).toHaveLength(1);
    expect(dashboard.assignedApplications[0]?.nextInterviewAt).toBe("2026-09-03T13:00:00.000Z");
    expect(dashboard.nextMeeting?.id).toBe("20000000-0000-4000-8000-000000000001");
    expect(dashboard.todayMeetings.map((item) => item.id)).toEqual(["20000000-0000-4000-8000-000000000001"]);
    expect(dashboard.conflicts.map((item) => item.id)).toEqual(["20000000-0000-4000-8000-000000000003"]);
    expect(dashboard.openTasks.map((item) => item.id)).toEqual(["40000000-0000-4000-8000-000000000001"]);
    expect(dashboard.notifications.map((item) => item.id)).toEqual(["60000000-0000-4000-8000-000000000001"]);
  });

  it("groups the agenda using the closer timezone instead of UTC", async () => {
    const { service } = createService({
      timezone: "Asia/Karachi",
      interviews: [
        interview({ id: "20000000-0000-4000-8000-000000000010", startsAt: new Date("2026-09-03T14:00:00.000Z") }),
        interview({ id: "20000000-0000-4000-8000-000000000011", startsAt: new Date("2026-09-03T23:30:00.000Z") }),
      ],
    });

    const dashboard = await service.get(closer);

    expect(dashboard.todayMeetings.map((item) => item.id)).toEqual(["20000000-0000-4000-8000-000000000010"]);
  });

  it("keeps started interviews in the today count for the closer's local day", async () => {
    const { service } = createService({
      timezone: "Asia/Karachi",
      interviews: [interview({ startsAt: new Date("2026-09-03T06:00:00.000Z") })],
    });

    const dashboard = await service.get(closer);

    expect(dashboard.todayMeetings.map((item) => item.id)).toEqual(["20000000-0000-4000-8000-000000000001"]);
  });

  it("returns joined candidate, profile, and job context for the next meeting", async () => {
    const { service, database } = createService({
      interviews: [interview(nextMeetingContext())],
    });

    await expect(service.get(closer)).resolves.toMatchObject({
      nextMeeting: {
        candidateName: "Ada Lovelace",
        profileName: "Platform Engineering",
        jobTitle: "Staff Platform Engineer",
        companyName: "Northstar Labs",
      },
    });
    expect(database.interviewRound.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ lead: expect.anything() }),
    }));
  });

  it("returns an empty closer workspace when no records are assigned", async () => {
    const { service, notifications } = createService({ companyIds: [] });

    await expect(service.get(closer)).resolves.toEqual({
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
      calendarConnection: {
        connected: false,
        email: null,
        calendarName: null,
        lastSyncedAt: null,
        status: "DISCONNECTED",
      },
    });
    expect(notifications.activity).toHaveBeenCalledWith(closer, { limit: 10 });
  });

  it("includes only the closer's interviews waiting for feedback", async () => {
    const { service } = createService({
      interviews: [
        interview({ id: "20000000-0000-4000-8000-000000000004", status: "WAITING_FEEDBACK" }),
        interview({ id: "20000000-0000-4000-8000-000000000005", closerId: otherCloserId, status: "WAITING_FEEDBACK" }),
      ],
    });

    const dashboard = await service.get(closer);

    expect(dashboard.needsFeedback.map((item) => item.id)).toEqual(["20000000-0000-4000-8000-000000000004"]);
  });

  it("reports the calendar as disconnected before a closer connects Google Calendar", async () => {
    const { service } = createService();

    const dashboard = await service.get(closer);

    expect(dashboard.calendarConnection).toEqual({
      connected: false,
      email: null,
      calendarName: null,
      lastSyncedAt: null,
      status: "DISCONNECTED",
    });
  });

  it("includes external Google events and the real connection status", async () => {
    const googleCalendar = {
      statusForProfile: vi.fn().mockResolvedValue({ connected: true, email: "eyong@gmail.com", calendarName: "Primary", lastSyncedAt: null, status: "CONNECTED" }),
      listUpcomingEventsForProfile: vi.fn().mockResolvedValue([{ id: "google-event-1", summary: "Customer interview", description: "External meeting", location: "https://meet.google.com/demo", start: { dateTime: "2026-09-03T15:00:00.000Z", timeZone: "UTC" }, end: { dateTime: "2026-09-03T16:00:00.000Z", timeZone: "UTC" } }]),
    };

    const { service } = createService({ googleCalendar });
    const dashboard = await service.get(closer);

    expect(dashboard.calendarConnection).toMatchObject({ connected: true, email: "eyong@gmail.com" });
    expect(dashboard.externalMeetings).toEqual([expect.objectContaining({ id: "google-event-1", title: "Customer interview", meetingLink: "https://meet.google.com/demo" })]);
  });
});
