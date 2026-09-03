import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

beforeAll(async () => {
  await database.$executeRawUnsafe('DROP SCHEMA "public" CASCADE');
  await database.$executeRawUnsafe('CREATE SCHEMA "public"');
  await database.$disconnect();
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
});

beforeEach(async () => {
  await database.authToken.deleteMany();
  await database.userSession.deleteMany();
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

async function createInvitedUser(email: string) {
  return database.user.create({
    data: {
      displayName: "Invited User",
      email,
      role: "BD",
      timezone: "UTC",
    },
  });
}

describe("user-management persistence", () => {
  it("requires every auth token to belong to a user", async () => {
    await expect(
      database.$executeRawUnsafe(`
        INSERT INTO "auth_tokens" ("token_hash", "purpose", "expires_at")
        VALUES ('sha256:orphan-invitation', 'USER_INVITATION', '2030-01-01T00:00:00Z')
      `),
    ).rejects.toThrow();
  });

  it("links a USER_INVITATION token to a user without requiring a password hash", async () => {
    const user = await createInvitedUser("invited@orbit.test");
    const invitation = await database.authToken.create({
      data: {
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        purpose: "USER_INVITATION",
        tokenHash: "sha256:invitation-token",
        userId: user.id,
      },
      include: { user: true },
    });

    expect(user.passwordHash).toBeNull();
    expect(invitation).toMatchObject({
      consumedAt: null,
      purpose: "USER_INVITATION",
      tokenHash: "sha256:invitation-token",
      userId: user.id,
    });
    expect(invitation.user?.email).toBe("invited@orbit.test");
  });

  it("rejects duplicate invitation token hashes", async () => {
    const user = await createInvitedUser("unique-invitation@orbit.test");
    const invitation = {
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      purpose: "USER_INVITATION" as const,
      tokenHash: "sha256:duplicate-invitation-token",
      userId: user.id,
    };

    await database.authToken.create({ data: invitation });

    await expect(database.authToken.create({ data: invitation })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("excludes expired and consumed invitations from the usable-token query", async () => {
    const user = await createInvitedUser("invitation-state@orbit.test");
    const now = new Date("2030-01-01T00:00:00.000Z");

    await database.authToken.createMany({
      data: [
        {
          expiresAt: new Date("2030-01-01T00:01:00.000Z"),
          purpose: "USER_INVITATION",
          tokenHash: "sha256:usable-invitation",
          userId: user.id,
        },
        {
          expiresAt: new Date("2029-12-31T23:59:00.000Z"),
          purpose: "USER_INVITATION",
          tokenHash: "sha256:expired-invitation",
          userId: user.id,
        },
        {
          consumedAt: new Date("2029-12-31T23:58:00.000Z"),
          expiresAt: new Date("2030-01-01T00:01:00.000Z"),
          purpose: "USER_INVITATION",
          tokenHash: "sha256:consumed-invitation",
          userId: user.id,
        },
      ],
    });

    const usableInvitations = await database.authToken.findMany({
      where: {
        consumedAt: null,
        expiresAt: { gt: now },
        purpose: "USER_INVITATION",
      },
      orderBy: { tokenHash: "asc" },
    });

    expect(usableInvitations.map(({ tokenHash }) => tokenHash)).toEqual([
      "sha256:usable-invitation",
    ]);
  });
});
