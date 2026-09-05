import { describe, expect, it, vi } from "vitest";

import { AuthorizationError, StaleVersionError } from "../errors/app-error";
import { PerformanceService } from "./performance.service";

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
    const database: any = {
      $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => work(database),
      duplicateReview: {
        findUnique: vi.fn().mockResolvedValue(review),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      jobLead: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await service.reviewDuplicateOverride(admin, reviewId, {
      status: "REJECTED",
      reviewReason: "Same requisition and candidate.",
      expectedVersion: 1,
    });

    expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: leadId },
      data: expect.objectContaining({ duplicateClassification: "CONFIRMED", qualifiedCredit: false }),
    }));
    expect(database.activityEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "performance.duplicate_override_rejected", leadId }),
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

  it("previews rules without writing and rejects stale rule updates", async () => {
    const rules = {
      id: "10000000-0000-4000-8000-000000000008",
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      expectedVersion: 1,
    };
    const database: any = { performanceRuleSet: { findUnique: vi.fn().mockResolvedValue({ ...rules, version: 2 }) } };
    const service = new PerformanceService(database as never, { assertRole: vi.fn() } as never);

    await expect(service.previewPerformanceRules(admin, { effectiveFrom: rules.effectiveFrom })).resolves.toMatchObject({ defaultDailyTarget: 70 });
    await expect(service.updatePerformanceRules(admin, rules)).rejects.toEqual(new StaleVersionError(1, 2));
    expect(database.performanceRuleSet.updateMany).toBeUndefined();
  });
});
