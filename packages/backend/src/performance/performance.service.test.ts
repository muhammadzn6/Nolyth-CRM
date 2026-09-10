import { describe, expect, it, vi } from "vitest";

import { AuthorizationError, StaleVersionError } from "../errors/app-error";
import { outcomeStage, PerformanceService } from "./performance.service";

const admin = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Admin User",
  email: "admin@orbit.test",
  role: "ADMIN" as const,
  isActive: true,
};

const bd = {
  id: "10000000-0000-4000-8000-000000000002",
  displayName: "BD User",
  email: "bd@orbit.test",
  role: "BD" as const,
  isActive: true,
};

const reviewId = "10000000-0000-4000-8000-000000000003";
const leadId = "10000000-0000-4000-8000-000000000004";

describe("PerformanceService", () => {
  it("returns uncapped BD work-queue totals while keeping bounded previews separate", async () => {
    const leads = Array.from({ length: 127 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      currentOwnerId: bd.id,
      status: index < 64 ? "RESPONSE_RECEIVED" : index < 103 ? "INTERVIEWING" : "APPLIED",
      rawUrl: index % 2 ? "https://www.linkedin.com/jobs/view/1" : "https://jobs.example.com/role/2",
    }));
    const tasks = Array.from({ length: 64 }, (_, index) => ({ id: String(index), assigneeId: bd.id, status: "OPEN" }));
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue(leads) },
      task: { findMany: vi.fn().mockResolvedValue(tasks) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      leadStatusTransition: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database, { assertRole: vi.fn() } as never);

    await expect(service.getBdWorkQueue(bd)).resolves.toMatchObject({
      recruiterResponses: 64,
      activeApplications: 39,
      openFollowUps: 64,
      platformTotals: [
        { platform: "jobs.example.com", count: 64 },
        { platform: "linkedin.com", count: 63 },
      ],
    });
  });

  it("returns timezone-scoped daily activity and lifetime pipeline stages from BD-owned records", async () => {
    const leads = [
      { id: "10000000-0000-4000-8000-000000000011", status: "APPLIED", rawUrl: "https://www.linkedin.com/jobs/view/11", appliedDate: new Date("2026-09-07T00:00:00.000Z") },
      { id: "10000000-0000-4000-8000-000000000012", status: "RESPONSE_RECEIVED", rawUrl: "https://www.indeed.com/viewjob?jk=12", appliedDate: new Date("2026-09-07T00:00:00.000Z") },
      { id: "10000000-0000-4000-8000-000000000013", status: "CLOSED", rawUrl: "https://www.linkedin.com/jobs/view/13", appliedDate: new Date("2026-09-05T00:00:00.000Z") },
      { id: "10000000-0000-4000-8000-000000000014", status: "OFFER_RECEIVED", rawUrl: "https://jobs.example.com/14", appliedDate: new Date("2026-09-03T00:00:00.000Z") },
      { id: "10000000-0000-4000-8000-000000000015", status: "CLOSED", rawUrl: "not-a-url", appliedDate: new Date("2026-09-01T00:00:00.000Z") },
      { id: "10000000-0000-4000-8000-000000000016", status: "STARTED", rawUrl: "https://jobs.example.com/16", appliedDate: new Date("2026-08-31T00:00:00.000Z") },
    ];
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue(leads) },
      task: { findMany: vi.fn().mockResolvedValue([{ id: "task-1" }]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "America/New_York" }) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([{ leadId: leads[2].id }]) },
      leadStatusTransition: { findMany: vi.fn().mockResolvedValue([
        { leadId: leads[2].id, toStatus: "INTERVIEWING" },
        { leadId: leads[4].id, toStatus: "PLACED" },
      ]) },
    };
    const service = new PerformanceService(
      database,
      { assertRole: vi.fn() } as never,
      undefined,
      () => new Date("2026-09-08T02:00:00.000Z"),
    );

    await expect(service.getBdWorkQueue(bd)).resolves.toEqual({
      recruiterResponses: 1,
      activeApplications: 1,
      openFollowUps: 1,
      platformTotals: [
        { platform: "jobs.example.com", count: 2 },
        { platform: "linkedin.com", count: 2 },
        { platform: "indeed.com", count: 1 },
        { platform: "Other", count: 1 },
      ],
      businessTimeZone: "America/New_York",
      todayPlatformTotals: [
        { platform: "indeed.com", count: 1 },
        { platform: "linkedin.com", count: 1 },
      ],
      sevenDayApplicationTotals: [
        { date: "2026-09-01", total: 1, platformTotals: [{ platform: "Other", count: 1 }] },
        { date: "2026-09-02", total: 0, platformTotals: [] },
        { date: "2026-09-03", total: 1, platformTotals: [{ platform: "jobs.example.com", count: 1 }] },
        { date: "2026-09-04", total: 0, platformTotals: [] },
        { date: "2026-09-05", total: 1, platformTotals: [{ platform: "linkedin.com", count: 1 }] },
        { date: "2026-09-06", total: 0, platformTotals: [] },
        { date: "2026-09-07", total: 2, platformTotals: [{ platform: "indeed.com", count: 1 }, { platform: "linkedin.com", count: 1 }] },
      ],
      pipelineTotals: {
        jobsApplied: 6,
        activeJobs: 2,
        interviews: 4,
        offers: 3,
        placements: 2,
      },
    });

    expect(database.jobLead.findMany).toHaveBeenCalledWith({
      where: { currentOwnerId: bd.id, archivedAt: null },
      select: { id: true, status: true, rawUrl: true, appliedDate: true },
    });
    expect(database.interviewRound.findMany).toHaveBeenCalledWith({
      where: { leadId: { in: leads.map((lead) => lead.id) } },
      select: { leadId: true },
    });
    expect(database.leadStatusTransition.findMany).toHaveBeenCalledWith({
      where: { leadId: { in: leads.map((lead) => lead.id) } },
      select: { leadId: true, toStatus: true },
    });
  });

  it("credits authored activity to the submitting BD while keeping queue actions with the current owner", async () => {
    const authored = [{
      id: "10000000-0000-4000-8000-000000000017",
      createdById: bd.id,
      currentOwnerId: admin.id,
      status: "OFFER_RECEIVED",
      rawUrl: "https://www.linkedin.com/jobs/view/17",
      appliedDate: new Date("2026-09-07T00:00:00.000Z"),
    }];
    const owned = [{
      id: "10000000-0000-4000-8000-000000000018",
      createdById: admin.id,
      currentOwnerId: bd.id,
      status: "RESPONSE_RECEIVED",
      rawUrl: "https://www.indeed.com/viewjob?jk=18",
      appliedDate: new Date("2026-09-07T00:00:00.000Z"),
    }];
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValueOnce(authored).mockResolvedValueOnce(owned) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "America/New_York" }) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      leadStatusTransition: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-08T02:00:00.000Z"));

    await expect(service.getBdWorkQueue(bd)).resolves.toMatchObject({
      recruiterResponses: 1,
      activeApplications: 0,
      todayPlatformTotals: [{ platform: "linkedin.com", count: 1 }],
      pipelineTotals: { jobsApplied: 1, activeJobs: 1, interviews: 1, offers: 1, placements: 0 },
    });
    expect(database.jobLead.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { createdById: bd.id, archivedAt: null } }));
    expect(database.jobLead.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { currentOwnerId: bd.id, archivedAt: null } }));
  });

  it("derives Screening from a persisted recruiter or pre-screen round before a technical interview", () => {
    expect(outcomeStage("RESPONSE_RECEIVED", [{ roundType: "PRE_SCREEN" }])).toBe("SCREENING");
    expect(outcomeStage("RESPONSE_RECEIVED", [{ roundType: "TECHNICAL" }])).toBe("INTERVIEW");
  });

  it("retains the highest historical positive outcome after a lead is closed", () => {
    expect(outcomeStage("CLOSED", [], [{ toStatus: "RESPONSE_RECEIVED" }])).toBe("POSITIVE_REPLY");
    expect(outcomeStage("CLOSED", [], [{ toStatus: "RESPONSE_RECEIVED" }, { toStatus: "INTERVIEWING" }])).toBe("INTERVIEW");
  });

  it("lets a BD drill into only their own performance records", async () => {
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      outboxEvent: { upsert: vi.fn().mockResolvedValue(undefined) },
      $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.getMyPerformanceDrilldown(bd, {
      metric: "QUALIFIED_APPLICATIONS",
      bdId: admin.id,
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
    })).resolves.toEqual([]);

    expect(database.jobLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdById: bd.id }),
    }));
  });

  it("does not expose the Admin team performance read to a BD", async () => {
    const service = new PerformanceService({} as never, { assertRole: vi.fn() } as never);

    await expect(service.getAdminBdPerformance(bd, {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    })).rejects.toEqual(new AuthorizationError());
  });

  it("returns the active business timezone with the Admin performance read", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "America/New_York" }) },
    };
    const service = new PerformanceService(database, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-09T02:30:00.000Z"));
    vi.spyOn(service, "evaluateOverdueSlas").mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 });

    await expect(service.getAdminBdPerformance(admin, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
    })).resolves.toMatchObject({ businessTimeZone: "America/New_York" });
  });

  it("uses US Eastern as the platform business timezone when no rule has been persisted", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new PerformanceService(database, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-09T02:30:00.000Z"));
    vi.spyOn(service, "evaluateOverdueSlas").mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 });

    await expect(service.getAdminBdPerformance(admin, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
    })).resolves.toMatchObject({ businessTimeZone: "America/New_York" });
  });

  it("returns every immutable performance rule version in effective-date order for an Admin", async () => {
    const first = {
      id: "10000000-0000-4000-8000-000000000091",
      effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-09-10T00:00:00.000Z"),
      defaultDailyTarget: 70,
      workingDays: [1, 2, 3, 4, 5],
      businessCalendarTimeZone: "Asia/Karachi",
      workdayStartHour: 9,
      workdayEndHour: 17,
      followUpSlaBusinessHours: 48,
      adminReassignmentSlaBusinessHours: 2,
      maturityWindowDays: 21,
      duplicateLookbackMonths: 6,
      applicationWeightPercent: 45,
      followUpWeightPercent: 25,
      outcomeWeightPercent: 30,
      positiveReplyPoints: 1,
      screeningPoints: 2,
      interviewPoints: 3,
      offerPoints: 5,
      slowdownThresholdPercent: 120,
      slowdownMultiplierPercent: 25,
      createdById: admin.id,
      auditMetadata: { reason: "Initial policy" },
      version: 1,
      createdAt: new Date("2026-07-31T00:00:00.000Z"),
      updatedAt: new Date("2026-07-31T00:00:00.000Z"),
    };
    const next = { ...first, id: "10000000-0000-4000-8000-000000000092", effectiveFrom: new Date("2026-09-10T00:00:00.000Z"), effectiveTo: null, version: 2, auditMetadata: { reason: "Raised target" } };
    const findMany = vi.fn().mockResolvedValue([first, next]);
    const authorization = { assertRole: vi.fn() };
    const service = new PerformanceService({ performanceRuleSet: { findMany } } as never, authorization as never);

    await expect(service.getPerformanceRuleHistory(admin)).resolves.toMatchObject([
      { id: first.id, effectiveFrom: "2026-08-01T00:00:00.000Z", effectiveTo: "2026-09-10T00:00:00.000Z", auditMetadata: { reason: "Initial policy" } },
      { id: next.id, effectiveFrom: "2026-09-10T00:00:00.000Z", effectiveTo: null, auditMetadata: { reason: "Raised target" } },
    ]);
    expect(authorization.assertRole).toHaveBeenCalledWith(admin, ["ADMIN"]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { effectiveFrom: "asc" } });
  });

  it("loads the latest open future rule for further scheduling after a refresh", async () => {
    const active = {
      id: "10000000-0000-4000-8000-000000000093",
      effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-09-10T00:00:00.000Z"),
      createdById: admin.id,
      version: 2,
    };
    const scheduled = {
      ...active,
      id: "10000000-0000-4000-8000-000000000094",
      effectiveFrom: new Date("2026-09-10T00:00:00.000Z"),
      effectiveTo: null,
      version: 1,
    };
    const findFirst = vi.fn().mockImplementation(({ where }: { where: { effectiveTo?: null } }) =>
      Promise.resolve(where.effectiveTo === null ? scheduled : active),
    );
    const service = new PerformanceService({ performanceRuleSet: { findFirst } } as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-05T00:00:00.000Z"));

    await expect(service.getPerformanceRules(admin)).resolves.toMatchObject({ id: scheduled.id, effectiveFrom: "2026-09-10T00:00:00.000Z" });
    expect(findFirst).toHaveBeenCalledWith({ where: { effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
  });

  it("returns only open Admin reassignment work with its lead context", async () => {
    const queued = {
      id: "10000000-0000-4000-8000-000000000006",
      leadId,
      ownerId: bd.id,
      originalOwnerId: bd.id,
      status: "NEEDS_REASSIGNMENT",
      recruiterRespondedAt: new Date("2026-09-05T09:00:00.000Z"),
      slaStartedAt: new Date("2026-09-05T09:00:00.000Z"),
      slaPausedAt: new Date("2026-09-05T10:00:00.000Z"),
      slaResumedAt: null,
      slaDueAt: null,
      completedAt: null,
      breachedAt: null,
      adminReassignmentSlaStartedAt: new Date("2026-09-05T10:00:00.000Z"),
      adminReassignmentSlaDueAt: new Date("2026-09-05T12:00:00.000Z"),
      adminReassignmentBreachedAt: null,
      reassignedAt: null,
      reassignedById: null,
      auditMetadata: null,
      version: 1,
      createdAt: new Date("2026-09-05T09:00:00.000Z"),
      updatedAt: new Date("2026-09-05T10:00:00.000Z"),
      lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", createdById: bd.id, currentOwnerId: bd.id, companyName: "Orbit", jobTitle: "Platform Engineer", appliedDate: new Date("2026-09-01T00:00:00.000Z"), status: "RESPONSE_RECEIVED" },
    };
    const database: any = {
      performanceFollowUp: { findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([queued]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const authorization = { assertRole: vi.fn() };
    const service = new PerformanceService(database as never, authorization as never);

    await expect(service.getAdminReassignmentQueue(admin)).resolves.toMatchObject([{ id: queued.id, status: "NEEDS_REASSIGNMENT", lead: { id: leadId } }]);
    expect(authorization.assertRole).toHaveBeenCalledWith(admin, ["ADMIN"]);
    expect(database.performanceFollowUp.findMany).toHaveBeenLastCalledWith({
      where: { status: { in: ["NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"] } },
      include: { lead: true },
      orderBy: { adminReassignmentSlaDueAt: "asc" },
    });
  });

  it("aggregates team quality from raw unequal-volume counts instead of BD percentages", () => {
    const service = new PerformanceService({} as never, { assertRole: vi.fn() } as never);
    const aggregate = (service as unknown as { aggregateQuality(rows: Array<Record<string, unknown>>): Record<string, number | null> }).aggregateQuality([
      {
        qualityCounts: {
          recordHealth: { numerator: 0, denominator: 1 },
          adminAuditPass: { numerator: 0, denominator: 1 },
          corrections: { numerator: 1, denominator: 1 },
          confirmedDuplicates: { numerator: 1, denominator: 1 },
          pendingOverrides: { numerator: 0, denominator: 1 },
          rejectedOverrides: { numerator: 1, denominator: 1 },
          duplicates: { numerator: 1, denominator: 1 },
        },
      },
      {
        qualityCounts: {
          recordHealth: { numerator: 99, denominator: 99 },
          adminAuditPass: { numerator: 99, denominator: 99 },
          corrections: { numerator: 0, denominator: 99 },
          confirmedDuplicates: { numerator: 0, denominator: 99 },
          pendingOverrides: { numerator: 0, denominator: 99 },
          rejectedOverrides: { numerator: 0, denominator: 99 },
          duplicates: { numerator: 0, denominator: 99 },
        },
      },
    ]);

    expect(aggregate).toMatchObject({
      recordHealthRate: 99,
      adminAuditPassRate: 99,
      correctionRate: 1,
      confirmedDuplicateRate: 1,
      rejectedOverrideRate: 1,
      duplicateRate: 1,
    });
  });

  it("lets Admin maintain versioned BD targets, holidays, leave, and temporary leaderboard exceptions", async () => {
    const target = { id: "10000000-0000-4000-8000-000000000071", bdId: bd.id, dailyTarget: 80, effectiveFrom: new Date("2026-10-01T00:00:00.000Z"), effectiveTo: null, createdById: admin.id, auditMetadata: null, version: 1, createdAt: new Date("2026-09-05T00:00:00.000Z"), updatedAt: new Date("2026-09-05T00:00:00.000Z") };
    const holiday = { id: "10000000-0000-4000-8000-000000000072", holidayDate: new Date("2026-09-23T00:00:00.000Z"), name: "Pakistan Day", createdById: admin.id, auditMetadata: null, version: 1, createdAt: new Date("2026-09-05T00:00:00.000Z"), updatedAt: new Date("2026-09-05T00:00:00.000Z") };
    const leave = { id: "10000000-0000-4000-8000-000000000073", bdId: bd.id, startsAt: new Date("2026-10-05T00:00:00.000Z"), endsAt: new Date("2026-10-06T00:00:00.000Z"), reason: "Medical appointment", availableStartHour: 9, availableEndHour: 13, approvedById: admin.id, approvedAt: new Date("2026-09-05T00:00:00.000Z"), auditMetadata: null, version: 1, createdAt: new Date("2026-09-05T00:00:00.000Z"), updatedAt: new Date("2026-09-05T00:00:00.000Z") };
    const exception = { id: "10000000-0000-4000-8000-000000000074", bdId: bd.id, type: "PROVISIONAL", reason: "Data migration requires review.", effectiveFrom: new Date("2026-09-05T00:00:00.000Z"), expiresAt: new Date("2026-10-01T00:00:00.000Z"), createdById: admin.id, revokedAt: null, revokedById: null, revocationReason: null, auditMetadata: null, version: 1, createdAt: new Date("2026-09-05T00:00:00.000Z"), updatedAt: new Date("2026-09-05T00:00:00.000Z") };
    const database: any = {
      $transaction: async (work: any) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue(bd) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(target), findUnique: vi.fn().mockResolvedValue(target), updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(holiday), findUnique: vi.fn().mockResolvedValue(holiday), updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(leave), findUnique: vi.fn().mockResolvedValue(leave), updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      performanceLeaderboardException: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(exception), findUnique: vi.fn().mockResolvedValue(exception), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-05T12:00:00.000Z"));

    await expect(service.createBdTargetSchedule(admin, { bdId: bd.id, dailyTarget: 80 })).resolves.toMatchObject({ dailyTarget: 80, version: 1 });
    await expect(service.updateBdTargetSchedule(admin, target.id, { bdId: bd.id, dailyTarget: 85, effectiveFrom: "2026-10-01T00:00:00.000Z", expectedVersion: 1 })).resolves.toMatchObject({ id: target.id });
    await expect(service.deleteBdTargetSchedule(admin, target.id, { expectedVersion: 1 })).resolves.toBeUndefined();
    await expect(service.createPerformanceHoliday(admin, { holidayDate: "2026-09-23", name: "Pakistan Day" })).resolves.toMatchObject({ name: "Pakistan Day", version: 1 });
    await expect(service.updatePerformanceHoliday(admin, holiday.id, { holidayDate: "2026-09-24", name: "Observed Pakistan Day", expectedVersion: 1 })).resolves.toMatchObject({ id: holiday.id });
    await expect(service.deletePerformanceHoliday(admin, holiday.id, { expectedVersion: 1 })).resolves.toBeUndefined();
    await expect(service.createPerformanceApprovedLeave(admin, { bdId: bd.id, startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z", availableStartHour: 9, availableEndHour: 13 })).resolves.toMatchObject({ availableEndHour: 13, version: 1 });
    await expect(service.updatePerformanceApprovedLeave(admin, leave.id, { bdId: bd.id, startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-06T00:00:00.000Z", availableStartHour: 9, availableEndHour: 13, expectedVersion: 1 })).resolves.toMatchObject({ id: leave.id });
    await expect(service.deletePerformanceApprovedLeave(admin, leave.id, { expectedVersion: 1 })).resolves.toBeUndefined();
    await expect(service.createLeaderboardException(admin, { bdId: bd.id, type: "PROVISIONAL", reason: "Data migration requires review.", expiresAt: "2026-10-01T00:00:00.000Z" })).resolves.toMatchObject({ type: "PROVISIONAL", revokedAt: null });
    await expect(service.revokeLeaderboardException(admin, exception.id, { expectedVersion: 1, reason: "Review completed." })).resolves.toMatchObject({ id: exception.id });
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "performance.leaderboard_exception_revoked" }) }));
  });

  it("records Admin audit outcomes and rejects a correction without a prior audit failure", async () => {
    const lead = { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" };
    const database: any = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead) },
      activityEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const now = new Date("2026-09-05T12:00:00.000Z");
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => now);

    await expect(service.auditLeadRecord(admin, leadId, {
      outcome: "CORRECTED",
      reason: "Updated recruiter email.",
    })).rejects.toThrow("requires a prior audit failure");

    database.activityEvent.findMany.mockResolvedValueOnce([
      { leadId, action: "performance.record_audit_failed", occurredAt: new Date("2026-09-05T09:00:00.000Z") },
    ]);
    await expect(service.auditLeadRecord(admin, leadId, {
      outcome: "CORRECTED",
      reason: "Updated recruiter email.",
    })).resolves.toEqual({
      leadId,
      outcome: "CORRECTED",
      action: "performance.record_corrected",
      occurredAt: now.toISOString(),
    });
    expect(database.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "performance.record_corrected", leadId, entityId: leadId }),
    });
  });

  it("removes qualified credit when an Admin rejects a pending duplicate override", async () => {
    const review = {
      id: reviewId,
      leadId,
      status: "PENDING",
      version: 1,
      createdById: bd.id,
      lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" },
    };
    const persistedReview = {
      ...review,
      status: "REJECTED",
      reviewerId: admin.id,
      reviewReason: "Same requisition and candidate.",
      reviewedAt: "2026-09-05T12:00:00.000Z",
      provisionalCreditResolvedAt: "2026-09-05T12:00:00.000Z",
      updatedAt: new Date("2026-09-05T12:00:00.000Z"),
      version: 2,
    };
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      duplicateReview: {
        findUnique: vi.fn().mockResolvedValueOnce(review).mockResolvedValueOnce(persistedReview),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      jobLead: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.reviewDuplicateOverride(admin, reviewId, {
      status: "REJECTED",
      reviewReason: "Same requisition and candidate.",
      expectedVersion: 1,
    })).resolves.toMatchObject({
      status: "REJECTED",
      reviewerId: admin.id,
      version: 2,
      reviewedAt: "2026-09-05T12:00:00.000Z",
      provisionalCreditResolvedAt: "2026-09-05T12:00:00.000Z",
    });

    expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: leadId },
      data: expect.objectContaining({ duplicateClassification: "CONFIRMED", qualifiedCredit: false }),
    }));
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "performance.duplicate_override_rejected", leadId }),
    }));
  });

  it("drills recruiter responses from the same qualified applied-date cohort as the KPI", async () => {
    const responseLead = {
      id: "response-lead",
      appliedDate: new Date("2026-09-02T00:00:00.000Z"),
      qualifiedCredit: true,
      status: "RESPONSE_RECEIVED",
      interviews: [],
    };
    const noOutcomeLead = {
      id: "no-outcome-lead",
      appliedDate: new Date("2026-09-02T00:00:00.000Z"),
      qualifiedCredit: true,
      status: "APPLIED",
      interviews: [],
    };
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue([responseLead, noOutcomeLead]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.getAdminPerformanceDrilldown(admin, {
      metric: "RECRUITER_RESPONSES", bdId: bd.id,
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z",
    })).resolves.toEqual([
      expect.objectContaining({
        kind: "LEAD",
        lead: expect.objectContaining({ id: responseLead.id, appliedDate: "2026-09-02", status: "RESPONSE_RECEIVED" }),
      }),
    ]);

    expect(database.jobLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        qualifiedCredit: true,
        createdById: bd.id,
        appliedDate: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
      }),
      include: { interviews: { where: { startsAt: { lte: new Date("2026-09-30T00:00:00.000Z") } } }, statusTransitions: true, offers: true },
    }));
  });

  it("drills follow-up SLA work for the active owner after reassignment", async () => {
    const replacementBdId = "10000000-0000-4000-8000-000000000007";
    const activeFollowUp = {
      id: "active-follow-up",
      ownerId: replacementBdId,
      originalOwnerId: bd.id,
      status: "COMPLETED",
      recruiterRespondedAt: new Date("2026-09-02T00:00:00.000Z"),
      completedAt: new Date("2026-09-03T00:00:00.000Z"),
      slaDueAt: new Date("2026-09-04T00:00:00.000Z"),
    };
    const database: any = {
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([activeFollowUp]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-05T00:00:00.000Z"));

    await expect(service.getAdminPerformanceDrilldown(admin, {
      metric: "FOLLOW_UP_SLA", bdId: replacementBdId,
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z",
    })).resolves.toEqual([
      expect.objectContaining({
        kind: "FOLLOW_UP",
        followUp: expect.objectContaining({
          id: activeFollowUp.id,
          ownerId: replacementBdId,
          status: "COMPLETED",
          recruiterRespondedAt: "2026-09-02T00:00:00.000Z",
          completedAt: "2026-09-03T00:00:00.000Z",
        }),
      }),
    ]);

    expect(database.performanceFollowUp.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerId: replacementBdId,
        OR: expect.arrayContaining([
          expect.objectContaining({ originalOwnerId: replacementBdId, recruiterRespondedAt: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") } }),
          expect.objectContaining({ originalOwnerId: { not: replacementBdId } }),
        ]),
      }),
    }));
  });

  it("counts reassigned follow-up SLA work in the replacement BD's current reporting period", async () => {
    const replacementBd = {
      ...bd,
      id: "10000000-0000-4000-8000-000000000008",
      displayName: "Replacement BD",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    const reassignedFollowUp = {
      id: "cross-period-follow-up",
      ownerId: replacementBd.id,
      originalOwnerId: bd.id,
      status: "COMPLETED",
      recruiterRespondedAt: new Date("2026-08-30T09:00:00.000Z"),
      reassignedAt: new Date("2026-09-02T09:00:00.000Z"),
      slaResumedAt: new Date("2026-09-02T09:00:00.000Z"),
      slaDueAt: new Date("2026-09-04T09:00:00.000Z"),
      completedAt: new Date("2026-09-03T09:00:00.000Z"),
      breachedAt: null,
    };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([replacementBd]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: {
        findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          const ranges = Array.isArray(where.OR) ? where.OR : [];
          const selectsResumedSla = JSON.stringify(ranges).includes('"slaResumedAt":{"gte":"2026-09-01T00:00:00.000Z","lte":"2026-09-30T00:00:00.000Z"}');
          return Promise.resolve(selectsResumedSla ? [reassignedFollowUp] : []);
        }),
      },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));
    vi.spyOn(service, "evaluateOverdueSlas").mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 });
    const period = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" };

    const performance = await service.getBdPerformance(replacementBd, period);
    const drilldown = await service.getAdminPerformanceDrilldown(admin, {
      ...period,
      metric: "FOLLOW_UP_SLA",
      bdId: replacementBd.id,
    });

    expect(performance.performance.followUpSlaCompliancePercent).toBe(100);
    expect(drilldown).toEqual([
      expect.objectContaining({
        kind: "FOLLOW_UP",
        followUp: expect.objectContaining({ id: reassignedFollowUp.id, ownerId: replacementBd.id }),
      }),
    ]);
  });

  it("pauses the original BD SLA and starts Admin reassignment SLA when a response arrives during leave", async () => {
    const respondedAt = new Date("2026-09-07T09:00:00.000Z");
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      jobLead: { findUnique: vi.fn().mockResolvedValue({ id: leadId, profileId: "10000000-0000-4000-8000-000000000005", currentOwnerId: bd.id, jobTitle: "Platform Engineer" }) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({
        businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17,
        followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2,
      }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([{ startsAt: new Date("2026-09-07T00:00:00.000Z"), endsAt: new Date("2026-09-08T00:00:00.000Z") }]) },
      performanceFollowUp: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "10000000-0000-4000-8000-000000000006" }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn(), assertProfileAccess: vi.fn() } as never, undefined, () => respondedAt);

    await service.recordRecruiterResponse(bd, leadId, respondedAt);

    expect(database.performanceFollowUp.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerId: bd.id,
        originalOwnerId: bd.id,
        status: "NEEDS_REASSIGNMENT",
        slaPausedAt: respondedAt,
        adminReassignmentSlaStartedAt: respondedAt,
      }),
    }));
  });

  it("starts the new owner's SLA only when Admin reassigns a paused follow-up", async () => {
    const reassignedAt = new Date("2026-09-08T09:00:00.000Z");
    const newOwnerId = "10000000-0000-4000-8000-000000000007";
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue({ id: newOwnerId, role: "BD", isActive: true }) },
      performanceFollowUp: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", version: 1, status: "NEEDS_REASSIGNMENT", ownerId: bd.id, recruiterRespondedAt: new Date("2026-09-07T09:00:00.000Z"), adminReassignmentSlaDueAt: new Date("2026-09-07T11:00:00.000Z"), lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" } })
          .mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", ownerId: newOwnerId, status: "OPEN" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2 }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => reassignedAt);

    await service.reassignFollowUp(admin, "10000000-0000-4000-8000-000000000006", { newOwnerId, expectedVersion: 1 });

    expect(database.performanceFollowUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: newOwnerId, status: "OPEN", slaStartedAt: reassignedAt, slaResumedAt: reassignedAt, adminReassignmentBreachedAt: reassignedAt }),
    }));
  });

  it("uses the rule effective when the replacement BD's SLA starts", async () => {
    const recruiterRespondedAt = new Date("2026-09-01T09:00:00.000Z");
    const reassignedAt = new Date("2026-09-08T09:00:00.000Z");
    const newOwnerId = "10000000-0000-4000-8000-000000000007";
    const effectiveFrom = new Date("2026-09-05T00:00:00.000Z");
    const priorRule = { businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2 };
    const replacementRule = { ...priorRule, followUpSlaBusinessHours: 24 };
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue({ id: newOwnerId, role: "BD", isActive: true }) },
      performanceFollowUp: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", version: 1, status: "NEEDS_REASSIGNMENT", ownerId: bd.id, recruiterRespondedAt, adminReassignmentSlaDueAt: new Date("2026-09-08T11:00:00.000Z"), lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" } })
          .mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", ownerId: newOwnerId, status: "OPEN" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      performanceRuleSet: { findFirst: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(where.effectiveFrom.lte < effectiveFrom ? priorRule : replacementRule)) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => reassignedAt);

    await service.reassignFollowUp(admin, "10000000-0000-4000-8000-000000000006", { newOwnerId, expectedVersion: 1 });

    expect(database.performanceRuleSet.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ effectiveFrom: { lte: reassignedAt } }),
    }));
    expect(database.performanceFollowUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slaDueAt: new Date("2026-09-10T17:00:00.000Z") }),
    }));
  });

  it("records and alerts an overdue Admin reassignment before opening it", async () => {
    const reassignedAt = new Date("2026-09-08T12:00:00.000Z");
    const newOwnerId = "10000000-0000-4000-8000-000000000007";
    const followUpId = "10000000-0000-4000-8000-000000000006";
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: newOwnerId, role: "BD", isActive: true }),
        findMany: vi.fn().mockResolvedValue([{ id: admin.id, email: admin.email }]),
      },
      performanceFollowUp: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: followUpId, version: 1, status: "NEEDS_REASSIGNMENT", ownerId: bd.id, recruiterRespondedAt: new Date("2026-09-07T09:00:00.000Z"), adminReassignmentSlaDueAt: new Date("2026-09-08T11:00:00.000Z"), lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" } })
          .mockResolvedValueOnce({ id: followUpId, ownerId: newOwnerId, status: "OPEN" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2 }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
      outboxEvent: { upsert: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => reassignedAt);

    await service.reassignFollowUp(admin, followUpId, { newOwnerId, expectedVersion: 1 });

    expect(database.performanceFollowUp.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: followUpId, version: 1, status: "NEEDS_REASSIGNMENT" }),
      data: expect.objectContaining({ status: "ADMIN_REASSIGNMENT_OVERDUE", adminReassignmentBreachedAt: reassignedAt }),
    }));
    expect(database.performanceFollowUp.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ id: followUpId, version: 2, status: "ADMIN_REASSIGNMENT_OVERDUE" }),
      data: expect.objectContaining({ status: "OPEN" }),
    }));
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "performance.admin_reassignment_overdue" }) }));
    expect(database.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: `performance-reassignment-overdue:${followUpId}:in-app:${admin.id}` },
    }));
    expect(database.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: `performance-reassignment-overdue:${followUpId}:email:${admin.id}` },
    }));
  });

  it("excludes future approved leave from the original owner's follow-up SLA deadline", async () => {
    const respondedAt = new Date("2026-09-07T09:00:00.000Z");
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      jobLead: { findUnique: vi.fn().mockResolvedValue({ id: leadId, profileId: "10000000-0000-4000-8000-000000000005", currentOwnerId: bd.id, jobTitle: "Platform Engineer" }) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2 }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([{ startsAt: new Date("2026-09-09T00:00:00.000Z"), endsAt: new Date("2026-09-12T00:00:00.000Z") }]) },
      performanceFollowUp: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "10000000-0000-4000-8000-000000000006" }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) }, user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => respondedAt);

    await service.recordRecruiterResponse(bd, leadId, respondedAt);

    expect(database.performanceFollowUp.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slaDueAt: new Date("2026-09-17T17:00:00.000Z") }),
    }));
    expect(database.performanceApprovedLeave.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bdId: bd.id, endsAt: { gt: respondedAt } }),
    }));
  });

  it("excludes future approved leave from the reassigned owner's follow-up SLA deadline", async () => {
    const reassignedAt = new Date("2026-09-07T09:00:00.000Z");
    const newOwnerId = "10000000-0000-4000-8000-000000000007";
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue({ id: newOwnerId, role: "BD", isActive: true }) },
      performanceFollowUp: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", version: 1, status: "NEEDS_REASSIGNMENT", ownerId: bd.id, recruiterRespondedAt: reassignedAt, adminReassignmentSlaDueAt: new Date("2026-09-07T11:00:00.000Z"), lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" } }).mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000006", ownerId: newOwnerId, status: "OPEN" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue({ businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2 }) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([{ startsAt: new Date("2026-09-09T00:00:00.000Z"), endsAt: new Date("2026-09-12T00:00:00.000Z") }]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => reassignedAt);

    await service.reassignFollowUp(admin, "10000000-0000-4000-8000-000000000006", { newOwnerId, expectedVersion: 1 });

    expect(database.performanceFollowUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slaDueAt: new Date("2026-09-17T17:00:00.000Z") }),
    }));
    expect(database.performanceApprovedLeave.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bdId: newOwnerId, endsAt: { gt: reassignedAt } }),
    }));
  });

  it("previews future target and configuration impacts without claiming exact future scores", async () => {
    const rules = {
      id: "10000000-0000-4000-8000-000000000008",
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      expectedVersion: 1,
    };
    const database: any = {
      performanceRuleSet: { findUnique: vi.fn().mockResolvedValue({ ...rules, version: 2 }), findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) }, bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]) }, jobLead: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.previewPerformanceRules(admin, { effectiveFrom: rules.effectiveFrom })).resolves.toMatchObject({
      affectedFrom: rules.effectiveFrom,
      impacts: [],
      projection: { kind: "TARGET_AND_CONFIGURATION", exactFutureScoresAvailable: false },
      configuration: { current: expect.any(Object), proposed: expect.any(Object) },
    });
  });

  it("calculates each BD's affected working-day targets under the current and proposed future rules", async () => {
    const database: any = {
      performanceRuleSet: {
        findMany: vi.fn().mockResolvedValue([{
          effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), effectiveTo: null,
          defaultDailyTarget: 70, workingDays: [1, 2, 3, 4, 5], businessCalendarTimeZone: "UTC",
          workdayStartHour: 9, workdayEndHour: 17,
        }]),
      },
      user: { findMany: vi.fn().mockResolvedValue([bd]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    const preview = await service.previewPerformanceRules(admin, {
      effectiveFrom: "2026-09-07T00:00:00.000Z",
      effectiveTo: "2026-09-09T00:00:00.000Z",
      defaultDailyTarget: 80,
    });

    expect(preview.impacts).toEqual([{
      bdId: bd.id,
      currentTargetApplications: 140,
      proposedTargetApplications: 160,
      targetDelta: 20,
    }]);
    expect(preview.configuration).toMatchObject({ current: { defaultDailyTarget: 70 }, proposed: { defaultDailyTarget: 80 } });
  });

  it("still rejects stale rule updates after previewing", async () => {
    const rules = {
      id: "10000000-0000-4000-8000-000000000008",
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      expectedVersion: 1,
    };
    const database: any = { performanceRuleSet: { findUnique: vi.fn().mockResolvedValue({ ...rules, version: 2 }) } };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.updatePerformanceRules(admin, rules)).rejects.toEqual(new StaleVersionError(1, 2));
    expect(database.performanceRuleSet.updateMany).toBeUndefined();
  });

  it("versions a future rule change instead of mutating the historical rule", async () => {
    const effectiveFrom = "2026-09-08T00:00:00.000Z";
    const created = { id: "10000000-0000-4000-8000-000000000009", effectiveFrom: new Date(effectiveFrom), createdById: admin.id, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database: any = {
      $transaction: async (work: any) => work(database),
      performanceRuleSet: {
        findUnique: vi.fn().mockResolvedValue({ id: "10000000-0000-4000-8000-000000000008", version: 1, createdById: admin.id, effectiveTo: null }),
        findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue(created),
      }, activityEvent: { create: vi.fn().mockResolvedValue(undefined) }, user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-05T00:00:00.000Z"));

    await service.updatePerformanceRules(admin, { id: "10000000-0000-4000-8000-000000000008", expectedVersion: 1, effectiveFrom });

    expect(database.performanceRuleSet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectiveTo: new Date(effectiveFrom) }) }));
    expect(database.performanceRuleSet.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: admin.id, auditMetadata: expect.objectContaining({ supersedesRuleSetId: "10000000-0000-4000-8000-000000000008" }) }) }));
  });

  it("records an outbound recruiter communication as the follow-up completion source", async () => {
    const dueAt = new Date("2026-09-08T12:00:00.000Z");
    const database: any = {
      performanceFollowUp: { findUnique: vi.fn().mockResolvedValue({ id: "10000000-0000-4000-8000-000000000006", ownerId: bd.id, status: "OPEN", version: 1, slaDueAt: dueAt, auditMetadata: null }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);
    const completedAt = new Date("2026-09-08T13:00:00.000Z");

    await service.completeFollowUpFromCommunication(bd, leadId, "10000000-0000-4000-8000-000000000010", completedAt);

    expect(database.performanceFollowUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", completedAt, breachedAt: completedAt, auditMetadata: expect.objectContaining({ completionSource: "communication" }) }) }));
  });

  it("marks a duplicate review overdue once, records an audit marker, and only enqueues alerts once", async () => {
    const followUp = { id: "10000000-0000-4000-8000-000000000006", leadId, lead: { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", jobTitle: "Platform Engineer" } };
    const review = { id: reviewId, leadId, lead: { id: leadId, jobTitle: "Platform Engineer" } };
    const database: any = {
      $transaction: async (work: any) => work(database),
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([followUp]), updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([review]), updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
      user: { findMany: vi.fn().mockResolvedValue([{ id: admin.id, email: admin.email }]) }, outboxEvent: { upsert: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    const at = new Date("2026-09-10T12:00:00.000Z");
    await expect(service.evaluateOverdueSlas(at)).resolves.toEqual({ reassignmentOverdue: 1, reviewOverdue: 1 });
    await expect(service.evaluateOverdueSlas(at)).resolves.toEqual({ reassignmentOverdue: 0, reviewOverdue: 0 });
    expect(database.performanceFollowUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ADMIN_REASSIGNMENT_OVERDUE" }) }));
    expect(database.duplicateReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: reviewId, status: "PENDING", overdueAt: null },
      data: expect.objectContaining({ overdueAt: at }),
    }));
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "performance.duplicate_review_overdue", entityId: reviewId }) }));
    expect(database.outboxEvent.upsert).toHaveBeenCalledTimes(4);
  });

  it("creates the response transition and its follow-up in one retry-safe transaction", async () => {
    const lead = { id: leadId, profileId: "10000000-0000-4000-8000-000000000005", currentOwnerId: bd.id, status: "APPLIED", version: 1, jobTitle: "Platform Engineer" };
    const database: any = {
      $transaction: async (work: any) => work(database), jobLead: { findUnique: vi.fn().mockResolvedValue(lead), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      leadStatusTransition: { create: vi.fn().mockResolvedValue(undefined) }, performanceFollowUp: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "10000000-0000-4000-8000-000000000006" }) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) }, performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-08T09:00:00.000Z"));

    await service.transitionRecruiterResponse(bd, leadId, 1);

    expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RESPONSE_RECEIVED" }) }));
    expect(database.performanceFollowUp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadId, status: "OPEN" }) }));
  });

  it("projects peer summaries without own-only score fields", async () => {
    const peer = { ...bd, id: "10000000-0000-4000-8000-000000000011", displayName: "Peer BD" };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([bd, peer]) }, jobLead: { findMany: vi.fn().mockResolvedValue([]) }, interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) }, bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) }, performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T00:00:00.000Z"));

    const result = await service.getBdPerformance(bd, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
      bdId: bd.id,
    });

    expect(result.peerLeaderboard).toHaveLength(2);
    expect(result.peerLeaderboard[1]).toEqual(expect.objectContaining({ bdId: peer.id, qualifiedApplications: 0, duplicateRate: null }));
    expect(result.peerLeaderboard[1]).not.toHaveProperty("performance");
    expect(result.peerLeaderboard[1]).not.toHaveProperty("currentDailyTarget");
  });

  it("keeps the full team cohort and true rank when a BD supplies their own bdId", async () => {
    const peer = { ...bd, id: "10000000-0000-4000-8000-000000000012", displayName: "Higher-scoring peer" };
    const quality = { recordHealthRate: 100, adminAuditPassRate: 100, duplicateRate: 0 };
    const row = (actor: typeof bd, score: number) => ({
      bdId: actor.id,
      bdName: actor.displayName,
      currentDailyTarget: 70,
      qualifiedApplications: 5,
      performance: {
        balancedScore: score,
        effectiveTargetAttainmentPercent: score,
        maturedOutcomeScorePercent: score,
        followUpSlaCompliancePercent: score,
      },
      quality,
      eligible: true,
      eligibilityProgress: 100,
      ineligibilityReason: null,
      estimatedEligibilityDate: null,
      eligibilitySection: "OFFICIAL" as const,
      warnings: [],
    });
    const database: any = { bdTargetSchedule: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);
    const getRowsForBdPeriod = vi.spyOn(service as any, "getRowsForBdPeriod").mockImplementation(async (query: any) =>
      query.bdId ? [row(bd, 80)] : [row(bd, 80), row(peer, 90)],
    );

    const result = await service.getBdPerformance(bd, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
      bdId: bd.id,
    });

    expect(getRowsForBdPeriod).toHaveBeenCalledWith({ from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });
    expect(result.rank).toBe(2);
    expect(result.peerLeaderboard).toEqual(expect.arrayContaining([
      expect.objectContaining({ bdId: bd.id, rank: 2 }),
      expect.objectContaining({ bdId: peer.id, rank: 1 }),
    ]));
  });

  it("keeps active Admin leaderboard exceptions provisional and ignores expired exceptions", async () => {
    const exception = {
      id: "10000000-0000-4000-8000-000000000075", bdId: bd.id, type: "PROVISIONAL", reason: "Data migration review.",
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      createdById: admin.id, revokedAt: null, revokedById: null, revocationReason: null, auditMetadata: null, version: 1,
      createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([]) }, interviewRound: { findMany: vi.fn().mockResolvedValue([]) }, performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }, performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) }, performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      performanceLeaderboardException: { findMany: vi.fn().mockResolvedValue([exception]) }, duplicateReview: { findMany: vi.fn().mockResolvedValue([]) }, activityEvent: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database), outboxEvent: { upsert: vi.fn() },
    };
    const duringException = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));
    const provisional = await duringException.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });
    expect(provisional.leaderboard).toHaveLength(0);
    expect(provisional.buildingBaseline[0]).toMatchObject({ rank: null, warnings: expect.arrayContaining(["ADMIN_OVERRIDE_PROVISIONAL"]), adminException: { active: true } });

    const afterExpiry = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-10-02T12:00:00.000Z"));
    const normal = await afterExpiry.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });
    expect(normal.leaderboard[0]).toMatchObject({ bdId: bd.id, adminException: null });

    database.performanceLeaderboardException.findMany.mockResolvedValue([{ ...exception, type: "EXCLUDE" }]);
    const excluded = await duringException.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });
    expect(excluded.leaderboard).toHaveLength(0);
    expect(excluded.buildingBaseline).toHaveLength(0);
    expect(excluded.excluded[0]).toMatchObject({
      rank: null,
      eligibilitySection: "EXCLUDED",
      warnings: expect.arrayContaining(["ADMIN_EXCLUDED"]),
      adminException: { type: "EXCLUDE", active: true },
    });
  });

  it("uses each effective rule segment for attainment and score weights", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([bd]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([
        { id: "lead-one", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED" },
        { id: "lead-two", appliedDate: new Date("2026-09-02T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED" },
      ]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "rule-two", effectiveFrom: new Date("2026-09-02T00:00:00.000Z"), effectiveTo: null,
          defaultDailyTarget: 1, businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17,
          slowdownThresholdPercent: 50, slowdownMultiplierPercent: 0, applicationWeightPercent: 50, followUpWeightPercent: 50, outcomeWeightPercent: 0,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "rule-one", effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), effectiveTo: new Date("2026-09-02T00:00:00.000Z"),
            defaultDailyTarget: 1, businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17,
            slowdownThresholdPercent: 100, slowdownMultiplierPercent: 0, applicationWeightPercent: 100, followUpWeightPercent: 0, outcomeWeightPercent: 0,
          },
          {
            id: "rule-two", effectiveFrom: new Date("2026-09-02T00:00:00.000Z"), effectiveTo: null,
            defaultDailyTarget: 1, businessCalendarTimeZone: "UTC", workingDays: [1, 2, 3, 4, 5], workdayStartHour: 9, workdayEndHour: 17,
            slowdownThresholdPercent: 50, slowdownMultiplierPercent: 0, applicationWeightPercent: 50, followUpWeightPercent: 50, outcomeWeightPercent: 0,
          },
        ]),
      },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
      activityEvent: { create: vi.fn() },
      outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-02T12:00:00.000Z"));

    const result = await service.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" });

    const performance = result.buildingBaseline[0].performance as { effectiveTargetAttainmentPercent: number; balancedScore: number | null };
    expect(performance.effectiveTargetAttainmentPercent).toBe(75);
    expect(performance.balancedScore).toBe(75);
  });

  it("keeps an outcome score of zero after the BD initial maturity window even with no matured applications", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([]) }, interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) }, bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) }, $transaction: async (work: any) => work(database),
      activityEvent: { create: vi.fn() }, outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect((result.leaderboard[0].performance as { maturedOutcomeScorePercent: number | null }).maturedOutcomeScorePercent).toBe(0);
    expect(result.leaderboard[0].warnings).toContain("LOW_OUTCOME_SAMPLE");
  });

  it("evaluates overdue SLAs on every Admin performance read", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([]) }, performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) }, $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);
    const evaluate = vi.spyOn(service, "evaluateOverdueSlas").mockResolvedValue({ reassignmentOverdue: 0, reviewOverdue: 0 });

    await service.getAdminBdPerformance(admin, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(evaluate).toHaveBeenCalledOnce();
  });

  it("returns only qualified in-period response leads with no interview for scheduling drill-down", async () => {
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await service.getAdminPerformanceDrilldown(admin, {
      metric: "INTERVIEWS_NEEDING_SCHEDULING", bdId: bd.id,
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z",
    });

    expect(database.jobLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        qualifiedCredit: true, status: "RESPONSE_RECEIVED", createdById: bd.id,
        appliedDate: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
        interviews: { none: { startsAt: { lte: new Date("2026-09-30T00:00:00.000Z") } } },
      }),
    }));
  });

  it("returns the matured zero-point outcome cohort, including APPLIED applications", async () => {
    const maturedApplied = { id: "matured-applied", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED" };
    const youngResponse = { id: "young-response", appliedDate: new Date("2026-09-25T00:00:00.000Z"), qualifiedCredit: true, status: "RESPONSE_RECEIVED" };
    const unqualified = { id: "unqualified", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: false, status: "APPLIED" };
    const database: any = {
      jobLead: { findMany: vi.fn().mockResolvedValue([maturedApplied, youngResponse, unqualified]) },
      performanceRuleSet: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getAdminPerformanceDrilldown(admin, {
      metric: "OUTCOMES", bdId: bd.id,
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z",
    });

    expect(result).toEqual([
      expect.objectContaining({
        kind: "LEAD",
        lead: expect.objectContaining({ id: maturedApplied.id, appliedDate: "2026-09-01", status: "APPLIED" }),
      }),
    ]);
  });

  it("uses the latest active target schedule for the BD current daily target", async () => {
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([]) }, interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: {
        findMany: vi.fn().mockResolvedValue([
          { effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), effectiveTo: new Date("2026-09-15T00:00:00.000Z"), dailyTarget: 10 },
          { effectiveFrom: new Date("2026-09-15T00:00:00.000Z"), effectiveTo: null, dailyTarget: 90 },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getBdPerformance(bd, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(result.currentDailyTarget).toBe(90);
  });

  it("calculates record health from standardized company, platform, recruiter, usable values, and audit correction facts", async () => {
    const healthyRelations = {
      company: { canonicalName: "Orbit" },
      sourceRef: { name: "jobs.example.test" },
      contacts: [{ role: "RECRUITER", isPrimary: true, contact: { name: "Jordan Lee", email: "jordan@recruiting.example" } }],
    };
    const firstLead = { id: "10000000-0000-4000-8000-000000000021", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED", companyName: "Orbit", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/1", duplicateClassification: "NONE", ...healthyRelations };
    const correctedLead = { id: "10000000-0000-4000-8000-000000000022", appliedDate: new Date("2026-09-02T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED", companyName: "Orbit", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/2", duplicateClassification: "NONE", ...healthyRelations, sourceRef: { name: "linkedin.com" } };
    const duplicateLead = { id: "10000000-0000-4000-8000-000000000023", appliedDate: new Date("2026-09-03T00:00:00.000Z"), qualifiedCredit: false, status: "APPLIED", companyName: "Orbit", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/3", duplicateClassification: "CONFIRMED", ...healthyRelations };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([firstLead, correctedLead, duplicateLead]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) }, performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }, performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) }, performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([
        { leadId: firstLead.id, action: "performance.record_audit_passed", occurredAt: new Date("2026-09-04T00:00:00.000Z") },
        { leadId: correctedLead.id, action: "performance.record_audit_failed", occurredAt: new Date("2026-09-04T00:00:00.000Z") },
        { leadId: correctedLead.id, action: "lead.updated", occurredAt: new Date("2026-09-05T00:00:00.000Z") },
      ]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([{ leadId: firstLead.id, status: "PENDING" }, { leadId: duplicateLead.id, status: "REJECTED" }]) },
      $transaction: async (work: any) => work(database), outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getBdPerformance(bd, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(result.quality).toEqual({
      recordHealthRate: 66.7,
      adminAuditPassRate: 50,
      correctionRate: 0,
      confirmedDuplicateRate: 33.3,
      pendingOverrideRate: 33.3,
      rejectedOverrideRate: 33.3,
      duplicateRate: 33.3,
    });
    expect(result.peerLeaderboard[0]).toMatchObject({ recordHealthRate: 66.7, adminAuditPassRate: 50, duplicateRate: 33.3 });
  });

  it("flags broken company mapping, platform detection, and recruiter contact data in record health", async () => {
    const base = {
      appliedDate: new Date("2026-09-01T00:00:00.000Z"),
      qualifiedCredit: true,
      status: "APPLIED",
      companyName: "Orbit",
      jobTitle: "Engineer",
      rawUrl: "https://jobs.example.test/1",
      duplicateClassification: "NONE",
      company: { canonicalName: "Orbit" },
      sourceRef: { name: "jobs.example.test" },
      contacts: [{ role: "RECRUITER", isPrimary: true, contact: { name: "Jordan Lee", email: "jordan@recruiting.example" } }],
    };
    const leads = [
      { ...base, id: "10000000-0000-4000-8000-000000000041", company: { canonicalName: "Unmapped company" } },
      { ...base, id: "10000000-0000-4000-8000-000000000042", sourceRef: { name: "other.example.test" } },
      { ...base, id: "10000000-0000-4000-8000-000000000043", contacts: [{ role: "RECRUITER", isPrimary: true, contact: { name: "Jordan Lee", email: "not-an-email" } }] },
    ];
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue(leads) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) }, performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }, performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) }, performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([]) }, duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database), outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getBdPerformance(bd, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(result.quality.recordHealthRate).toBe(0);
  });

  it("counts only qualified recruiter responses that still need an interview in the scheduling KPI", async () => {
    const qualified = { id: "10000000-0000-4000-8000-000000000031", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: true, status: "RESPONSE_RECEIVED" };
    const duplicate = { id: "10000000-0000-4000-8000-000000000032", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: false, status: "RESPONSE_RECEIVED", duplicateClassification: "CONFIRMED" };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([{ ...bd, createdAt: new Date("2026-08-01T00:00:00.000Z") }]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([qualified, duplicate]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) }, performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }, performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) }, performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) }, performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([]) }, duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database), outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getBdPerformance(bd, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(result.performance.interviewsNeedingScheduling).toBe(1);
  });

  it("versions a started BD target at the next eligible working-day boundary", async () => {
    const current = {
      id: "10000000-0000-4000-8000-000000000081", bdId: bd.id, dailyTarget: 70,
      effectiveFrom: new Date("2026-09-07T00:00:00.000Z"), effectiveTo: null,
      createdById: admin.id, auditMetadata: null, version: 1,
      createdAt: new Date("2026-09-07T00:00:00.000Z"), updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    };
    const replacement = {
      ...current, id: "10000000-0000-4000-8000-000000000082", dailyTarget: 90,
      effectiveFrom: new Date("2026-09-14T00:00:00.000Z"), version: 1,
    };
    const database: any = {
      $transaction: async (work: any) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue(bd) },
      bdTargetSchedule: {
        findUnique: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockImplementation((args: any) => args?.where?.id ? [] : [current]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(replacement),
      },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([{
        holidayDate: new Date("2026-09-11T00:00:00.000Z"),
      }]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-10T12:00:00.000Z"));

    await expect(service.updateBdTargetSchedule(admin, current.id, {
      bdId: bd.id, dailyTarget: 90, effectiveFrom: "2026-09-10T12:00:00.000Z", expectedVersion: 1,
    })).resolves.toMatchObject({ id: replacement.id, dailyTarget: 90, effectiveFrom: "2026-09-14T00:00:00.000Z" });

    expect(database.bdTargetSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: current.id, version: 1 },
      data: expect.objectContaining({ effectiveTo: new Date("2026-09-14T00:00:00.000Z"), version: { increment: 1 } }),
    }));
    expect(database.bdTargetSchedule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bdId: bd.id, dailyTarget: 90, effectiveFrom: new Date("2026-09-14T00:00:00.000Z") }),
    }));
  });

  it("versions each successive started target change without rewriting earlier target history", async () => {
    const first = {
      id: "10000000-0000-4000-8000-000000000085", bdId: bd.id, dailyTarget: 70,
      effectiveFrom: new Date("2026-09-07T00:00:00.000Z"), effectiveTo: new Date("2026-09-11T00:00:00.000Z"),
      createdById: admin.id, auditMetadata: null, version: 1,
      createdAt: new Date("2026-09-07T00:00:00.000Z"), updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    };
    const second = {
      ...first, id: "10000000-0000-4000-8000-000000000086", dailyTarget: 90,
      effectiveFrom: new Date("2026-09-11T00:00:00.000Z"), effectiveTo: null, version: 1,
    };
    const third = {
      ...second, id: "10000000-0000-4000-8000-000000000087", dailyTarget: 100,
      effectiveFrom: new Date("2026-09-17T00:00:00.000Z"), version: 1,
    };
    const database: any = {
      $transaction: async (work: any) => work(database),
      user: { findUnique: vi.fn().mockResolvedValue(bd) },
      bdTargetSchedule: {
        findUnique: vi.fn().mockResolvedValue(second),
        findMany: vi.fn().mockImplementation((args: any) => args?.where?.id ? [first] : [first, second]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(third),
      },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-16T12:00:00.000Z"));

    await expect(service.updateBdTargetSchedule(admin, second.id, {
      bdId: bd.id, dailyTarget: 100, effectiveFrom: "2026-09-16T12:00:00.000Z", expectedVersion: 1,
    })).resolves.toMatchObject({ id: third.id, effectiveFrom: "2026-09-17T00:00:00.000Z" });

    expect(database.bdTargetSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: second.id, version: 1 },
      data: expect.objectContaining({ effectiveTo: new Date("2026-09-17T00:00:00.000Z") }),
    }));
    expect(database.bdTargetSchedule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ effectiveFrom: new Date("2026-09-17T00:00:00.000Z") }),
    }));
  });

  it("starts target and eligibility accumulation when a new BD starts", async () => {
    const newBd = { ...bd, createdAt: new Date("2026-09-25T12:00:00.000Z") };
    const database: any = {
      user: { findMany: vi.fn().mockResolvedValue([newBd]) },
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
      performanceFollowUp: { findMany: vi.fn().mockResolvedValue([]) },
      bdTargetSchedule: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      performanceHoliday: { findMany: vi.fn().mockResolvedValue([]) },
      performanceApprovedLeave: { findMany: vi.fn().mockResolvedValue([]) },
      performanceRuleSet: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      performanceLeaderboardException: { findMany: vi.fn().mockResolvedValue([]) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([]) },
      duplicateReview: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: async (work: any) => work(database),
      outboxEvent: { upsert: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-30T12:00:00.000Z"));

    const result = await service.getAdminBdPerformance(admin, {
      from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z",
    });

    const baseline = result.buildingBaseline[0] as {
      performance: { targetApplications: number };
      eligibilityProgress: number;
    } | undefined;
    expect(baseline?.performance.targetApplications).toBe(280);
    expect(baseline?.eligibilityProgress).toBe(40);
  });

  it("rejects edits and deletion of started holidays and approved leave", async () => {
    const holiday = {
      id: "10000000-0000-4000-8000-000000000083", holidayDate: new Date("2026-09-09T00:00:00.000Z"),
      name: "Past holiday", createdById: admin.id, auditMetadata: null, version: 1,
      createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const leave = {
      id: "10000000-0000-4000-8000-000000000084", bdId: bd.id,
      startsAt: new Date("2026-09-09T09:00:00.000Z"), endsAt: new Date("2026-09-10T17:00:00.000Z"),
      reason: null, availableStartHour: null, availableEndHour: null, approvedById: admin.id,
      approvedAt: new Date("2026-09-01T00:00:00.000Z"), auditMetadata: null, version: 1,
      createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const database: any = {
      user: { findUnique: vi.fn().mockResolvedValue(bd) },
      performanceHoliday: { findUnique: vi.fn().mockResolvedValue(holiday), findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn(), deleteMany: vi.fn() },
      performanceRuleSet: { findFirst: vi.fn().mockResolvedValue(null) },
      performanceApprovedLeave: { findUnique: vi.fn().mockResolvedValue(leave), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn(), deleteMany: vi.fn() },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never, undefined, () => new Date("2026-09-10T12:00:00.000Z"));

    await expect(service.updatePerformanceHoliday(admin, holiday.id, {
      holidayDate: "2026-09-12", name: "Moved holiday", expectedVersion: 1,
    })).rejects.toThrow("historical performance");
    await expect(service.deletePerformanceHoliday(admin, holiday.id, { expectedVersion: 1 })).rejects.toThrow("historical performance");
    await expect(service.updatePerformanceApprovedLeave(admin, leave.id, {
      bdId: bd.id, startsAt: "2026-09-11T09:00:00.000Z", endsAt: "2026-09-11T17:00:00.000Z", expectedVersion: 1,
    })).rejects.toThrow("historical performance");
    await expect(service.deletePerformanceApprovedLeave(admin, leave.id, { expectedVersion: 1 })).rejects.toThrow("historical performance");

    expect(database.performanceHoliday.updateMany).not.toHaveBeenCalled();
    expect(database.performanceHoliday.deleteMany).not.toHaveBeenCalled();
    expect(database.performanceApprovedLeave.updateMany).not.toHaveBeenCalled();
    expect(database.performanceApprovedLeave.deleteMany).not.toHaveBeenCalled();
  });
});
