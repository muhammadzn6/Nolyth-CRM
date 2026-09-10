import "reflect-metadata";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  IdentityService,
  SessionService,
  hashPassword,
  type IdentityDatabase,
} from "@orbit/backend";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configureApi } from "../../main";
import { APP_BASE_URL_TOKEN, IdentityController } from "./identity.controller";
import { IdentityGuard } from "./identity.guard";

type User = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  role: "ADMIN" | "BD" | "CLOSER";
  isActive: boolean;
  lastLoginAt: Date | null;
};

type Session = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function createPersistence(users: User[]): IdentityDatabase {
  const sessions: Session[] = [];

  return {
    user: {
      findUnique: async ({ where }) =>
        users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const user = users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);
        return user;
      },
    },
    userSession: {
      updateMany: async ({ where, data }) => {
        let count = 0;

        for (const session of sessions) {
          if (session.userId === where.userId && (!where.revokedAt || !session.revokedAt)) {
            Object.assign(session, data);
            count += 1;
          }
        }

        return { count };
      },
      create: async ({ data }) => {
        sessions.push({ ...data, id: `session-${sessions.length + 1}`, revokedAt: null });
      },
      findUnique: async ({ where }) => {
        const session = sessions.find((candidate) => candidate.sessionTokenHash === where.sessionTokenHash);

        return session
          ? { ...session, user: users.find((user) => user.id === session.userId) ?? null }
          : null;
      },
      update: async ({ where, data }) => {
        const session = sessions.find((candidate) => candidate.id === where.id);

        if (!session) {
          throw new Error("Session not found");
        }

        Object.assign(session, data);
      },
    },
    profileBdAssignment: { findFirst: async () => null },
    profileCloserEligibility: { findFirst: async () => null },
  };
}

describe("identity endpoints", () => {
  let app: INestApplication;
  const trustedOrigin = "https://orbit.example.com";

  beforeEach(async () => {
    const passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([
      {
        id: "10000000-0000-4000-8000-000000000001",
        displayName: "Active User",
        email: "active@example.com",
        passwordHash,
        role: "BD",
        isActive: true,
        lastLoginAt: null,
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        displayName: "Inactive User",
        email: "inactive@example.com",
        passwordHash,
        role: "BD",
        isActive: false,
        lastLoginAt: null,
      },
    ]);
    const sessions = new SessionService(persistence, "api-e2e-session-secret");
    const identity = new IdentityService(persistence, sessions);
    const module = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        { provide: APP_BASE_URL_TOKEN, useValue: trustedOrigin },
        { provide: SessionService, useValue: sessions },
        { provide: IdentityService, useValue: identity },
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

  it("sets a secure HTTP-only cookie for a valid login", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: "active@example.com", password: "correct-password" })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: "10000000-0000-4000-8000-000000000001",
        displayName: "Active User",
        email: "active@example.com",
        role: "BD",
        isActive: true,
        timezone: "UTC",
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

  it("returns the same generic 401 response for invalid and inactive login attempts", async () => {
    const invalid = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: "active@example.com", password: "wrong-password" })
      .expect(401);
    const inactive = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: "inactive@example.com", password: "correct-password" })
      .expect(401);

    expect(invalid.body).toEqual(inactive.body);
    expect(invalid.body.message).toBe("Invalid email or password");
  });

  it("rejects missing sessions and revoked sessions", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: "active@example.com", password: "correct-password" })
      .expect(201);
    const cookie = login.headers["set-cookie"][0].split(";", 1)[0];

    await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie).expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Origin", trustedOrigin)
      .set("Cookie", cookie)
      .expect(201);
    await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie).expect(401);
  });

  it("rejects missing and cross-site Origins on login and logout", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "active@example.com", password: "correct-password" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Origin", "https://attacker.example.com")
      .expect(403);
  });

  it("returns 422 for invalid login input", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: "not-an-email", password: "" })
      .expect(422);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
