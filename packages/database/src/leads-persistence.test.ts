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
    data: { displayName: "Orbit User", email, role, timezone: "UTC" },
  });
}

async function createProfile(createdById: string, name: string) {
  const candidate = await database.candidate.create({
    data: { firstName: "Test", lastName: "Candidate" },
  });

  return database.profile.create({
    data: { candidateId: candidate.id, createdById, name },
  });
}

beforeAll(async () => {
  await database.$executeRawUnsafe('DROP SCHEMA "public" CASCADE');
  await database.$executeRawUnsafe('CREATE SCHEMA "public"');
  await database.$disconnect();
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
});

beforeEach(async () => {
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
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("company, contact, and lead persistence", () => {
  it("stores company and contact relations with lead history", async () => {
    const [admin, owner, closer] = await Promise.all([
      createUser("lead-admin@orbit.test", "ADMIN"),
      createUser("lead-owner@orbit.test", "BD"),
      createUser("lead-closer@orbit.test", "CLOSER"),
    ]);
    const profile = await createProfile(admin.id, "Platform roles");
    const company = await database.company.create({
      data: {
        canonicalName: "Orbit Labs",
        createdById: admin.id,
        domain: "orbit.test",
        industry: "Technology",
        location: "Remote",
        website: "https://orbit.test",
      },
    });
    const contact = await database.contact.create({
      data: {
        companyId: company.id,
        createdById: owner.id,
        email: "recruiter@orbit.test",
        name: "Grace Hopper",
        title: "Technical Recruiter",
      },
    });
    const source = await database.jobSource.create({
      data: { displayOrder: 10, name: "LinkedIn" },
    });
    const lead = await database.jobLead.create({
      data: {
        appliedDate: new Date("2026-09-02T00:00:00.000Z"),
        canonicalHash: "orbit-staff-platform",
        canonicalUrl: "https://orbit.test/jobs/42",
        companyId: company.id,
        companyName: "Orbit Labs",
        createdById: owner.id,
        currentOwnerId: owner.id,
        jobTitle: "Staff Platform Engineer",
        profileId: profile.id,
        rawUrl: "https://orbit.test/jobs/42?utm_source=crm",
        sourceId: source.id,
      },
    });
    const linkedContact = await database.leadContact.create({
      data: {
        contactId: contact.id,
        isPrimary: true,
        leadId: lead.id,
        role: "RECRUITER",
      },
    });

    await database.leadCloserAssignment.create({
      data: { assignedById: owner.id, leadId: lead.id, userId: closer.id },
    });
    await database.leadOwnershipTransfer.create({
      data: {
        actorId: admin.id,
        fromOwnerId: owner.id,
        leadId: lead.id,
        reason: "Coverage change",
        toOwnerId: owner.id,
      },
    });
    await database.leadStatusTransition.createMany({
      data: [
        {
          actorId: owner.id,
          fromStatus: "APPLIED",
          leadId: lead.id,
          toStatus: "RESPONSE_RECEIVED",
        },
        {
          actorId: owner.id,
          fromStatus: "RESPONSE_RECEIVED",
          leadId: lead.id,
          toStatus: "INTERVIEWING",
        },
      ],
    });

    const persisted = await database.jobLead.findUniqueOrThrow({
      where: { id: lead.id },
      include: {
        closerAssignments: true,
        company: true,
        contacts: { include: { contact: true } },
        ownershipTransfers: true,
        sourceRef: true,
        statusTransitions: { orderBy: { occurredAt: "asc" } },
      },
    });

    expect(persisted).toMatchObject({
      company: { canonicalName: "Orbit Labs" },
      isImportant: false,
      sourceRef: { name: "LinkedIn" },
      status: "APPLIED",
      version: 1,
    });
    expect(persisted.contacts).toEqual([
      expect.objectContaining({
        id: linkedContact.id,
        isPrimary: true,
        role: "RECRUITER",
        contact: expect.objectContaining({ name: "Grace Hopper" }),
      }),
    ]);
    expect(persisted.statusTransitions.map(({ toStatus }) => toStatus)).toEqual([
      "RESPONSE_RECEIVED",
      "INTERVIEWING",
    ]);
    expect(persisted.closerAssignments).toHaveLength(1);
    expect(persisted.ownershipTransfers).toHaveLength(1);
  });

  it("rejects active canonical duplicates only within the same profile", async () => {
    const owner = await createUser("duplicate-owner@orbit.test", "BD");
    const [firstProfile, secondProfile] = await Promise.all([
      createProfile(owner.id, "First profile"),
      createProfile(owner.id, "Second profile"),
    ]);
    const company = await database.company.create({
      data: { canonicalName: "Duplicate Corp", createdById: owner.id },
    });
    const source = await database.jobSource.create({ data: { name: "Manual" } });
    const canonicalHash = "canonical-duplicate-hash";
    const canonicalUrl = "https://duplicate.test/jobs/1";
    const leadData = {
      appliedDate: new Date("2026-09-02T00:00:00.000Z"),
      canonicalHash,
      canonicalUrl,
      companyId: company.id,
      companyName: "Duplicate Corp",
      createdById: owner.id,
      currentOwnerId: owner.id,
      jobTitle: "Platform Engineer",
      rawUrl: canonicalUrl,
      sourceId: source.id,
    };

    await database.jobLead.create({ data: { ...leadData, profileId: firstProfile.id } });
    await expect(
      database.jobLead.create({ data: { ...leadData, profileId: firstProfile.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      database.jobLead.create({ data: { ...leadData, profileId: secondProfile.id } }),
    ).resolves.toMatchObject({ profileId: secondProfile.id });
    await expect(
      database.jobLead.create({
        data: {
          ...leadData,
          archiveReason: "Imported duplicate",
          archivedAt: new Date("2026-09-02T12:00:00.000Z"),
          archivedById: owner.id,
          profileId: firstProfile.id,
        },
      }),
    ).resolves.toMatchObject({
      archiveReason: "Imported duplicate",
      archivedAt: expect.any(Date),
      archivedById: owner.id,
    });
  });
});
