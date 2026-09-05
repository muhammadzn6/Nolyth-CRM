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
  it("derives Screening from a persisted recruiter or pre-screen round before a technical interview", () => {
    expect(outcomeStage("RESPONSE_RECEIVED", [{ roundType: "PRE_SCREEN" }])).toBe("SCREENING");
    expect(outcomeStage("RESPONSE_RECEIVED", [{ roundType: "TECHNICAL" }])).toBe("INTERVIEW");
  });

  it("does not expose the Admin team performance read to a BD", async () => {
    const service = new PerformanceService({} as never, { assertRole: vi.fn() } as never);

    await expect(service.getAdminBdPerformance(bd, {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    })).rejects.toEqual(new AuthorizationError());
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
      include: { interviews: { where: { startsAt: { lte: new Date("2026-09-30T00:00:00.000Z") } } } },
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
        recruiterRespondedAt: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
      }),
    }));
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

    const result = await service.getBdPerformance(bd, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });

    expect(result.peerLeaderboard[1]).toEqual(expect.objectContaining({ bdId: peer.id, qualifiedApplications: 0, duplicateRate: null }));
    expect(result.peerLeaderboard[1]).not.toHaveProperty("performance");
    expect(result.peerLeaderboard[1]).not.toHaveProperty("currentDailyTarget");
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
        interviews: { none: {} },
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

  it("calculates auditable record-health and duplicate quality indicators for Admin and BD views", async () => {
    const firstLead = { id: "10000000-0000-4000-8000-000000000021", appliedDate: new Date("2026-09-01T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED", companyName: "Orbit", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/1", duplicateClassification: "NONE" };
    const correctedLead = { id: "10000000-0000-4000-8000-000000000022", appliedDate: new Date("2026-09-02T00:00:00.000Z"), qualifiedCredit: true, status: "APPLIED", companyName: "Unknown", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/2", duplicateClassification: "NONE" };
    const duplicateLead = { id: "10000000-0000-4000-8000-000000000023", appliedDate: new Date("2026-09-03T00:00:00.000Z"), qualifiedCredit: false, status: "APPLIED", companyName: "Orbit", jobTitle: "Engineer", rawUrl: "https://jobs.example.test/3", duplicateClassification: "CONFIRMED" };
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
      correctionRate: 33.3,
      confirmedDuplicateRate: 33.3,
      pendingOverrideRate: 33.3,
      rejectedOverrideRate: 33.3,
      duplicateRate: 33.3,
    });
    expect(result.peerLeaderboard[0]).toMatchObject({ recordHealthRate: 66.7, adminAuditPassRate: 50, duplicateRate: 33.3 });
  });
});
