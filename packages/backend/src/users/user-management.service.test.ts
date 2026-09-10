import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
} from "../errors/app-error";
import { verifyPassword } from "../identity/password";
import { SessionService } from "../identity/session.service";
import { InvitationService } from "./invitation.service";
import { UserManagementService } from "./user-management.service";

type User = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  role: "ADMIN" | "BD" | "CLOSER";
  isActive: boolean;
  timezone: string;
  lastLoginAt: Date | null;
  createdByUserId: string | null;
};

type Session = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type AuthToken = {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: "PASSWORD_RESET" | "USER_INVITATION";
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type ActivityEvent = {
  action: string;
  actorId: string | null;
  actorNameSnapshot: string | null;
  actorRoleSnapshot: "ADMIN" | "BD" | "CLOSER" | null;
  entityId: string;
  entityType: string;
  metadata: Record<string, unknown> | null;
  newSnapshot: Record<string, unknown> | null;
  requestId: string | null;
};

type StoredEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  idempotencyKey: string;
  payload: unknown;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
  attempts: number;
  claimedAt: Date | null;
  lastError: string | null;
  processedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
};

const SESSION_SECRET = "task-two-session-secret";
const FIXED_NOW = new Date("2026-09-02T12:00:00.000Z");
const INVITATION_TOKEN = "opaque-invitation-token";

function hashInvitationToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function createPersistence(users: User[]) {
  const sessions: Session[] = [];
  const authTokens: AuthToken[] = [];
  const activityEvents: ActivityEvent[] = [];
  const outboxEvents: StoredEvent[] = [];
  const transactionState = { calls: 0 };

  const tx = {
    user: {
      findMany: async () => [...users],
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      create: async ({
        data,
      }: {
        data: Omit<User, "id" | "lastLoginAt" | "passwordChangedAt"> & {
          lastLoginAt?: Date | null;
          passwordChangedAt?: Date | null;
        };
      }) => {
        const created: User = {
          id: `10000000-0000-4000-8000-${String(users.length + 1).padStart(12, "0")}`,
          lastLoginAt: null,
          passwordChangedAt: null,
          ...data,
        };
        users.push(created);
        return created;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<User>;
      }) => {
        const user = users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);
        return user;
      },
    },
    authToken: {
      create: async ({
        data,
      }: {
        data: Omit<AuthToken, "id" | "consumedAt" | "createdAt"> & {
          consumedAt?: Date | null;
          createdAt?: Date;
        };
      }) => {
        const created: AuthToken = {
          id: `20000000-0000-4000-8000-${String(authTokens.length + 1).padStart(12, "0")}`,
          consumedAt: null,
          createdAt: FIXED_NOW,
          ...data,
        };
        authTokens.push(created);
        return created;
      },
      findUnique: async ({
        where,
      }: {
        where: { tokenHash: string };
      }) => authTokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<AuthToken>;
      }) => {
        const authToken = authTokens.find((candidate) => candidate.id === where.id);

        if (!authToken) {
          throw new Error("Auth token not found");
        }

        Object.assign(authToken, data);
        return authToken;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<AuthToken>;
      }) => {
        let count = 0;

        for (const authToken of authTokens) {
          if (authToken.tokenHash !== where.tokenHash) continue;
          if (authToken.purpose !== where.purpose) continue;
          if (authToken.consumedAt !== where.consumedAt) continue;
          const expiresAt = where.expiresAt as { gt: Date };
          if (authToken.expiresAt <= expiresAt.gt) continue;

          Object.assign(authToken, data);
          count += 1;
        }

        return { count };
      },
    },
    userSession: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string; revokedAt?: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;

        for (const session of sessions) {
          if (session.userId !== where.userId) continue;
          if (where.revokedAt === null && session.revokedAt !== null) continue;
          Object.assign(session, data);
          count += 1;
        }

        return { count };
      },
      create: async ({
        data,
      }: {
        data: Omit<Session, "id" | "revokedAt">;
      }) => {
        const created: Session = {
          id: `session-${sessions.length + 1}`,
          revokedAt: null,
          ...data,
        };
        sessions.push(created);
        return created;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { sessionTokenHash: string };
        include: { user: true };
      }) => {
        const session = sessions.find((candidate) => candidate.sessionTokenHash === where.sessionTokenHash);

        if (!session) {
          return null;
        }

        return {
          ...session,
          user: include.user ? users.find((user) => user.id === session.userId) ?? null : null,
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { revokedAt: Date };
      }) => {
        const session = sessions.find((candidate) => candidate.id === where.id);

        if (!session) {
          throw new Error("Session not found");
        }

        Object.assign(session, data);
        return session;
      },
    },
    activityEvent: {
      create: async ({ data }: { data: ActivityEvent }) => {
        activityEvents.push(data);
        return data;
      },
    },
    outboxEvent: {
      upsert: async ({
        where,
        create,
      }: {
        where: { idempotencyKey: string };
        create: Omit<StoredEvent, "id" | "attempts" | "claimedAt" | "lastError" | "processedAt" | "publishedAt" | "createdAt" | "status">;
        update: Record<string, never>;
      }) => {
        const existing = outboxEvents.find((event) => event.idempotencyKey === where.idempotencyKey);

        if (existing) {
          return existing;
        }

        const created: StoredEvent = {
          id: `30000000-0000-4000-8000-${String(outboxEvents.length + 1).padStart(12, "0")}`,
          attempts: 0,
          claimedAt: null,
          createdAt: FIXED_NOW,
          lastError: null,
          processedAt: null,
          publishedAt: null,
          status: "PENDING",
          ...create,
        };
        outboxEvents.push(created);
        return created;
      },
    },
  };

  return {
    users,
    sessions,
    authTokens,
    activityEvents,
    outboxEvents,
    transactionCalls: transactionState,
    user: tx.user,
    authToken: tx.authToken,
    userSession: tx.userSession,
    activityEvent: tx.activityEvent,
    outboxEvent: tx.outboxEvent,
    profileBdAssignment: {
      findFirst: async () => null,
    },
    profileCloserEligibility: {
      findFirst: async () => null,
    },
    $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => {
      transactionState.calls += 1;
      return work(tx);
    },
  };
}

function createActor(overrides: Partial<User> = {}) {
  const base: User = {
    id: "10000000-0000-4000-8000-000000000001",
    displayName: "Admin User",
    email: "admin@orbit.test",
    passwordHash: null,
    passwordChangedAt: null,
    role: "ADMIN",
    isActive: true,
    timezone: "UTC",
    lastLoginAt: null,
    createdByUserId: null,
  };

  return { ...base, ...overrides };
}

describe("admin user-management boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows BD to list users but requires ADMIN for mutations and revoking sessions", async () => {
    const admin = createActor();
    const agent = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      role: "BD",
      email: "bd@orbit.test",
    });
    const persistence = createPersistence([{ ...admin }, { ...agent }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    await expect(service.list(agent)).resolves.toHaveLength(2);
    await expect(
      service.create(agent, {
        displayName: "New User",
        email: "new.user@orbit.test",
        role: "BD",
        timezone: "UTC",
      }),
    ).rejects.toEqual(new AuthorizationError());
    await expect(
      service.update(agent, admin.id, { displayName: "Renamed User" }),
    ).rejects.toEqual(new AuthorizationError());
    await expect(service.revokeSessions(agent, admin.id)).rejects.toEqual(new AuthorizationError());
  });

  it("creates an invited user with a null password, hashed expiring invitation, audit, and outbox records", async () => {
    const admin = createActor();
    const persistence = createPersistence([{ ...admin }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    const created = await service.create(admin, {
      displayName: "  New User  ",
      email: "  New.User@Orbit.test  ",
      role: "CLOSER",
      timezone: "America/New_York",
    });

    expect(created.invitationToken).toBe(INVITATION_TOKEN);
    expect(created.user).toEqual({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "New User",
      email: "new.user@orbit.test",
      role: "CLOSER",
      isActive: true,
      timezone: "America/New_York",
      lastLoginAt: null,
    });
    expect(persistence.users[1]?.passwordHash).toBeNull();
    expect(persistence.users[1]?.createdByUserId).toBe(admin.id);
    expect(persistence.authTokens).toEqual([
      expect.objectContaining({
        userId: created.user.id,
        purpose: "USER_INVITATION",
        tokenHash: hashInvitationToken(INVITATION_TOKEN),
        expiresAt: new Date("2026-09-09T12:00:00.000Z"),
        consumedAt: null,
      }),
    ]);
    expect(persistence.authTokens[0]?.tokenHash).not.toBe(INVITATION_TOKEN);
    expect(persistence.activityEvents).toEqual([
      expect.objectContaining({
        action: "user.created",
        actorId: admin.id,
        actorNameSnapshot: admin.displayName,
        actorRoleSnapshot: admin.role,
        entityId: created.user.id,
        entityType: "user",
      }),
    ]);
    expect(persistence.outboxEvents).toEqual([
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: created.user.id,
        eventType: "email.send_requested",
        idempotencyKey: `user-invitation:${created.user.id}`,
        payload: {
          recipientUserId: created.user.id,
          to: "new.user@orbit.test",
          subject: "Your Orbit invitation",
          text: "Open Orbit to accept your invitation.",
        },
      }),
    ]);
    expect(persistence.transactionCalls.calls).toBe(1);
  });

  it("rejects duplicate emails with a conflict error", async () => {
    const admin = createActor();
    const persistence = createPersistence([
      { ...admin },
      createActor({
        id: "10000000-0000-4000-8000-000000000002",
        email: "existing@orbit.test",
        displayName: "Existing User",
        role: "BD",
      }),
    ]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    await expect(
      service.create(admin, {
        displayName: "Another User",
        email: " Existing@Orbit.test ",
        role: "BD",
        timezone: "UTC",
      }),
    ).rejects.toEqual(
      new ConflictError("A user with this email already exists"),
    );
  });

  it("translates unique email races during creation to a conflict error", async () => {
    const admin = createActor();
    const persistence = createPersistence([{ ...admin }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);
    vi.spyOn(persistence.user, "create").mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["email"] },
      }),
    );

    await expect(
      service.create(admin, {
        displayName: "Race Winner",
        email: "race@orbit.test",
        role: "BD",
        timezone: "UTC",
      }),
    ).rejects.toEqual(new ConflictError("A user with this email already exists"));
  });

  it("validates runtime role input against the shared contracts", async () => {
    const admin = createActor();
    const persistence = createPersistence([{ ...admin }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    await expect(
      service.create(admin, {
        displayName: "Role Drift",
        email: "role-drift@orbit.test",
        role: "OWNER",
        timezone: "UTC",
      } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("revokes active sessions on deactivation and reactivation, and blocks self-deactivation", async () => {
    const admin = createActor();
    const target = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Managed User",
      email: "managed@orbit.test",
      role: "BD",
    });
    const persistence = createPersistence([{ ...admin }, { ...target }]);
    persistence.sessions.push(
      {
        id: "session-1",
        userId: target.id,
        sessionTokenHash: "first",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        revokedAt: null,
      },
      {
        id: "session-2",
        userId: target.id,
        sessionTokenHash: "second",
        expiresAt: new Date("2026-10-02T00:00:00.000Z"),
        revokedAt: null,
      },
    );
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    const deactivated = await service.update(admin, target.id, { isActive: false });

    expect(deactivated.isActive).toBe(false);
    expect(persistence.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect(persistence.activityEvents).toContainEqual(
      expect.objectContaining({
        action: "user.deactivated",
        actorId: admin.id,
        actorNameSnapshot: admin.displayName,
        actorRoleSnapshot: admin.role,
        entityId: target.id,
        entityType: "user",
        newSnapshot: expect.objectContaining({ isActive: false }),
      }),
    );

    persistence.sessions.push({
      id: "session-3",
      userId: target.id,
      sessionTokenHash: "third",
      expiresAt: new Date("2026-10-03T00:00:00.000Z"),
      revokedAt: null,
    });

    const reactivated = await service.update(admin, target.id, { isActive: true });

    expect(reactivated.isActive).toBe(true);
    expect(persistence.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect(persistence.activityEvents).toContainEqual(
      expect.objectContaining({
        action: "user.reactivated",
        actorId: admin.id,
        actorNameSnapshot: admin.displayName,
        actorRoleSnapshot: admin.role,
        entityId: target.id,
        entityType: "user",
        newSnapshot: expect.objectContaining({ isActive: true }),
      }),
    );
    await expect(service.update(admin, admin.id, { isActive: false })).rejects.toEqual(
      new ConflictError("Administrators cannot deactivate themselves"),
    );
  });

  it("records a transactional audit event for non-activation user updates", async () => {
    const admin = createActor();
    const target = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Managed User",
      email: "managed@orbit.test",
      role: "BD",
    });
    const persistence = createPersistence([{ ...admin }, { ...target }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    const updated = await service.update(admin, target.id, {
      displayName: "Renamed User",
      timezone: "America/New_York",
    });

    expect(updated.displayName).toBe("Renamed User");
    expect(persistence.activityEvents).toContainEqual(
      expect.objectContaining({
        action: "user.updated",
        actorId: admin.id,
        actorNameSnapshot: admin.displayName,
        actorRoleSnapshot: admin.role,
        entityId: target.id,
        entityType: "user",
        newSnapshot: {
          id: target.id,
          displayName: "Renamed User",
          email: target.email,
          role: target.role,
          isActive: true,
          timezone: "America/New_York",
          lastLoginAt: null,
        },
      }),
    );
  });

  it("revokes all active sessions for the target user on demand", async () => {
    const admin = createActor();
    const target = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Managed User",
      email: "managed@orbit.test",
      role: "BD",
    });
    const persistence = createPersistence([{ ...admin }, { ...target }]);
    persistence.sessions.push(
      {
        id: "session-1",
        userId: target.id,
        sessionTokenHash: "first",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        revokedAt: null,
      },
      {
        id: "session-2",
        userId: target.id,
        sessionTokenHash: "second",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        revokedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    );
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new UserManagementService(persistence, sessions, () => FIXED_NOW, () => INVITATION_TOKEN);

    await service.revokeSessions(admin, target.id);

    expect(persistence.sessions).toEqual([
      expect.objectContaining({ id: "session-1", revokedAt: expect.any(Date) }),
      expect.objectContaining({
        id: "session-2",
        revokedAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ]);
    expect(persistence.activityEvents).toEqual([
      expect.objectContaining({
        action: "user.sessions_revoked",
        actorId: admin.id,
        actorNameSnapshot: admin.displayName,
        actorRoleSnapshot: admin.role,
        entityId: target.id,
        entityType: "user",
        metadata: { revokedActiveSessionCount: 1 },
      }),
    ]);
  });
});

describe("invitation acceptance boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a usable invitation once, hashes the password with Argon2id, and returns the session user", async () => {
    const invitedUser = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Invited User",
      email: "invited@orbit.test",
      role: "BD",
      passwordHash: null,
    });
    const persistence = createPersistence([{ ...invitedUser }]);
    persistence.authTokens.push({
      id: "auth-token-1",
      userId: invitedUser.id,
      tokenHash: hashInvitationToken(INVITATION_TOKEN),
      purpose: "USER_INVITATION",
      expiresAt: new Date("2026-09-09T12:00:00.000Z"),
      consumedAt: null,
      createdAt: FIXED_NOW,
    });
    persistence.sessions.push({
      id: "session-1",
      userId: invitedUser.id,
      sessionTokenHash: "existing-session",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revokedAt: null,
    });
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new InvitationService(persistence, sessions, () => FIXED_NOW);

    const accepted = await service.accept(INVITATION_TOKEN, "correct horse battery staple");

    expect(accepted).toEqual({
      id: invitedUser.id,
      displayName: invitedUser.displayName,
      email: invitedUser.email,
      role: invitedUser.role,
      isActive: true,
      timezone: "UTC",
    });
    expect(persistence.authTokens[0]?.consumedAt).toEqual(FIXED_NOW);
    expect(persistence.users[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(persistence.users[0]?.passwordHash, "correct horse battery staple"),
    ).resolves.toBe(true);
    expect(persistence.sessions[0]?.revokedAt).toEqual(FIXED_NOW);
    await expect(
      service.accept(INVITATION_TOKEN, "second correct horse battery staple"),
    ).rejects.toEqual(new AuthenticationError("Invalid invitation token"));
  });

  it("allows only one concurrent invitation acceptance to claim the token", async () => {
    const invitedUser = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Invited User",
      email: "invited@orbit.test",
      role: "BD",
      passwordHash: null,
    });
    const persistence = createPersistence([{ ...invitedUser }]);
    persistence.authTokens.push({
      id: "auth-token-1",
      userId: invitedUser.id,
      tokenHash: hashInvitationToken(INVITATION_TOKEN),
      purpose: "USER_INVITATION",
      expiresAt: new Date("2026-09-09T12:00:00.000Z"),
      consumedAt: null,
      createdAt: FIXED_NOW,
    });
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new InvitationService(persistence, sessions, () => FIXED_NOW);

    const results = await Promise.allSettled([
      service.accept(INVITATION_TOKEN, "correct horse battery staple"),
      service.accept(INVITATION_TOKEN, "second correct horse battery staple"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toEqual([
      expect.objectContaining({
        reason: new AuthenticationError("Invalid invitation token"),
      }),
    ]);
    expect(persistence.authTokens[0]?.consumedAt).toEqual(FIXED_NOW);
    expect(persistence.users[0]?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects expired and already-consumed invitation tokens with the same generic error", async () => {
    const invitedUser = createActor({
      id: "10000000-0000-4000-8000-000000000002",
      displayName: "Invited User",
      email: "invited@orbit.test",
      role: "BD",
      passwordHash: null,
    });
    const persistence = createPersistence([{ ...invitedUser }]);
    persistence.authTokens.push(
      {
        id: "auth-token-1",
        userId: invitedUser.id,
        tokenHash: hashInvitationToken("expired-token"),
        purpose: "USER_INVITATION",
        expiresAt: new Date("2026-09-01T12:00:00.000Z"),
        consumedAt: null,
        createdAt: FIXED_NOW,
      },
      {
        id: "auth-token-2",
        userId: invitedUser.id,
        tokenHash: hashInvitationToken("consumed-token"),
        purpose: "USER_INVITATION",
        expiresAt: new Date("2026-09-09T12:00:00.000Z"),
        consumedAt: new Date("2026-09-02T11:00:00.000Z"),
        createdAt: FIXED_NOW,
      },
    );
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const service = new InvitationService(persistence, sessions, () => FIXED_NOW);

    await expect(service.accept("expired-token", "correct horse battery staple")).rejects.toEqual(
      new AuthenticationError("Invalid invitation token"),
    );
    await expect(service.accept("consumed-token", "correct horse battery staple")).rejects.toEqual(
      new AuthenticationError("Invalid invitation token"),
    );
  });
});
