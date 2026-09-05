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
      }),
    ).toMatchObject({ bdName: "Ada Lovelace", rank: 1, eligible: true });
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
});
