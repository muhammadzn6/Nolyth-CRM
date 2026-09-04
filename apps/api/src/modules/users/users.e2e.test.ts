import "reflect-metadata";

import { createHash, createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AuthorizationService,
  InvitationService,
  SessionService,
  UserManagementService,
  type IdentityDatabase,
  type InvitationDatabase,
  type UserManagementDatabase,
} from "@orbit/backend";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configureApi } from "../../main";
import { APP_BASE_URL_TOKEN } from "../identity/identity.controller";
import { IdentityGuard } from "../identity/identity.guard";
import { InvitationsController } from "../invitations/invitations.controller";
import { UsersController } from "./users.controller";

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

const trustedOrigin = "https://orbit.example.com";
const sessionSecret = "users-api-e2e-session-secret";
const fixedNow = new Date("2026-09-02T12:00:00.000Z");
const invitationToken = "opaque-invitation-token";
const targetUserId = "10000000-0000-4000-8000-000000000003";

function hashInvitationToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function hashSessionToken(token: string) {
  return createHmac("sha256", sessionSecret).update(token).digest("hex");
}

function createUser(overrides: Partial<User>): User {
  return {
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
    ...overrides,
  };
}

type TestDatabase = IdentityDatabase & InvitationDatabase & UserManagementDatabase;

function createPersistence(users: User[]): TestDatabase {
  const sessions: Session[] = [
    {
      id: "session-admin",
      userId: "10000000-0000-4000-8000-000000000001",
      sessionTokenHash: hashSessionToken("admin-session"),
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revokedAt: null,
    },
    {
      id: "session-bd",
      userId: "10000000-0000-4000-8000-000000000002",
      sessionTokenHash: hashSessionToken("bd-session"),
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revokedAt: null,
    },
  ];
  const authTokens: AuthToken[] = [
    {
      id: "auth-token-1",
      userId: "10000000-0000-4000-8000-000000000004",
      tokenHash: hashInvitationToken(invitationToken),
      purpose: "USER_INVITATION",
      expiresAt: new Date("2026-09-09T12:00:00.000Z"),
      consumedAt: null,
      createdAt: fixedNow,
    },
  ];
  const activityEvents: unknown[] = [];
  const outboxEvents: unknown[] = [];

  const tx = {
    user: {
      findMany: async () => [...users],
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      create: async ({ data }: { data: Omit<User, "id" | "lastLoginAt" | "passwordChangedAt"> }) => {
        const created: User = {
          id: targetUserId,
          lastLoginAt: null,
          passwordChangedAt: null,
          ...data,
        };
        users.push(created);
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const user = users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);
        return user;
      },
    },
    authToken: {
      create: async ({ data }: { data: Omit<AuthToken, "id" | "consumedAt" | "createdAt"> }) => {
        const created = {
          id: `auth-token-${authTokens.length + 1}`,
          consumedAt: null,
          createdAt: fixedNow,
          ...data,
        };
        authTokens.push(created);
        return created;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        authTokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          tokenHash: string;
          purpose: AuthToken["purpose"];
          consumedAt: null;
          expiresAt: { gt: Date };
        };
        data: Partial<AuthToken>;
      }) => {
        let count = 0;

        for (const authToken of authTokens) {
          if (authToken.tokenHash !== where.tokenHash) continue;
          if (authToken.purpose !== where.purpose) continue;
          if (authToken.consumedAt !== where.consumedAt) continue;
          if (authToken.expiresAt <= where.expiresAt.gt) continue;

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
      create: async ({ data }: { data: Omit<Session, "id" | "revokedAt"> }) => {
        const created = { id: `session-${sessions.length + 1}`, revokedAt: null, ...data };
        sessions.push(created);
        return created;
      },
      findUnique: async ({
        where,
      }: {
        where: { sessionTokenHash: string };
        include: { user: true };
      }) => {
        const session = sessions.find((candidate) => candidate.sessionTokenHash === where.sessionTokenHash);

        return session
          ? { ...session, user: users.find((user) => user.id === session.userId) ?? null }
          : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
        const session = sessions.find((candidate) => candidate.id === where.id);

        if (!session) {
          throw new Error("Session not found");
        }

        Object.assign(session, data);
      },
    },
    activityEvent: { create: async ({ data }: { data: unknown }) => activityEvents.push(data) },
    outboxEvent: { upsert: async ({ create }: { create: unknown }) => outboxEvents.push(create) },
  };

  return {
    user: tx.user,
    authToken: tx.authToken,
    userSession: tx.userSession,
    activityEvent: tx.activityEvent,
    outboxEvent: tx.outboxEvent,
    profileBdAssignment: { findFirst: async () => null },
    profileCloserEligibility: { findFirst: async () => null },
    $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx),
  } as unknown as TestDatabase;
}

describe("admin user-management endpoints", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const persistence = createPersistence([
      createUser({ id: "10000000-0000-4000-8000-000000000001" }),
      createUser({
        id: "10000000-0000-4000-8000-000000000002",
        displayName: "BD User",
        email: "bd@orbit.test",
        role: "BD",
      }),
      createUser({
        id: "10000000-0000-4000-8000-000000000004",
        displayName: "Invited User",
        email: "invited@orbit.test",
        role: "BD",
      }),
    ]);
    const sessions = new SessionService(persistence, sessionSecret);
    const users = new UserManagementService(
      persistence,
      sessions,
      () => fixedNow,
      () => invitationToken,
    );
    const invitations = new InvitationService(persistence, sessions, () => fixedNow);
    const module = await Test.createTestingModule({
      controllers: [UsersController, InvitationsController],
      providers: [
        { provide: APP_BASE_URL_TOKEN, useValue: trustedOrigin },
        { provide: SessionService, useValue: sessions },
        { provide: UserManagementService, useValue: users },
        { provide: InvitationService, useValue: invitations },
        { provide: AuthorizationService, useValue: new AuthorizationService(persistence) },
        IdentityGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    configureApi(app, { appBaseUrl: trustedOrigin });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("allows BD to read the user directory without mutation access", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Cookie", "orbit_session=bd-session")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.arrayContaining([expect.objectContaining({ role: "BD" })]),
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.meta.requestId);
  });

  it("rejects strict create payload violations with request ids", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({
        displayName: "Managed User",
        email: "managed@orbit.test",
        role: "BD",
        timezone: "UTC",
        isAdmin: true,
      })
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.meta.requestId).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).toBe(response.body.meta.requestId);
  });

  it("returns an enveloped 409 for duplicate emails", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({
        displayName: "Duplicate User",
        email: "BD@Orbit.test",
        role: "BD",
        timezone: "UTC",
      })
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "CONFLICT",
        message: "A user with this email already exists",
      },
      meta: { requestId: expect.any(String) },
    });
  });

  it("creates, updates, deactivates, and revokes sessions for an admin", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({
        displayName: "Managed User",
        email: "managed@orbit.test",
        role: "CLOSER",
        timezone: "UTC",
      })
      .expect(201);

    expect(created.body).toMatchObject({
      success: true,
      data: {
        user: {
          id: targetUserId,
          displayName: "Managed User",
          email: "managed@orbit.test",
          role: "CLOSER",
          isActive: true,
          timezone: "UTC",
          lastLoginAt: null,
        },
        invitationToken,
      },
      meta: { requestId: expect.any(String) },
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ displayName: "Renamed User" })
      .expect(200);
    expect(updated.body.data.displayName).toBe("Renamed User");

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body.data.isActive).toBe(false);

    const revoked = await request(app.getHttpServer())
      .post(`/api/v1/users/${targetUserId}/revoke-sessions`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .expect(201);
    expect(revoked.body).toMatchObject({
      success: true,
      data: null,
      meta: { requestId: expect.any(String) },
    });
  });

  it.each([
    ["missing", undefined],
    ["cross-site", "https://attacker.example.com"],
  ])("rejects %s Origins on authenticated admin user mutations", async (_label, origin) => {
    const setOrigin = (agent: request.Test) =>
      origin === undefined ? agent : agent.set("Origin", origin);

    await setOrigin(
      request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Cookie", "orbit_session=admin-session")
        .send({
          displayName: "Managed User",
          email: "managed@orbit.test",
          role: "BD",
          timezone: "UTC",
        }),
    ).expect(403);

    await setOrigin(
      request(app.getHttpServer())
        .patch(`/api/v1/users/${targetUserId}`)
        .set("Cookie", "orbit_session=admin-session")
        .send({ displayName: "Managed User" }),
    ).expect(403);

    await setOrigin(
      request(app.getHttpServer())
        .post(`/api/v1/users/${targetUserId}/revoke-sessions`)
        .set("Cookie", "orbit_session=admin-session"),
    ).expect(403);
  });

  it("accepts invitations only from the trusted origin and sets a secure cookie", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/accept")
      .send({ token: invitationToken, password: "correct horse battery staple" })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/invitations/accept")
      .set("Origin", trustedOrigin)
      .send({ token: invitationToken, password: "correct horse battery staple" })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: "10000000-0000-4000-8000-000000000004",
        displayName: "Invited User",
        email: "invited@orbit.test",
        role: "BD",
        isActive: true,
      },
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("orbit_session="),
    ]);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Secure");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });
});
