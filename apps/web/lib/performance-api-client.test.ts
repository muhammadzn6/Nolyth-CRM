import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDuplicateReviews,
  getPerformanceRules,
  previewPerformanceRules,
  reviewDuplicateOverride,
  updatePerformanceRules,
} from "./api-client";

const adminId = "00000000-0000-4000-8000-000000000001";
const bdId = "00000000-0000-4000-8000-000000000002";
const ruleId = "10000000-0000-4000-8000-000000000001";

const input = {
  effectiveFrom: "2026-09-20T00:00:00.000Z",
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
};

const rule = {
  ...input,
  id: ruleId,
  effectiveTo: null,
  auditMetadata: null,
  createdById: adminId,
  version: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const review = {
  id: "30000000-0000-4000-8000-000000000001",
  leadId: "40000000-0000-4000-8000-000000000001",
  classification: "LIKELY",
  status: "PENDING",
  overrideReason: "Role was reposted.",
  reviewerId: null,
  reviewReason: null,
  reviewedAt: null,
  expiresAt: "2026-09-09T00:00:00.000Z",
  overdueAt: null,
  provisionalCreditGranted: true,
  provisionalCreditResolvedAt: null,
  createdById: bdId,
  auditMetadata: null,
  version: 1,
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
  lead: {
    id: "40000000-0000-4000-8000-000000000001",
    profileId: "50000000-0000-4000-8000-000000000001",
    createdById: bdId,
    currentOwnerId: bdId,
    companyName: "Northstar Labs",
    jobTitle: "Platform Engineer",
    appliedDate: "2026-09-06",
    status: "APPLIED",
  },
} as const;

function success(data: unknown) {
  return Response.json({ success: true, data, meta: { requestId: "req_performance" } });
}

describe("performance API client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "https://orbit.example");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.orbit.example/api/v1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses rule and duplicate-review responses through the shared contracts", async () => {
    const configuration = {
      defaultDailyTarget: input.defaultDailyTarget,
      workingDays: input.workingDays,
      businessCalendarTimeZone: input.businessCalendarTimeZone,
      workdayStartHour: input.workdayStartHour,
      workdayEndHour: input.workdayEndHour,
      followUpSlaBusinessHours: input.followUpSlaBusinessHours,
      adminReassignmentSlaBusinessHours: input.adminReassignmentSlaBusinessHours,
      maturityWindowDays: input.maturityWindowDays,
      duplicateLookbackMonths: input.duplicateLookbackMonths,
      applicationWeightPercent: input.applicationWeightPercent,
      followUpWeightPercent: input.followUpWeightPercent,
      outcomeWeightPercent: input.outcomeWeightPercent,
      positiveReplyPoints: input.positiveReplyPoints,
      screeningPoints: input.screeningPoints,
      interviewPoints: input.interviewPoints,
      offerPoints: input.offerPoints,
      slowdownThresholdPercent: input.slowdownThresholdPercent,
      slowdownMultiplierPercent: input.slowdownMultiplierPercent,
    };
    const preview = {
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      affectedFrom: input.effectiveFrom,
      affectedTo: "2027-09-20T00:00:00.000Z",
      projection: { kind: "TARGET_AND_CONFIGURATION", exactFutureScoresAvailable: false, unavailableExactScoreDimensions: ["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"] },
      configuration: { current: configuration, proposed: { ...configuration, defaultDailyTarget: 75 } },
      impacts: [{ bdId, currentTargetApplications: 70, proposedTargetApplications: 75, targetDelta: 5 }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(success(rule))
      .mockResolvedValueOnce(success(preview))
      .mockResolvedValueOnce(success(rule))
      .mockResolvedValueOnce(success([review]))
      .mockResolvedValueOnce(success({ ...review, status: "APPROVED", reviewerId: adminId, reviewReason: "Reposting verified", reviewedAt: "2026-09-06T01:00:00.000Z", provisionalCreditResolvedAt: "2026-09-06T01:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPerformanceRules()).resolves.toMatchObject({ id: ruleId, version: 3 });
    await expect(previewPerformanceRules(input)).resolves.toMatchObject({ impacts: [expect.objectContaining({ targetDelta: 5 })] });
    await expect(updatePerformanceRules({ id: ruleId, expectedVersion: 3, ...input })).resolves.toMatchObject({ id: ruleId });
    await expect(getDuplicateReviews()).resolves.toMatchObject([expect.objectContaining({ id: review.id, provisionalCreditGranted: true })]);
    await expect(reviewDuplicateOverride(review.id, { status: "APPROVED", reviewReason: "Reposting verified", expectedVersion: 1 })).resolves.toMatchObject({ status: "APPROVED" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.orbit.example/api/v1/performance/rules",
      "https://api.orbit.example/api/v1/performance/rules/preview",
      "https://api.orbit.example/api/v1/performance/rules",
      "https://api.orbit.example/api/v1/performance/duplicate-reviews",
      `https://api.orbit.example/api/v1/performance/duplicate-reviews/${review.id}`,
    ]);
  });

  it("preserves structured API errors from performance endpoints", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required", details: [{ path: ["role"] }] },
      meta: { requestId: "req_forbidden" },
    }, { status: 403 })));

    await expect(getPerformanceRules()).rejects.toMatchObject({
      code: "FORBIDDEN",
      requestId: "req_forbidden",
      status: 403,
    });
  });
});
