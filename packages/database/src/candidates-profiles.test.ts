import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { database } from "./index";

const databaseUrl = process.env.DATABASE_URL;
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const prismaExecutable = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));

if (!databaseUrl) {
  throw new Error("DATABASE_URL must target the disposable orbit_task3_test database");
}

if (new URL(databaseUrl).pathname !== "/orbit_task3_test") {
  throw new Error("DATABASE_URL must target the disposable orbit_task3_test database");
}

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

async function createUser(email: string, role: "ADMIN" | "BD" | "CLOSER") {
  return database.user.create({
    data: {
      displayName: "Orbit User",
      email,
      role,
      timezone: "UTC",
    },
  });
}

beforeAll(async () => {
  await database.$executeRawUnsafe('DROP SCHEMA "public" CASCADE');
  await database.$executeRawUnsafe('CREATE SCHEMA "public"');
  await database.$disconnect();
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
});

beforeEach(async () => {
  await database.outboxEvent.deleteMany();
  await database.activityEvent.deleteMany();
  await database.leadStatusTransition.deleteMany();
  await database.leadCloserAssignment.deleteMany();
  await database.leadOwnershipTransfer.deleteMany();
  await database.jobLead.deleteMany();
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

describe("candidate and profile persistence", () => {
  it("stores candidate contacts and multiple independently configured profiles", async () => {
    const [admin, linkedCloser] = await Promise.all([
      createUser("admin@orbit.test", "ADMIN"),
      createUser("linked-closer@orbit.test", "CLOSER"),
    ]);
    const candidate = await database.candidate.create({
      data: {
        email: "ada@example.com",
        firstName: "Ada",
        internalNotes: "Prefers remote roles",
        lastName: "Lovelace",
        linkedUserId: linkedCloser.id,
        location: "London, UK",
        phone: "+44 20 7946 0958",
        preferredName: "Ada",
        timezone: "Europe/London",
      },
    });

    const [engineering, leadership] = await Promise.all([
      database.profile.create({
        data: {
          candidateId: candidate.id,
          contractPreferences: ["PERMANENT"],
          createdById: admin.id,
          defaultCurrency: "GBP",
          jobTypePreferences: ["FULL_TIME"],
          name: "Platform Engineering",
          preferredLocations: ["London"],
          targetCompensation: "125000.00",
          targetRoles: ["Staff Engineer"],
          workplacePreferences: ["REMOTE"],
        },
      }),
      database.profile.create({
        data: {
          candidateId: candidate.id,
          createdById: admin.id,
          name: "Engineering Leadership",
          targetRoles: ["Engineering Manager"],
        },
      }),
    ]);

    expect(candidate).toMatchObject({
      linkedUserId: linkedCloser.id,
      preferredName: "Ada",
      status: "ACTIVE",
      version: 1,
    });
    expect([engineering, leadership]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId: candidate.id,
          name: "Platform Engineering",
          status: "DRAFT",
          version: 1,
        }),
        expect.objectContaining({
          candidateId: candidate.id,
          name: "Engineering Leadership",
          status: "DRAFT",
          version: 1,
        }),
      ]),
    );
    await expect(database.profile.count({ where: { candidateId: candidate.id } })).resolves.toBe(2);
  });

  it("keeps ended BD assignment history while rejecting a duplicate active pair", async () => {
    const [admin, bd] = await Promise.all([
      createUser("assignment-admin@orbit.test", "ADMIN"),
      createUser("assigned-bd@orbit.test", "BD"),
    ]);
    const candidate = await database.candidate.create({
      data: { firstName: "Grace", lastName: "Hopper" },
    });
    const profile = await database.profile.create({
      data: { candidateId: candidate.id, createdById: admin.id, name: "Compiler Roles" },
    });
    const endedAt = new Date("2026-09-01T10:00:00.000Z");

    const ended = await database.profileBdAssignment.create({
      data: {
        assignedById: admin.id,
        endedAt,
        endedReason: "Coverage changed",
        profileId: profile.id,
        userId: bd.id,
      },
    });
    const active = await database.profileBdAssignment.create({
      data: { assignedById: admin.id, profileId: profile.id, userId: bd.id },
    });

    await expect(
      database.profileBdAssignment.create({
        data: { assignedById: admin.id, profileId: profile.id, userId: bd.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(ended).toMatchObject({
      assignedAt: expect.any(Date),
      endedAt,
      endedReason: "Coverage changed",
      version: 1,
    });
    expect(active).toMatchObject({ assignedAt: expect.any(Date), endedAt: null, version: 1 });
    await expect(
      database.profileBdAssignment.count({ where: { profileId: profile.id, userId: bd.id } }),
    ).resolves.toBe(2);
  });

  it("keeps ended Closer eligibility history while rejecting a duplicate active pair", async () => {
    const [admin, closer] = await Promise.all([
      createUser("eligibility-admin@orbit.test", "ADMIN"),
      createUser("eligible-closer@orbit.test", "CLOSER"),
    ]);
    const candidate = await database.candidate.create({
      data: { firstName: "Katherine", lastName: "Johnson" },
    });
    const profile = await database.profile.create({
      data: { candidateId: candidate.id, createdById: admin.id, name: "Orbital Mechanics" },
    });
    const endedAt = new Date("2026-09-01T10:00:00.000Z");

    const ended = await database.profileCloserEligibility.create({
      data: {
        endedAt,
        endedReason: "Availability changed",
        profileId: profile.id,
        setById: admin.id,
        userId: closer.id,
      },
    });
    const active = await database.profileCloserEligibility.create({
      data: { profileId: profile.id, setById: admin.id, userId: closer.id },
    });

    await expect(
      database.profileCloserEligibility.create({
        data: { profileId: profile.id, setById: admin.id, userId: closer.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(ended).toMatchObject({
      assignedAt: expect.any(Date),
      endedAt,
      endedReason: "Availability changed",
      version: 1,
    });
    expect(active).toMatchObject({ assignedAt: expect.any(Date), endedAt: null, version: 1 });
    await expect(
      database.profileCloserEligibility.count({
        where: { profileId: profile.id, userId: closer.id },
      }),
    ).resolves.toBe(2);
  });
});
