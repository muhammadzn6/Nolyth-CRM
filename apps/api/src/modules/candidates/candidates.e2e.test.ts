import "reflect-metadata";

import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AuthorizationService,
  CandidatesService,
  SessionService,
  type CandidateProfileDatabase,
  type IdentityDatabase,
} from "@orbit/backend";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configureApi } from "../../main";
import { APP_BASE_URL_TOKEN } from "../identity/identity.controller";
import { CandidatesModule } from "./candidates.module";

const now = new Date("2026-09-02T12:00:00.000Z");
const trustedOrigin = "https://orbit.example.com";
const sessionSecret = "candidates-api-e2e-session-secret";
const candidateId = "20000000-0000-4000-8000-000000000001";
const assignedProfileId = "30000000-0000-4000-8000-000000000001";
const hiddenProfileId = "30000000-0000-4000-8000-000000000002";
const adminId = "10000000-0000-4000-8000-000000000001";
const bdId = "10000000-0000-4000-8000-000000000002";
const secondBdId = "10000000-0000-4000-8000-000000000003";
const closerId = "10000000-0000-4000-8000-000000000004";

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

type Candidate = {
  id: string;
  linkedUserId: string | null;
  archivedById: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  location: string | null;
  internalNotes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type Profile = {
  id: string;
  candidateId: string;
  createdById: string;
  archivedById: string | null;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  defaultCurrency: string;
  targetCompensation: string | null;
  compensationPeriod: "HOURLY" | "YEARLY" | null;
  targetRoles: string[];
  preferredLocations: string[];
  workplacePreferences: string[];
  jobTypePreferences: string[];
  contractPreferences: string[];
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

type Assignment = {
  id: string;
  profileId: string;
  userId: string;
  assignedById?: string;
  setById?: string;
  isEligible?: boolean;
  assignedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
};

function hashSessionToken(token: string) {
  return createHmac("sha256", sessionSecret).update(token).digest("hex");
}

function createUser(id: string, role: User["role"]): User {
  return {
    id,
    displayName: `${role} User`,
    email: `${role.toLowerCase()}-${id.at(-1)}@orbit.test`,
    passwordHash: null,
    role,
    isActive: true,
    lastLoginAt: null,
  };
}

function createCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: candidateId,
    linkedUserId: null,
    archivedById: null,
    firstName: "Ada",
    lastName: "Lovelace",
    preferredName: null,
    email: "ada@orbit.test",
    phone: null,
    timezone: "UTC",
    location: null,
    internalNotes: null,
    status: "ACTIVE",
    archivedAt: null,
    archiveReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

function createProfile(id: string, name: string): Profile {
  return {
    id,
    candidateId,
    createdById: adminId,
    archivedById: null,
    name,
    description: null,
    status: "DRAFT",
    defaultCurrency: "USD",
    targetCompensation: null,
    compensationPeriod: null,
    targetRoles: [],
    preferredLocations: [],
    workplacePreferences: [],
    jobTypePreferences: [],
    contractPreferences: [],
    archivedAt: null,
    archiveReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function createPersistence() {
  const users = [
    createUser(adminId, "ADMIN"),
    createUser(bdId, "BD"),
    createUser(secondBdId, "BD"),
    createUser(closerId, "CLOSER"),
  ];
  const sessions: Session[] = [
    ["admin", adminId],
    ["bd", bdId],
  ].map(([token, userId]) => ({
    id: `session-${token}`,
    userId,
    sessionTokenHash: hashSessionToken(`${token}-session`),
    expiresAt: new Date("2099-10-01T00:00:00.000Z"),
    revokedAt: null,
  }));
  const candidates = [createCandidate()];
  const profiles = [
    createProfile(assignedProfileId, "Assigned profile"),
    createProfile(hiddenProfileId, "Hidden profile"),
  ];
  const bdAssignments: Assignment[] = [{
    id: "40000000-0000-4000-8000-000000000001",
    profileId: assignedProfileId,
    userId: bdId,
    assignedById: adminId,
    assignedAt: now,
    endedAt: null,
    endedReason: null,
  }];
  const closerEligibilities: Assignment[] = [];

  const matches = (record: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) => record[key] === expected);
  const activeAssignment = (assignments: Assignment[], profileId: string, userId: string) =>
    assignments.some((assignment) =>
      assignment.profileId === profileId
      && assignment.userId === userId
      && assignment.endedAt === null,
    );

  const candidateStore = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      candidates.find((candidate) => candidate.id === where.id) ?? null,
    findMany: async () => [...candidates],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = createCandidate({
        id: `20000000-0000-4000-8000-${String(candidates.length + 1).padStart(12, "0")}`,
        ...data,
      } as Partial<Candidate>);
      candidates.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = candidates.find((candidate) => matches(candidate, where));
      if (!existing) return { count: 0 };
      const { version: _version, ...changes } = data;
      Object.assign(existing, changes, { version: existing.version + 1, updatedAt: now });
      return { count: 1 };
    },
  };

  const profileStore = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      profiles.find((profile) => profile.id === where.id) ?? null,
    findMany: async ({ where = {} }: { where?: Record<string, unknown> } = {}) => {
      const scopedBd = (where.bdAssignments as { some?: { userId?: string } } | undefined)?.some?.userId;
      return profiles.filter((profile) =>
        (!where.candidateId || profile.candidateId === where.candidateId)
        && (!where.status || profile.status === where.status)
        && (!scopedBd || activeAssignment(bdAssignments, profile.id, scopedBd)),
      );
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = {
        ...createProfile(
          `30000000-0000-4000-8000-${String(profiles.length + 1).padStart(12, "0")}`,
          String(data.name),
        ),
        ...data,
      } as Profile;
      profiles.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = profiles.find((profile) => matches(profile, where));
      if (!existing) return { count: 0 };
      const { version: _version, ...changes } = data;
      Object.assign(existing, changes, { version: existing.version + 1, updatedAt: now });
      return { count: 1 };
    },
  };

  const assignmentStore = (assignments: Assignment[], idPrefix: string) => ({
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      assignments.find((assignment) => matches(assignment, where)) ?? null,
    findMany: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
      assignments.filter((assignment) => matches(assignment, where)),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = {
        id: `${idPrefix}-${String(assignments.length + 1).padStart(12, "0")}`,
        assignedAt: now,
        endedAt: null,
        endedReason: null,
        ...data,
      } as Assignment;
      assignments.push(created);
      return created;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const existing = assignments.find((assignment) => matches(assignment, where));
      if (!existing) return { count: 0 };
      Object.assign(existing, data);
      return { count: 1 };
    },
  });

  const bdStore = assignmentStore(bdAssignments, "41000000-0000-4000-8000");
  const closerStore = assignmentStore(closerEligibilities, "51000000-0000-4000-8000");
  const activityEvent = { create: async ({ data }: { data: Record<string, unknown> }) => data };
  const transaction = {
    candidate: candidateStore,
    profile: profileStore,
    profileBdAssignment: bdStore,
    profileCloserEligibility: closerStore,
    activityEvent,
  };

  return {
    candidate: candidateStore,
    profile: profileStore,
    profileBdAssignment: bdStore,
    profileCloserEligibility: closerStore,
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) => user.id === where.id || user.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error("User not found");
        Object.assign(user, data);
        return user;
      },
    },
    userSession: {
      findUnique: async ({ where }: { where: { sessionTokenHash: string } }) => {
        const session = sessions.find((candidate) => candidate.sessionTokenHash === where.sessionTokenHash);
        return session
          ? { ...session, user: users.find((user) => user.id === session.userId) ?? null }
          : null;
      },
      updateMany: async () => ({ count: 0 }),
      create: async () => undefined,
      update: async () => undefined,
    },
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>) => work(transaction),
  } as unknown as CandidateProfileDatabase & IdentityDatabase;
}

describe("candidate and profile endpoints", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const persistence = createPersistence();
    const sessions = new SessionService(persistence, sessionSecret);
    const authorization = new AuthorizationService(persistence);
    const candidates = new CandidatesService(persistence, authorization, () => now);
    const module = await Test.createTestingModule({ imports: [CandidatesModule] })
      .overrideProvider(APP_BASE_URL_TOKEN)
      .useValue(trustedOrigin)
      .overrideProvider(SessionService)
      .useValue(sessions)
      .overrideProvider(AuthorizationService)
      .useValue(authorization)
      .overrideProvider(CandidatesService)
      .useValue(candidates)
      .compile();

    app = module.createNestApplication();
    configureApi(app, { appBaseUrl: trustedOrigin });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("envelopes authentication, trusted-Origin, and strict validation errors", async () => {
    const unauthenticated = await request(app.getHttpServer())
      .get("/api/v1/candidates")
      .expect(401);
    expect(unauthenticated.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
      meta: { requestId: expect.any(String) },
    });

    await request(app.getHttpServer())
      .post("/api/v1/candidates")
      .set("Cookie", "orbit_session=admin-session")
      .send({ firstName: "Grace", lastName: "Hopper" })
      .expect(403);

    const invalid = await request(app.getHttpServer())
      .post("/api/v1/candidates")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ firstName: "Grace", lastName: "Hopper", unknown: true })
      .expect(422);
    expect(invalid.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
      meta: { requestId: expect.any(String) },
    });
  });

  it("lets an Admin create, update, archive, and restore a candidate with version checks", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/candidates")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ firstName: " Grace ", lastName: " Hopper ", timezone: "UTC" })
      .expect(201);
    expect(created.body).toMatchObject({
      success: true,
      data: { firstName: "Grace", lastName: "Hopper", version: 1 },
      meta: { requestId: expect.any(String) },
    });
    const id = created.body.data.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/candidates/${id}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ preferredName: "Amazing Grace", expectedVersion: 1 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ preferredName: "Amazing Grace", version: 2 });

    const archived = await request(app.getHttpServer())
      .post(`/api/v1/candidates/${id}/archive`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ reason: "Duplicate record", expectedVersion: 2 })
      .expect(201);
    expect(archived.body.data).toMatchObject({ status: "ARCHIVED", version: 3 });

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/candidates/${id}/restore`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ expectedVersion: 3 })
      .expect(201);
    expect(restored.body.data).toMatchObject({ status: "ACTIVE", version: 4 });

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/candidates/${id}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ preferredName: "Stale", expectedVersion: 1 })
      .expect(409);
    expect(stale.body).toMatchObject({
      success: false,
      error: {
        code: "STALE_VERSION",
        details: { expectedVersion: 1, actualVersion: 4 },
      },
    });
  });

  it("exposes the complete Admin profile lifecycle", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/profiles")
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ candidateId, name: " Platform " })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ name: "Platform", status: "DRAFT", version: 1 });

    await request(app.getHttpServer())
      .patch(`/api/v1/profiles/${id}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ name: "Backend", expectedVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/profiles/${id}/activate`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ expectedVersion: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/profiles/${id}/pause`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ expectedVersion: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/profiles/${id}/archive`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ reason: "Candidate withdrew", expectedVersion: 4 })
      .expect(201);
    const restored = await request(app.getHttpServer())
      .post(`/api/v1/profiles/${id}/restore`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ expectedVersion: 5 })
      .expect(201);
    expect(restored.body.data).toMatchObject({ status: "DRAFT", version: 6 });
  });

  it("scopes profile list and detail reads to an assigned BD", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/candidates")
      .set("Cookie", "orbit_session=bd-session")
      .expect(403);

    const list = await request(app.getHttpServer())
      .get("/api/v1/profiles")
      .set("Cookie", "orbit_session=bd-session")
      .expect(200);
    expect(list.body).toMatchObject({
      success: true,
      data: { items: [{ id: assignedProfileId }], nextCursor: null },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${assignedProfileId}`)
      .set("Cookie", "orbit_session=bd-session")
      .expect(200);
    expect(detail.body.data).toMatchObject({
      id: assignedProfileId,
      candidate: { id: candidateId, firstName: "Ada", lastName: "Lovelace" },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/profiles/${hiddenProfileId}`)
      .set("Cookie", "orbit_session=bd-session")
      .expect(403);
  });

  it("lets only Admin manage BD assignments and Closer eligibility while preserving ended rows", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/profiles/${assignedProfileId}/bd-assignments`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=bd-session")
      .send({ userId: secondBdId })
      .expect(403);

    const bdAssignment = await request(app.getHttpServer())
      .post(`/api/v1/profiles/${assignedProfileId}/bd-assignments`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ userId: secondBdId })
      .expect(201);
    const bdAssignmentId = bdAssignment.body.data.id as string;

    await request(app.getHttpServer())
      .delete(`/api/v1/profiles/${assignedProfileId}/bd-assignments/${bdAssignmentId}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ reason: "Coverage moved" })
      .expect(200);
    const bdHistory = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${assignedProfileId}/bd-assignments`)
      .set("Cookie", "orbit_session=admin-session")
      .expect(200);
    expect(bdHistory.body.data).toContainEqual(expect.objectContaining({
      id: bdAssignmentId,
      endedAt: now.toISOString(),
      endedReason: "Coverage moved",
    }));

    const eligibility = await request(app.getHttpServer())
      .post(`/api/v1/profiles/${assignedProfileId}/closer-eligibility`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ userId: closerId })
      .expect(201);
    const eligibilityId = eligibility.body.data.id as string;

    await request(app.getHttpServer())
      .delete(`/api/v1/profiles/${assignedProfileId}/closer-eligibility/${eligibilityId}`)
      .set("Origin", trustedOrigin)
      .set("Cookie", "orbit_session=admin-session")
      .send({ reason: "Unavailable" })
      .expect(200);
    const eligibilityHistory = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${assignedProfileId}/closer-eligibility`)
      .set("Cookie", "orbit_session=admin-session")
      .expect(200);
    expect(eligibilityHistory.body.data).toContainEqual(expect.objectContaining({
      id: eligibilityId,
      endedAt: now.toISOString(),
      endedReason: "Unavailable",
    }));
  });
});
