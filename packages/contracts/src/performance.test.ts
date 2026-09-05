import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import * as contracts from "./index";

const adminId = "00000000-0000-4000-8000-000000000001";
const bdId = "00000000-0000-4000-8000-000000000002";
const leadId = "00000000-0000-4000-8000-000000000003";
const reviewId = "00000000-0000-4000-8000-000000000004";

function schema(name: string): ZodType {
  const value = (contracts as Record<string, unknown>)[name];
  expect(value, `${name} must be exported`).toBeDefined();
  return value as ZodType;
}

describe("performance contracts", () => {
  it("applies the approved defaults to a new effective-dated rule set", () => {
    expect(
      schema("performanceRuleInputSchema").parse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
      }),
    ).toMatchObject({
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      defaultDailyTarget: 70,
      workingDays: [1, 2, 3, 4, 5],
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
      businessCalendarTimeZone: "UTC",
      workdayStartHour: 9,
      workdayEndHour: 17,
      slowdownThresholdPercent: 120,
      slowdownMultiplierPercent: 25,
    });
  });

  it("requires target schedules to be effective-dated and scoped to one BD", () => {
    expect(
      schema("bdTargetScheduleSchema").parse({
        id: reviewId,
        bdId,
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        effectiveTo: null,
        createdById: adminId,
        createdAt: "2026-09-05T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
        version: 1,
      }),
    ).toMatchObject({ bdId, dailyTarget: 70 });
  });

  it("accepts a persisted reduced approved-leave window and rejects partial windows", () => {
    const leave = schema("performanceApprovedLeaveInputSchema");

    expect(leave.parse({
      bdId,
      startsAt: "2026-09-08T00:00:00.000Z",
      endsAt: "2026-09-09T00:00:00.000Z",
      availableStartHour: 9,
      availableEndHour: 13,
    })).toMatchObject({ availableStartHour: 9, availableEndHour: 13 });
    expect(leave.safeParse({
      bdId,
      startsAt: "2026-09-08T00:00:00.000Z",
      endsAt: "2026-09-09T00:00:00.000Z",
      availableStartHour: 9,
    }).success).toBe(false);
    expect(leave.safeParse({
      bdId,
      startsAt: "2026-09-08T00:00:00.000Z",
      endsAt: "2026-09-09T00:00:00.000Z",
      availableStartHour: 13,
      availableEndHour: 9,
    }).success).toBe(false);
  });

  it("exposes pending duplicate reviews with provisional-credit and audit state", () => {
    expect(
      schema("duplicateReviewSchema").parse({
        id: reviewId,
        leadId,
        classification: "LIKELY",
        status: "PENDING",
        overrideReason: "  The requisition was reposted with a new hiring manager.  ",
        reviewerId: null,
        reviewReason: null,
        reviewedAt: null,
        expiresAt: "2026-09-08T00:00:00.000Z",
        overdueAt: null,
        provisionalCreditGranted: true,
        provisionalCreditResolvedAt: null,
        createdById: bdId,
        createdAt: "2026-09-05T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
        version: 1,
      }),
    ).toMatchObject({
      overrideReason: "The requisition was reposted with a new hiring manager.",
      provisionalCreditGranted: true,
    });
  });

  it("labels rule previews as target-and-configuration projections, not exact future scores", () => {
    expect(
      schema("performanceRulePreviewSchema").parse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        effectiveTo: null,
        affectedFrom: "2026-09-08T00:00:00.000Z",
        affectedTo: "2026-10-08T00:00:00.000Z",
        projection: {
          kind: "TARGET_AND_CONFIGURATION",
          exactFutureScoresAvailable: false,
          unavailableExactScoreDimensions: ["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"],
        },
        configuration: {
          current: { defaultDailyTarget: 70, workingDays: [1, 2, 3, 4, 5], businessCalendarTimeZone: "UTC", workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2, maturityWindowDays: 21, duplicateLookbackMonths: 6, applicationWeightPercent: 45, followUpWeightPercent: 25, outcomeWeightPercent: 30, positiveReplyPoints: 1, screeningPoints: 2, interviewPoints: 3, offerPoints: 5, slowdownThresholdPercent: 120, slowdownMultiplierPercent: 25 },
          proposed: { defaultDailyTarget: 80, workingDays: [1, 2, 3, 4, 5], businessCalendarTimeZone: "UTC", workdayStartHour: 9, workdayEndHour: 17, followUpSlaBusinessHours: 24, adminReassignmentSlaBusinessHours: 4, maturityWindowDays: 14, duplicateLookbackMonths: 3, applicationWeightPercent: 40, followUpWeightPercent: 30, outcomeWeightPercent: 30, positiveReplyPoints: 1, screeningPoints: 2, interviewPoints: 3, offerPoints: 5, slowdownThresholdPercent: 125, slowdownMultiplierPercent: 20 },
        },
        impacts: [],
      }),
    ).toMatchObject({ projection: { exactFutureScoresAvailable: false } });
  });

  it("validates leaderboard drill-down requests and KPI response rows", () => {
    expect(
      schema("performanceDrilldownQuerySchema").parse({
        from: "2026-08-06T00:00:00.000Z",
        to: "2026-09-05T23:59:59.999Z",
        bdId,
        metric: "QUALIFIED_APPLICATIONS",
      }),
    ).toEqual({
      from: "2026-08-06T00:00:00.000Z",
      to: "2026-09-05T23:59:59.999Z",
      bdId,
      metric: "QUALIFIED_APPLICATIONS",
      status: undefined,
    });

    expect(
      schema("performanceLeaderboardRowSchema").parse({
        bdId,
        bdName: "  Ada Lovelace  ",
        rank: 1,
        eligible: true,
        qualifiedApplications: 72,
        performance: {
          qualifiedApplications: 72,
          targetApplications: 70,
          rawTargetAttainmentPercent: 102.86,
          effectiveTargetAttainmentPercent: 102.86,
          recruiterResponses: 8,
          interviewsScheduled: 2,
          interviewsNeedingScheduling: 1,
          followUpSlaCompliancePercent: 100,
          maturedOutcomeScorePercent: 25,
          balancedScore: 68.2,
          scoreCoverage: "COMPLETE",
        },
        quality: {
          recordHealthRate: 100,
          adminAuditPassRate: null,
          correctionRate: 0,
          confirmedDuplicateRate: 0,
          pendingOverrideRate: 0,
          rejectedOverrideRate: 0,
          duplicateRate: 0,
        },
      }),
    ).toMatchObject({ bdName: "Ada Lovelace", rank: 1, eligible: true });
  });

  it("rejects drill-down statuses that do not belong to the selected metric", () => {
    const drilldown = schema("performanceDrilldownQuerySchema");
    const base = {
      from: "2026-08-06T00:00:00.000Z",
      to: "2026-09-05T23:59:59.999Z",
      bdId,
    };

    expect(drilldown.safeParse({ ...base, metric: "DUPLICATE_REVIEWS", status: "OPEN" }).success).toBe(false);
    expect(drilldown.safeParse({ ...base, metric: "FOLLOW_UP_SLA", status: "PENDING" }).success).toBe(false);
    expect(drilldown.safeParse({ ...base, metric: "QUALIFIED_APPLICATIONS", status: "COMPLETED" }).success).toBe(false);
    expect(drilldown.safeParse({ ...base, metric: "DUPLICATE_REVIEWS", status: "PENDING" }).success).toBe(true);
  });

  it("rejects invalid rule-set periods, weight totals, and duplicate working days", () => {
    const ruleSet = schema("performanceRuleInputSchema");

    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        effectiveTo: "2026-09-08T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        applicationWeightPercent: 44,
      }).success,
    ).toBe(false);
    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        workingDays: [1, 1],
      }).success,
    ).toBe(false);
    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        positiveReplyPoints: 0,
      }).success,
    ).toBe(false);
    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        positiveReplyPoints: 3,
        screeningPoints: 2,
      }).success,
    ).toBe(false);
    expect(
      ruleSet.safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        businessCalendarTimeZone: "Not/A_Timezone",
      }).success,
    ).toBe(false);
  });

  it("exposes persisted versions and requires them for performance updates", () => {
    const rule = schema("performanceRuleSchema").parse({
      id: reviewId,
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      effectiveTo: null,
      createdById: adminId,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      version: 1,
    });
    const target = schema("bdTargetScheduleSchema").parse({
      id: reviewId,
      bdId,
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      effectiveTo: null,
      createdById: adminId,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      version: 1,
    });
    const review = schema("duplicateReviewSchema").parse({
      id: reviewId,
      leadId,
      classification: "LIKELY",
      status: "PENDING",
      overrideReason: "Reposted role",
      reviewerId: null,
      reviewReason: null,
      reviewedAt: null,
      expiresAt: null,
      overdueAt: null,
      provisionalCreditGranted: true,
      provisionalCreditResolvedAt: null,
      createdById: bdId,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      version: 1,
    });

    expect(rule).toMatchObject({ version: 1 });
    expect(target).toMatchObject({ version: 1 });
    expect(review).toMatchObject({ version: 1 });
    expect(
      schema("updatePerformanceRuleInputSchema").safeParse({
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      schema("updateBdTargetScheduleInputSchema").safeParse({
        bdId,
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        expectedVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      schema("updateDuplicateReviewInputSchema").safeParse({
        status: "APPROVED",
        reviewReason: "Verified reposting",
      }).success,
    ).toBe(false);
  });

  it("accepts null audit metadata from a persisted performance rule", () => {
    expect(
      schema("performanceRuleSchema").parse({
        id: reviewId,
        effectiveFrom: "2026-09-08T00:00:00.000Z",
        effectiveTo: null,
        createdById: adminId,
        auditMetadata: null,
        createdAt: "2026-09-05T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
        version: 1,
      }),
    ).toMatchObject({ auditMetadata: null });
  });

  it("uses persisted status and classification values in performance queries", () => {
    const query = schema("performanceDrilldownQuerySchema");

    expect(
      query.safeParse({
        from: "2026-08-06T00:00:00.000Z",
        to: "2026-09-05T23:59:59.999Z",
        metric: "REASSIGNMENTS",
        status: "OVERDUE",
      }).success,
    ).toBe(false);
    expect(
      query.parse({
        from: "2026-08-06T00:00:00.000Z",
        to: "2026-09-05T23:59:59.999Z",
        metric: "REASSIGNMENTS",
        status: "ADMIN_REASSIGNMENT_OVERDUE",
      }),
    ).toMatchObject({ status: "ADMIN_REASSIGNMENT_OVERDUE" });
    expect(
      schema("duplicateReviewSchema").safeParse({
        id: reviewId,
        leadId,
        classification: "CONFIRMED",
        status: "PENDING",
        overrideReason: "Reposted role",
        reviewerId: null,
        reviewReason: null,
        reviewedAt: null,
        expiresAt: null,
        provisionalCreditGranted: true,
        provisionalCreditResolvedAt: null,
        createdById: bdId,
        createdAt: "2026-09-05T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
        version: 1,
      }).success,
    ).toBe(false);
  });

  it("validates role-safe performance read and mutation requests", () => {
    expect(schema("performancePeriodQuerySchema").parse({
      from: "2026-08-06T00:00:00.000Z",
      to: "2026-09-05T23:59:59.999Z",
    })).toEqual({ from: "2026-08-06T00:00:00.000Z", to: "2026-09-05T23:59:59.999Z", bdId: undefined });
    expect(schema("reassignPerformanceFollowUpInputSchema").parse({
      newOwnerId: bdId,
      expectedVersion: 2,
    })).toEqual({ newOwnerId: bdId, expectedVersion: 2 });
    expect(schema("performanceRuleMutationSchema").safeParse({
      id: reviewId,
      expectedVersion: 1,
      effectiveFrom: "2026-09-08T00:00:00.000Z",
      unexpected: true,
    }).success).toBe(false);
  });
});
