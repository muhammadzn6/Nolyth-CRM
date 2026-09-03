import type { Actor } from "../identity/session.service";
import { InterviewsService } from "../interviews/interviews.service";
import {
  GoogleCalendarService,
  type GoogleCalendarDatabase,
  type GoogleCalendarEventClient,
  type GoogleOAuthProvider,
} from "./google-calendar.service";

const closer: Actor = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER",
  isActive: true,
};
const admin: Actor = { ...closer, id: "10000000-0000-4000-8000-000000000009", role: "ADMIN" };
const companyId = "30000000-0000-4000-8000-000000000001";

const googleConfig = {
  clientId: "google-client-id",
  clientSecret: "google-client-secret",
  redirectUri: "http://localhost:3101/api/v1/calendar/google/callback",
  tokenEncryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};

const interview = {
  id: "20000000-0000-4000-8000-000000000001",
  leadId: "30000000-0000-4000-8000-000000000001",
  profileId: "40000000-0000-4000-8000-000000000001",
  closerId: closer.id,
  companyId,
  status: "SCHEDULED" as const,
  startsAt: new Date("2026-09-04T14:00:00.000Z"),
  endsAt: new Date("2026-09-04T14:30:00.000Z"),
  timezone: "America/New_York",
  candidateName: "Ada Lovelace",
  companyName: "Orbit Labs",
  jobTitle: "Principal Engineer",
  meetingLink: "https://meet.google.test/orbit",
  preparationNotes: "Review the system-design briefing.",
  googleEventId: null,
};

type Connection = {
  id: string;
  userId: string;
  companyId: string;
  provider: "GOOGLE";
  email: string;
  calendarId: string;
  calendarName: string;
  encryptedRefreshToken: string;
  scopes: string[];
  lastSyncedAt: Date | null;
  status: "CONNECTED" | "EXPIRED" | "SYNCING";
  createdAt: Date;
  updatedAt: Date;
};

function createPersistence() {
  const connections: Connection[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const activities: Array<Record<string, unknown>> = [];
  const database = {
    googleCalendarConnection: {
      findUnique: async ({ where }: { where: { userId_provider: { userId: string; provider: "GOOGLE" } } }) =>
        connections.find((connection) => connection.userId === where.userId_provider.userId) ?? null,
      findFirst: async ({ where }: { where: { companyId: string; provider: "GOOGLE" } }) => connections.find((connection) => connection.companyId === where.companyId && connection.provider === where.provider) ?? null,
      create: async ({ data }: { data: Omit<Connection, "id" | "createdAt" | "updatedAt"> }) => {
        const connection = { ...data, id: "connection-1", createdAt: new Date("2026-09-03T10:00:00.000Z"), updatedAt: new Date("2026-09-03T10:00:00.000Z") };
        connections.push(connection);
        return connection;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Connection> }) => {
        const existing = connections.find((connection) => connection.id === where.id)!;
        Object.assign(existing, data);
        return existing;
      },
      upsert: async ({ create, update }: { create: Omit<Connection, "id" | "createdAt" | "updatedAt">; update: Partial<Connection> }) => {
        const existing = connections.find((connection) => connection.userId === create.userId);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date("2026-09-03T10:00:01.000Z") });
          return existing;
        }
        const connection = {
          ...create,
          id: "connection-1",
          createdAt: new Date("2026-09-03T10:00:00.000Z"),
          updatedAt: new Date("2026-09-03T10:00:00.000Z"),
        };
        connections.push(connection);
        return connection;
      },
      delete: async () => undefined,
    },
    interviewRound: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { id: interview.id };
      },
    },
    activityEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        activities.push(data);
        return data;
      },
    },
  } as unknown as GoogleCalendarDatabase;
  return { database, updates, activities };
}

function createProvider(): GoogleOAuthProvider {
  return {
    authorizationUrl: () => "https://accounts.google.test/o/oauth2/v2/auth",
    exchangeCode: async () => ({
      email: "connected@gmail.test",
      refreshToken: "google-refresh-token",
      scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events"],
    }),
  };
}

function createClient(busy = false): GoogleCalendarEventClient {
  return {
    checkBusy: vi.fn().mockResolvedValue(busy),
    createEvent: vi.fn().mockResolvedValue({ id: "google-event-1" }),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    cancelEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function createService(client: GoogleCalendarEventClient, busy = false) {
  const persistence = createPersistence();
  return {
    ...persistence,
    client,
    service: new GoogleCalendarService(persistence.database, createProvider(), googleConfig, client),
  };
}

describe("GoogleCalendarService interview synchronization", () => {
  it("returns only busy state from the closer's Google calendar", async () => {
    const client = createClient(true);
    const { service } = createService(client);
    await service.complete(admin, "authorization-code", companyId);

    await expect(service.checkGoogleBusyFree(companyId, interview.startsAt, interview.endsAt)).resolves.toEqual({ busy: true });
    expect(client.checkBusy).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: "primary",
      startsAt: interview.startsAt,
      endsAt: interview.endsAt,
    }));
  });

  it("creates an Orbit-owned event then retries by updating the stored event", async () => {
    const client = createClient();
    const { service, updates } = createService(client);
    await service.complete(admin, "authorization-code", companyId);

    await expect(service.syncInterviewToGoogle(closer, interview)).resolves.toEqual({ externalEventId: "google-event-1" });
    await expect(service.syncInterviewToGoogle(closer, { ...interview, googleEventId: "google-event-1", startsAt: new Date("2026-09-04T15:00:00.000Z") })).resolves.toEqual({ externalEventId: "google-event-1" });

    expect(client.createEvent).toHaveBeenCalledTimes(1);
    expect(client.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "google-event-1",
      event: expect.objectContaining({ summary: "Ada Lovelace · Orbit Labs — Principal Engineer" }),
    }));
    expect(updates).toContainEqual(expect.objectContaining({ googleEventId: "google-event-1", googleSyncStatus: "SYNCED" }));
  });

  it("cancels the existing Orbit-owned Google event and records its sync state", async () => {
    const client = createClient();
    const { service, updates } = createService(client);
    await service.complete(admin, "authorization-code", companyId);

    await expect(service.syncInterviewToGoogle(closer, { ...interview, status: "CANCELLED", googleEventId: "google-event-1" })).resolves.toEqual({ externalEventId: "google-event-1" });

    expect(client.cancelEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: "google-event-1" }));
    expect(updates).toContainEqual(expect.objectContaining({ googleSyncStatus: "CANCELLED" }));
  });
});

describe("InterviewsService Google Calendar integration", () => {
  it("keeps Orbit create, reschedule, and cancel mutations when Google synchronization fails", async () => {
    const admin: Actor = { ...closer, id: "50000000-0000-4000-8000-000000000001", role: "ADMIN" };
    const lead = {
      id: interview.leadId,
      profileId: interview.profileId,
      currentOwnerId: admin.id,
      companyName: interview.companyName,
      jobTitle: interview.jobTitle,
      profile: { candidate: { firstName: "Ada", lastName: "Lovelace", preferredName: null } },
    };
    let stored: Record<string, unknown> | null = null;
    const database = {
      jobLead: {
        findUnique: async () => lead,
        updateMany: async () => ({ count: 1 }),
      },
      profileCloserEligibility: { findFirst: async () => ({ id: "eligible" }) },
      interviewRound: {
        findFirst: async () => null,
        findMany: async () => [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = {
            id: interview.id,
            ...data,
            status: "SCHEDULED",
            attendance: null,
            googleSyncStatus: null,
            version: 1,
            createdAt: new Date("2026-09-03T10:00:00.000Z"),
            updatedAt: new Date("2026-09-03T10:00:00.000Z"),
          };
          return stored;
        },
        findUnique: async () => stored,
        updateMany: async ({ where, data }: { where: { version: number }; data: Record<string, unknown> }) => {
          if (!stored || where.version !== stored.version) return { count: 0 };
          Object.assign(stored, data, { version: stored.version as number + 1 });
          return { count: 1 };
        },
      },
      activityEvent: {
        create: async () => undefined,
      },
    };
    const calendar = {
      isConnected: vi.fn().mockResolvedValue(true),
      isConnectedForProfile: vi.fn().mockResolvedValue(true),
      checkGoogleBusyFree: vi.fn().mockResolvedValue({ busy: false }),
      checkGoogleBusyFreeForProfile: vi.fn().mockResolvedValue({ busy: false }),
      syncInterviewToGoogle: vi.fn().mockRejectedValue(new Error("Google is unavailable")),
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new InterviewsService(database as never, authorization as never, () => new Date("2026-09-03T10:00:00.000Z"), calendar as never);

    const created = await service.create(admin, interview.leadId, {
      closerId: closer.id,
      roundType: "TECHNICAL",
      startsAt: "2026-09-04T14:00:00.000Z",
      endsAt: "2026-09-04T14:30:00.000Z",
      timezone: interview.timezone,
      originalDatetimeText: "September 4 at 10:00 AM",
      meetingLink: interview.meetingLink ?? undefined,
      preparationNotes: interview.preparationNotes ?? undefined,
    });
    const rescheduled = await service.reschedule(admin, created.id, {
      startsAt: "2026-09-04T15:00:00.000Z",
      endsAt: "2026-09-04T15:30:00.000Z",
      timezone: interview.timezone,
      originalDatetimeText: "September 4 at 11:00 AM",
      expectedVersion: created.version,
    });
    const cancelled = await service.cancel(admin, created.id, rescheduled.version);

    expect(cancelled.status).toBe("CANCELLED");
    expect(calendar.syncInterviewToGoogle).toHaveBeenCalledTimes(3);
  });
});
