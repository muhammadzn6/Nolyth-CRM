import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { database } from "./index";
import { calculateProratedDailyTarget } from "../../backend/src/performance/business-hours";

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

async function createUser(email: string, role: "ADMIN" | "BD") {
  return database.user.create({
    data: { displayName: "Orbit User", email, role, timezone: "UTC" },
  });
}

async function createRuleSet(createdById: string, effectiveFrom: Date, effectiveTo: Date | null) {
  return database.performanceRuleSet.create({
    data: { createdById, effectiveFrom, effectiveTo },
  });
}

beforeAll(async () => {
  await database.$executeRawUnsafe('DROP SCHEMA "public" CASCADE');
  await database.$executeRawUnsafe('CREATE SCHEMA "public"');
  await database.$disconnect();
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
});

beforeEach(async () => {
  await database.performanceLeaderboardException.deleteMany();
  await database.performanceApprovedLeave.deleteMany();
  await database.performanceHoliday.deleteMany();
  await database.bdTargetSchedule.deleteMany();
  await database.performanceRuleSet.deleteMany();
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("performance rule persistence", () => {
  it("persists versioned Admin controls and a revocable leaderboard exception", async () => {
    const [admin, bd] = await Promise.all([
      createUser("performance-controls-admin@orbit.test", "ADMIN"),
      createUser("performance-controls-bd@orbit.test", "BD"),
    ]);
    const [holiday, leave, exception] = await Promise.all([
      database.performanceHoliday.create({ data: { holidayDate: new Date("2026-09-23T00:00:00.000Z"), name: "Pakistan Day", createdById: admin.id } }),
      database.performanceApprovedLeave.create({ data: { bdId: bd.id, approvedById: admin.id, startsAt: new Date("2026-10-05T00:00:00.000Z"), endsAt: new Date("2026-10-06T00:00:00.000Z"), availableStartHour: 9, availableEndHour: 13 } }),
      database.performanceLeaderboardException.create({ data: { bdId: bd.id, type: "PROVISIONAL", reason: "Migration review", effectiveFrom: new Date("2026-09-05T00:00:00.000Z"), expiresAt: new Date("2026-10-01T00:00:00.000Z"), createdById: admin.id } }),
    ]);
    const revoked = await database.performanceLeaderboardException.update({
      where: { id: exception.id },
      data: { revokedAt: new Date("2026-09-10T00:00:00.000Z"), revokedById: admin.id, revocationReason: "Reviewed", version: { increment: 1 } },
    });

    expect(holiday.version).toBe(1);
    expect(leave).toMatchObject({ version: 1, availableStartHour: 9, availableEndHour: 13 });
    expect(revoked).toMatchObject({ version: 2, revocationReason: "Reviewed", revokedById: admin.id });
  });

  it("persists reduced leave availability for a half-day target", async () => {
    const [admin, bd] = await Promise.all([
      createUser("leave-window-admin@orbit.test", "ADMIN"),
      createUser("leave-window-bd@orbit.test", "BD"),
    ]);
    const leave = await database.performanceApprovedLeave.create({
      data: {
        bdId: bd.id,
        approvedById: admin.id,
        startsAt: new Date("2026-09-08T00:00:00.000Z"),
        endsAt: new Date("2026-09-09T00:00:00.000Z"),
        availableStartHour: 9,
        availableEndHour: 13,
      },
    });
    const persisted = await database.performanceApprovedLeave.findUniqueOrThrow({ where: { id: leave.id } });

    expect(persisted).toMatchObject({ availableStartHour: 9, availableEndHour: 13 });
    expect(calculateProratedDailyTarget(70, new Date("2026-09-08T12:00:00.000Z"), {
      timeZone: "UTC",
      workingDays: [1, 2, 3, 4, 5],
      workday: { startHour: 9, endHour: 17 },
      leaves: [{
        startsAt: persisted.startsAt,
        endsAt: persisted.endsAt,
        availableHours: { startHour: persisted.availableStartHour!, endHour: persisted.availableEndHour! },
      }],
    })).toBe(35);
  });

  it("persists Monday through Friday when a rule set is created without a schedule", async () => {
    const admin = await createUser("performance-admin@orbit.test", "ADMIN");
    const ruleSet = await createRuleSet(admin.id, new Date("2026-09-07T00:00:00.000Z"), null);
    const rows = await database.$queryRaw<{
      workingDays: number[];
      businessCalendarTimeZone: string;
      workdayStartHour: number;
      workdayEndHour: number;
    }[]>`
      SELECT
        "working_days" AS "workingDays",
        "business_calendar_time_zone" AS "businessCalendarTimeZone",
        "workday_start_hour" AS "workdayStartHour",
        "workday_end_hour" AS "workdayEndHour"
      FROM "performance_rule_sets"
      WHERE "id" = ${ruleSet.id}::uuid
    `;

    expect(rows).toEqual([{
      workingDays: [1, 2, 3, 4, 5],
      businessCalendarTimeZone: "UTC",
      workdayStartHour: 9,
      workdayEndHour: 17,
    }]);
  });

  it("rejects invalid persisted working-day configurations", async () => {
    const admin = await createUser("working-days-admin@orbit.test", "ADMIN");

    await expect(
      database.performanceRuleSet.create({
        data: {
          createdById: admin.id,
          effectiveFrom: new Date("2026-09-07T00:00:00.000Z"),
          effectiveTo: null,
          workingDays: [1, 1],
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid persisted business-calendar windows and outcome-point order", async () => {
    const admin = await createUser("calendar-window-admin@orbit.test", "ADMIN");
    const ruleSet = {
      createdById: admin.id,
      effectiveFrom: new Date("2026-09-07T00:00:00.000Z"),
      effectiveTo: null,
    };

    await expect(
      database.performanceRuleSet.create({
        data: { ...ruleSet, workdayStartHour: 17, workdayEndHour: 9 },
      }),
    ).rejects.toThrow();
    await expect(
      database.performanceRuleSet.create({
        data: { ...ruleSet, positiveReplyPoints: 3, screeningPoints: 2 },
      }),
    ).rejects.toThrow();
  });

  it("rejects overlapping global rule sets while allowing adjacent periods", async () => {
    const admin = await createUser("rule-period-admin@orbit.test", "ADMIN");
    await createRuleSet(admin.id, new Date("2026-09-01T00:00:00.000Z"), new Date("2026-10-01T00:00:00.000Z"));

    await expect(
      createRuleSet(admin.id, new Date("2026-09-15T00:00:00.000Z"), new Date("2026-10-15T00:00:00.000Z")),
    ).rejects.toThrow();
    await expect(
      createRuleSet(admin.id, new Date("2026-10-01T00:00:00.000Z"), new Date("2026-11-01T00:00:00.000Z")),
    ).resolves.toMatchObject({ effectiveFrom: new Date("2026-10-01T00:00:00.000Z") });
  });

  it("rejects overlapping target schedules only for the same BD", async () => {
    const [admin, firstBd, secondBd] = await Promise.all([
      createUser("target-period-admin@orbit.test", "ADMIN"),
      createUser("target-period-first@orbit.test", "BD"),
      createUser("target-period-second@orbit.test", "BD"),
    ]);
    const firstPeriod = {
      bdId: firstBd.id,
      createdById: admin.id,
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-10-01T00:00:00.000Z"),
    };

    await database.bdTargetSchedule.create({ data: firstPeriod });
    await expect(
      database.bdTargetSchedule.create({
        data: {
          ...firstPeriod,
          effectiveFrom: new Date("2026-09-15T00:00:00.000Z"),
          effectiveTo: new Date("2026-10-15T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.bdTargetSchedule.create({
        data: {
          ...firstPeriod,
          bdId: secondBd.id,
          effectiveFrom: new Date("2026-09-15T00:00:00.000Z"),
          effectiveTo: new Date("2026-10-15T00:00:00.000Z"),
        },
      }),
    ).resolves.toMatchObject({ bdId: secondBd.id });
  });
});
