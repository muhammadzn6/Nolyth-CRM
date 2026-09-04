import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verify } from "argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { database, withTransaction } from "./index";

const databaseUrl = process.env.DATABASE_URL;
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const prismaExecutable = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));
const tsxExecutable = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));

if (!databaseUrl) {
  throw new Error("DATABASE_URL must target the disposable orbit_task3_test database");
}

if (new URL(databaseUrl).pathname !== "/orbit_task3_test") {
  throw new Error("DATABASE_URL must target the disposable orbit_task3_test database");
}

interface MigratedOutboxRow {
  attempts: number;
  id: string;
  idempotency_key: string;
  processed_at: Date | null;
  published_at: Date | null;
  status: "PENDING" | "PROCESSED";
}

interface MigrationRegressionResult {
  activeCloserUserIds: string[];
  authTokenCount: number;
  legacyAuthToken: { purpose: string; user_id: string } | null;
  endedCloserAssignments: Array<{ ended_reason: string | null; user_id: string }>;
  migratedPasswordHash: string | null;
  outboxRows: MigratedOutboxRow[];
  sessionCount: number;
}

let migrationRegression: MigrationRegressionResult;

function runPrisma(arguments_: string[]) {
  const result = spawnSync(prismaExecutable, arguments_, {
    cwd: packageDirectory,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  if (result.status !== 0) {
    throw new Error(`Prisma command failed: ${result.stderr || result.stdout}`);
  }
}

beforeAll(async () => {
  await database.$executeRawUnsafe('DROP SCHEMA "public" CASCADE');
  await database.$executeRawUnsafe('CREATE SCHEMA "public"');
  await database.$disconnect();

  runPrisma([
    "db",
    "execute",
    "--file",
    "prisma/migrations/00000000000000_init/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ]);
  runPrisma([
    "migrate",
    "resolve",
    "--applied",
    "00000000000000_init",
    "--schema",
    "prisma/schema.prisma",
  ]);

  await database.$executeRawUnsafe(`
    INSERT INTO "users" ("id", "display_name", "email", "role")
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'Legacy User', 'legacy@orbit.test', 'BD'),
      ('10000000-0000-4000-8000-000000000002', 'First Closer', 'first-closer@orbit.test', 'CLOSER'),
      ('10000000-0000-4000-8000-000000000003', 'Second Closer', 'second-closer@orbit.test', 'CLOSER')
  `);
  await database.$executeRawUnsafe(`
    INSERT INTO "user_sessions" ("user_id", "session_token", "expires_at")
    VALUES ('10000000-0000-4000-8000-000000000001', 'legacy-plaintext-session', '2030-01-01T00:00:00Z')
  `);
  await database.$executeRawUnsafe(`
    INSERT INTO "outbox_events" (
      "id", "aggregate_type", "aggregate_id", "event_type", "payload", "occurred_at", "published_at"
    ) VALUES
      (
        '20000000-0000-4000-8000-000000000001',
        'candidate',
        '30000000-0000-4000-8000-000000000001',
        'candidate.published',
        '{}',
        '2029-01-01T00:00:00Z',
        '2029-01-02T00:00:00Z'
      ),
      (
        '20000000-0000-4000-8000-000000000002',
        'candidate',
        '30000000-0000-4000-8000-000000000002',
        'candidate.pending',
        '{}',
        '2029-01-03T00:00:00Z',
        NULL
      )
  `);

  await database.$executeRawUnsafe(`
    INSERT INTO "candidates" ("id", "first_name", "last_name")
    VALUES ('40000000-0000-4000-8000-000000000001', 'Legacy', 'Candidate')
  `);
  await database.$executeRawUnsafe(`
    INSERT INTO "profiles" ("id", "candidate_id", "created_by_id")
    VALUES (
      '50000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    )
  `);
  await database.$executeRawUnsafe(`
    INSERT INTO "job_leads" (
      "id", "profile_id", "created_by_id", "current_owner_id", "company_name"
    ) VALUES (
      '60000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Legacy Company'
    )
  `);
  await database.$executeRawUnsafe(`
    INSERT INTO "lead_closer_assignments" (
      "id", "lead_id", "user_id", "assigned_by_id", "created_at", "updated_at"
    ) VALUES (
      '70000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      '2029-01-01T00:00:00Z',
      '2029-01-01T00:00:00Z'
    )
  `);

  runPrisma([
    "db",
    "execute",
    "--file",
    "prisma/migrations/20260902000000_task_3_foundation_corrections/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ]);
  runPrisma([
    "migrate",
    "resolve",
    "--applied",
    "20260902000000_task_3_foundation_corrections",
    "--schema",
    "prisma/schema.prisma",
  ]);

  await database.$executeRawUnsafe(`
    INSERT INTO "lead_closer_assignments" (
      "id", "lead_id", "user_id", "assigned_by_id", "created_at", "updated_at"
    ) VALUES (
      '70000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      '2029-02-01T00:00:00Z',
      '2029-02-01T00:00:00Z'
    )
  `);

  runPrisma([
    "db",
    "execute",
    "--file",
    "prisma/migrations/20260902010000_task_3_security_forward_corrections/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ]);
  runPrisma([
    "migrate",
    "resolve",
    "--applied",
    "20260902010000_task_3_security_forward_corrections",
    "--schema",
    "prisma/schema.prisma",
  ]);

  await database.$executeRawUnsafe(`
    INSERT INTO "auth_tokens" ("user_id", "token_hash", "type", "expires_at")
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'legacy-plaintext-token', 'password_reset', '2030-01-01T00:00:00Z'),
      (NULL, 'orphan-legacy-token', 'password_reset', '2030-01-01T00:00:00Z')
  `);

  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);

  const [sessionCount, authTokenCount, authTokens, users, outboxRows, closerAssignments] =
    await Promise.all([
      database.userSession.count(),
      database.authToken.count(),
      database.$queryRaw<Array<{ purpose: string; user_id: string }>>`
        SELECT "purpose"::text, "user_id"::text
        FROM "auth_tokens"
        WHERE "token_hash" = 'legacy-plaintext-token'
      `,
      database.$queryRaw<Array<{ password_hash: string | null }>>`
        SELECT "password_hash" FROM "users" WHERE "id" = '10000000-0000-4000-8000-000000000001'::uuid
      `,
      database.$queryRaw<MigratedOutboxRow[]>`
        SELECT
          "id"::text,
          "idempotency_key",
          "status"::text,
          "attempts",
          "published_at",
          "processed_at"
        FROM "outbox_events"
        ORDER BY "id"
      `,
      database.$queryRaw<Array<{
        ended_at: Date | null;
        ended_reason: string | null;
        user_id: string;
      }>>`
        SELECT "user_id"::text, "ended_at", "ended_reason"
        FROM "lead_closer_assignments"
        ORDER BY "created_at"
      `,
    ]);

  migrationRegression = {
    activeCloserUserIds: closerAssignments
      .filter((assignment) => assignment.ended_at === null)
      .map((assignment) => assignment.user_id),
    authTokenCount,
    legacyAuthToken: authTokens[0] ?? null,
    endedCloserAssignments: closerAssignments
      .filter((assignment) => assignment.ended_at !== null)
      .map(({ ended_reason, user_id }) => ({ ended_reason, user_id })),
    migratedPasswordHash: users[0]?.password_hash ?? null,
    outboxRows,
    sessionCount,
  };
});

async function createUser(email: string, role: "ADMIN" | "BD" | "CLOSER" = "BD") {
  return database.user.create({
    data: {
      displayName: "Orbit User",
      email,
      role,
      timezone: "UTC",
    },
  });
}

async function createProfile(createdById: string, candidateId?: string) {
  const candidate =
    candidateId === undefined
      ? await database.candidate.create({
          data: { firstName: "Avery", lastName: "Stone" },
        })
      : { id: candidateId };

  return database.profile.create({
    data: { candidateId: candidate.id, createdById, name: "Primary profile" },
  });
}

beforeEach(async () => {
  await database.outboxEvent.deleteMany();
  await database.activityEvent.deleteMany();
  await database.leadContact.deleteMany();
  await database.leadStatusTransition.deleteMany();
  await database.leadCloserAssignment.deleteMany();
  await database.leadOwnershipTransfer.deleteMany();
  await database.jobLead.deleteMany();
  await database.contact.deleteMany();
  await database.company.deleteMany();
  await database.jobSource.deleteMany();
  await database.profileCloserEligibility.deleteMany();
  await database.profileBdAssignment.deleteMany();
  await database.profile.deleteMany();
  await database.candidate.deleteMany();
  await database.authToken.deleteMany();
  await database.userSession.deleteMany();
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("Orbit database foundation", () => {
  it("upgrades the applied cec3964 state while converting supported password-reset tokens", () => {
    expect(migrationRegression.sessionCount).toBe(0);
    expect(migrationRegression.authTokenCount).toBe(1);
    expect(migrationRegression.legacyAuthToken).toEqual({
      purpose: "PASSWORD_RESET",
      user_id: "10000000-0000-4000-8000-000000000001",
    });
    expect(migrationRegression.migratedPasswordHash).toBeNull();
    expect(migrationRegression.activeCloserUserIds).toEqual([
      "10000000-0000-4000-8000-000000000003",
    ]);
    expect(migrationRegression.endedCloserAssignments).toEqual([
      {
        ended_reason: "migration: superseded duplicate active closer",
        user_id: "10000000-0000-4000-8000-000000000002",
      },
    ]);
    expect(migrationRegression.outboxRows).toEqual([
      {
        attempts: 0,
        id: "20000000-0000-4000-8000-000000000001",
        idempotency_key: "20000000-0000-4000-8000-000000000001",
        processed_at: new Date("2029-01-02T00:00:00.000Z"),
        published_at: new Date("2029-01-02T00:00:00.000Z"),
        status: "PROCESSED",
      },
      {
        attempts: 0,
        id: "20000000-0000-4000-8000-000000000002",
        idempotency_key: "20000000-0000-4000-8000-000000000002",
        processed_at: null,
        published_at: null,
        status: "PENDING",
      },
    ]);
  });

  it("creates UUID records with hashed session and auth-token fields", async () => {
    const user = await createUser("owner@orbit.test");
    const session = await database.userSession.create({
      data: {
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        sessionTokenHash: "sha256:session-token",
        userId: user.id,
      },
    });
    const token = await database.authToken.create({
      data: {
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        purpose: "PASSWORD_RESET",
        tokenHash: "sha256:auth-token",
        userId: user.id,
      },
    });

    expect(user.timezone).toBe("UTC");
    expect(session.sessionTokenHash).toBe("sha256:session-token");
    expect(token.purpose).toBe("PASSWORD_RESET");
    expect(token.tokenHash).toBe("sha256:auth-token");
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects user emails that differ only by case", async () => {
    await createUser("Owner@orbit.test");

    await expect(createUser("owner@orbit.test")).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows one candidate to have many profiles", async () => {
    const creator = await createUser("creator@orbit.test");
    const candidate = await database.candidate.create({
      data: { firstName: "Avery", lastName: "Stone" },
    });

    await Promise.all([
      createProfile(creator.id, candidate.id),
      createProfile(creator.id, candidate.id),
    ]);

    await expect(database.profile.count({ where: { candidateId: candidate.id } })).resolves.toBe(2);
  });

  it("preserves ended BD assignments while enforcing one active pair", async () => {
    const [creator, formerBd, currentBd] = await Promise.all([
      createUser("creator@orbit.test"),
      createUser("former-bd@orbit.test"),
      createUser("current-bd@orbit.test"),
    ]);
    const profile = await createProfile(creator.id);

    await database.profileBdAssignment.create({
      data: {
        assignedById: creator.id,
        endedAt: new Date("2029-01-01T00:00:00.000Z"),
        endedReason: "reassigned",
        profileId: profile.id,
        userId: formerBd.id,
      },
    });
    await database.profileBdAssignment.create({
      data: { assignedById: creator.id, profileId: profile.id, userId: currentBd.id },
    });

    await expect(
      database.profileBdAssignment.create({
        data: { assignedById: creator.id, profileId: profile.id, userId: currentBd.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(database.profileBdAssignment.count({ where: { profileId: profile.id } })).resolves.toBe(2);
  });

  it("preserves closer eligibility and lead-assignment history with active uniqueness", async () => {
    const [creator, closer, otherCloser] = await Promise.all([
      createUser("creator@orbit.test"),
      createUser("closer@orbit.test", "CLOSER"),
      createUser("other-closer@orbit.test", "CLOSER"),
    ]);
    const profile = await createProfile(creator.id);
    const endedAt = new Date("2029-01-01T00:00:00.000Z");

    await database.profileCloserEligibility.create({
      data: {
        endedAt,
        endedReason: "capacity",
        profileId: profile.id,
        setById: creator.id,
        userId: closer.id,
      },
    });
    await database.profileCloserEligibility.create({
      data: { profileId: profile.id, setById: creator.id, userId: closer.id },
    });
    await expect(
      database.profileCloserEligibility.create({
        data: { profileId: profile.id, setById: creator.id, userId: closer.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await database.profileCloserEligibility.create({
      data: { profileId: profile.id, setById: creator.id, userId: otherCloser.id },
    });
    const [company, source] = await Promise.all([
      database.company.create({
        data: { canonicalName: "Orbit Labs", createdById: creator.id },
      }),
      database.jobSource.create({ data: { name: "Referral" } }),
    ]);
    const lead = await database.jobLead.create({
      data: {
        appliedDate: new Date("2029-01-01T00:00:00.000Z"),
        canonicalHash: "lead-hash",
        canonicalUrl: "https://orbit.test/jobs/1",
        companyId: company.id,
        companyName: "Orbit Labs",
        createdById: creator.id,
        currentOwnerId: creator.id,
        jobTitle: "Platform Engineer",
        profileId: profile.id,
        rawUrl: "https://orbit.test/jobs/1",
        source: "referral",
        sourceId: source.id,
      },
    });
    await database.leadCloserAssignment.create({
      data: {
        assignedById: creator.id,
        endedAt,
        endedReason: "reassigned",
        leadId: lead.id,
        userId: closer.id,
      },
    });
    await database.leadCloserAssignment.create({
      data: { assignedById: creator.id, leadId: lead.id, userId: closer.id },
    });
    await expect(
      database.leadCloserAssignment.create({
        data: { assignedById: creator.id, leadId: lead.id, userId: otherCloser.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(database.profileCloserEligibility.count()).resolves.toBe(3);
    await expect(database.leadCloserAssignment.count()).resolves.toBe(2);
  });

  it("defaults new idempotent outbox events to pending with zero attempts", async () => {
    const event = await database.outboxEvent.create({
      data: {
        aggregateId: "30000000-0000-4000-8000-000000000003",
        aggregateType: "candidate",
        eventType: "candidate.created",
        idempotencyKey: "candidate-created-defaults",
        payload: {},
      },
    });

    expect(event).toMatchObject({ attempts: 0, processedAt: null, status: "PENDING" });
  });

  it("requires a seed password and stores seeded credentials as Argon2id", async () => {
    const missingPasswordEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };
    delete missingPasswordEnvironment.ORBIT_SEED_ADMIN_PASSWORD;

    const missingPasswordResult = spawnSync(tsxExecutable, ["prisma/seed.ts"], {
      cwd: packageDirectory,
      encoding: "utf8",
      env: missingPasswordEnvironment,
    });

    expect(missingPasswordResult.status).not.toBe(0);

    const seedPassword = "task-3-disposable-seed-password";
    const seedResult = spawnSync(tsxExecutable, ["prisma/seed.ts"], {
      cwd: packageDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        ORBIT_SEED_ADMIN_PASSWORD: seedPassword,
      },
    });

    expect(seedResult.status, seedResult.stderr || seedResult.stdout).toBe(0);

    const seededAdmin = await database.user.findUniqueOrThrow({
      where: { email: "admin@orbit.local" },
    });

    expect(seededAdmin.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verify(seededAdmin.passwordHash!, seedPassword)).resolves.toBe(true);
    expect(seededAdmin.passwordChangedAt).toBeInstanceOf(Date);
  });

  it("allows archived duplicate URLs but rejects an additional active canonical URL", async () => {
    const creator = await createUser("creator@orbit.test");
    const profile = await createProfile(creator.id);
    const [company, source] = await Promise.all([
      database.company.create({
        data: { canonicalName: "Orbit Labs", createdById: creator.id },
      }),
      database.jobSource.create({ data: { name: "Manual" } }),
    ]);
    const duplicateUrl = "https://orbit.test/jobs/duplicate";
    const sharedLead = {
      appliedDate: new Date("2029-01-01T00:00:00.000Z"),
      canonicalHash: "duplicate-hash",
      canonicalUrl: duplicateUrl,
      companyId: company.id,
      companyName: "Orbit Labs",
      createdById: creator.id,
      currentOwnerId: creator.id,
      jobTitle: "Platform Engineer",
      profileId: profile.id,
      rawUrl: duplicateUrl,
      source: "manual",
      sourceId: source.id,
    };

    await database.jobLead.create({
      data: {
        ...sharedLead,
        archiveReason: "duplicate",
        archivedAt: new Date("2029-01-01T00:00:00.000Z"),
        archivedById: creator.id,
      },
    });
    const activeLead = await database.jobLead.create({
      data: {
        ...sharedLead,
        closedAt: new Date("2029-02-01T00:00:00.000Z"),
        closureReason: "filled",
        placedAt: new Date("2029-02-02T00:00:00.000Z"),
        responsibleCloserId: creator.id,
        startDate: new Date("2029-03-01T00:00:00.000Z"),
      },
    });

    expect(activeLead).toMatchObject({ canonicalUrl: duplicateUrl, source: "manual" });
    await expect(database.jobLead.create({ data: sharedLead })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("rolls back business, immutable audit, and idempotent outbox writes together", async () => {
    const actor = await createUser("actor@orbit.test");

    await expect(
      withTransaction(async (tx) => {
        const candidate = await tx.candidate.create({
          data: { firstName: "Avery", lastName: "Stone" },
        });
        await tx.activityEvent.create({
          data: {
            action: "candidate.created",
            actorId: actor.id,
            actorNameSnapshot: "Orbit User",
            actorRoleSnapshot: "BD",
            entityId: candidate.id,
            entityType: "candidate",
            metadata: { source: "test" },
            newSnapshot: { candidateId: candidate.id },
            requestId: "request-1",
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: candidate.id,
            aggregateType: "candidate",
            eventType: "candidate.created",
            idempotencyKey: "candidate-created-request-1",
            payload: { candidateId: candidate.id },
            status: "PENDING",
          },
        });

        throw new Error("rollback transaction");
      }),
    ).rejects.toThrow("rollback transaction");

    await expect(database.candidate.count()).resolves.toBe(0);
    await expect(database.activityEvent.count()).resolves.toBe(0);
    await expect(database.outboxEvent.count()).resolves.toBe(0);
  });
});
