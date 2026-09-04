import type { Actor } from "../identity/session.service";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors/app-error";
import {
  GoogleCalendarService,
  type GoogleCalendarDatabase,
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

type Connection = {
  id: string;
  userId: string;
  companyId: string;
  profileId?: string | null;
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

  const database = {
    googleCalendarConnection: {
      findUnique: async ({ where }: { where: { userId_provider: { userId: string; provider: "GOOGLE" } } }) =>
        connections.find(
          (connection) =>
            connection.userId === where.userId_provider.userId &&
            connection.provider === where.userId_provider.provider,
        ) ?? null,
      findFirst: async ({ where }: { where: { companyId?: string; profileId?: string; provider: "GOOGLE" } }) => connections.find((connection) => (where.companyId === undefined || connection.companyId === where.companyId) && (where.profileId === undefined || connection.profileId === where.profileId) && connection.provider === where.provider) ?? null,
      create: async ({ data }: { data: Omit<Connection, "id" | "createdAt" | "updatedAt"> }) => {
        const connection = { ...data, id: `connection-${connections.length + 1}`, createdAt: new Date("2026-09-03T10:00:00.000Z"), updatedAt: new Date("2026-09-03T10:00:00.000Z") };
        connections.push(connection);
        return connection;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Connection> }) => {
        const existing = connections.find((connection) => connection.id === where.id)!;
        Object.assign(existing, data, { updatedAt: new Date("2026-09-03T10:00:01.000Z") });
        return existing;
      },
      upsert: async ({ create, update }: { create: Omit<Connection, "id" | "createdAt" | "updatedAt">; update: Partial<Connection> }) => {
        const existing = connections.find(
          (connection) => connection.userId === create.userId && connection.provider === create.provider,
        );
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
      delete: async ({ where }: { where: { id: string } }) => {
        const index = connections.findIndex(
          (connection) => connection.id === where.id,
        );
        if (index >= 0) connections.splice(index, 1);
      },
    },
  } as unknown as GoogleCalendarDatabase;

  return { database, connections };
}

function createProvider(): GoogleOAuthProvider {
  return {
    authorizationUrl: ({ state }) => `https://accounts.google.test/o/oauth2/v2/auth?state=${state}`,
    exchangeCode: async () => ({
      email: "connected@gmail.test",
      refreshToken: "google-refresh-token",
      scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events"],
    }),
  };
}

function createService(config: typeof googleConfig | null = googleConfig) {
  const { database, connections } = createPersistence();
  return { service: new GoogleCalendarService(database, createProvider(), config), connections };
}

describe("GoogleCalendarService", () => {
  it("allows only an active admin to start Google OAuth", () => {
    const { service } = createService();

    expect(() => service.connect(closer, "state", companyId)).toThrow(AuthorizationError);
  });

  it("stores an encrypted refresh token and returns a redacted connection status", async () => {
    const { service, connections } = createService();

    await service.complete(admin, "authorization-code", companyId);

    expect(connections).toHaveLength(1);
    expect(connections[0]?.encryptedRefreshToken).not.toContain("google-refresh-token");
    expect(service.decryptRefreshToken(connections[0]!.encryptedRefreshToken)).toBe("google-refresh-token");
    await expect(service.status(closer, companyId)).resolves.toEqual({
      connected: true,
      email: "connected@gmail.test",
      calendarName: "Primary",
      lastSyncedAt: null,
      status: "CONNECTED",
    });
  });

  it("removes the stored token material when a closer disconnects", async () => {
    const { service, connections } = createService();
    await service.complete(admin, "authorization-code", companyId);

    await service.disconnect(admin, companyId);

    expect(connections).toHaveLength(0);
    await expect(service.status(closer, companyId)).resolves.toEqual({
      connected: false,
      email: null,
      calendarName: null,
      lastSyncedAt: null,
      status: "DISCONNECTED",
    });
  });

  it("fails closed with a clear configuration error when Google OAuth is disabled", () => {
    const { service } = createService(null);

    expect(() => service.connect(admin, "state", companyId)).toThrow(
      new ValidationError("Google Calendar OAuth is not configured"),
    );
  });

  it("stores a candidate profile calendar separately from employer data", async () => {
    const { service, connections } = createService();
    const profileId = "50000000-0000-4000-8000-000000000001";

    await service.completeForProfile(admin, "authorization-code", profileId);

    expect(connections[0]?.profileId).toBe(profileId);
    await expect(service.statusForProfile(closer, profileId)).resolves.toMatchObject({ connected: true });
  });

  it("allows one admin to connect separate Google accounts for separate candidate profiles", async () => {
    const { service, connections } = createService();

    await service.completeForProfile(admin, "authorization-code", "50000000-0000-4000-8000-000000000001");
    await service.completeForProfile(admin, "authorization-code", "50000000-0000-4000-8000-000000000002");

    expect(connections).toHaveLength(2);
    expect(connections.map((connection) => connection.profileId)).toEqual([
      "50000000-0000-4000-8000-000000000001",
      "50000000-0000-4000-8000-000000000002",
    ]);
  });

  it("rejects a profile calendar callback for a missing profile", async () => {
    const { service } = createService();
    (service as unknown as { database: GoogleCalendarDatabase }).database.profile = {
      findUnique: async () => null,
    };

    await expect(service.completeForProfile(admin, "authorization-code", "50000000-0000-4000-8000-000000000099")).rejects.toEqual(
      new NotFoundError("The candidate profile was not found"),
    );
  });
});
