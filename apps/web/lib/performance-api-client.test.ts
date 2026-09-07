import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePerformanceApprovedLeave,
  deletePerformanceHoliday,
  getDuplicateReviews,
  getBdWorkQueue,
  getPerformanceRules,
  getPerformanceRuleHistory,
  previewPerformanceRules,
  reviewDuplicateOverride,
  updatePerformanceApprovedLeave,
  updatePerformanceHoliday,
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

  it("reads uncapped BD work-queue totals through the shared contract", async () => {
    const queue = {
      recruiterResponses: 127,
      activeApplications: 103,
      openFollowUps: 64,
      platformTotals: [{ platform: "linkedin.com", count: 208 }],
      businessTimeZone: "America/New_York",
      todayPlatformTotals: [{ platform: "linkedin.com", count: 47 }],
      sevenDayApplicationTotals: [
        { date: "2026-09-01", total: 0, platformTotals: [] },
        { date: "2026-09-02", total: 0, platformTotals: [] },
        { date: "2026-09-03", total: 0, platformTotals: [] },
        { date: "2026-09-04", total: 0, platformTotals: [] },
        { date: "2026-09-05", total: 0, platformTotals: [] },
        { date: "2026-09-06", total: 0, platformTotals: [] },
        { date: "2026-09-07", total: 47, platformTotals: [{ platform: "linkedin.com", count: 47 }] },
      ],
      pipelineTotals: { jobsApplied: 208, activeJobs: 103, interviews: 31, offers: 9, placements: 3 },
    };
    const fetchMock = vi.fn().mockResolvedValue(success(queue));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBdWorkQueue()).resolves.toEqual(queue);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orbit.example/api/v1/performance/me/work-queue",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("uses versioned holiday and leave mutations and reads rule history through shared contracts", async () => {
    const holiday = {
      id: "20000000-0000-4000-8000-000000000001",
      holidayDate: "2026-12-25",
      name: "Winter holiday",
      createdById: adminId,
      auditMetadata: { source: "admin" },
      version: 2,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    };
    const leave = {
      id: "30000000-0000-4000-8000-000000000001",
      bdId,
      startsAt: "2026-12-20T09:00:00.000Z",
      endsAt: "2026-12-21T17:00:00.000Z",
      reason: "Conference",
      availableStartHour: 10,
      availableEndHour: 14,
      approvedById: adminId,
      approvedAt: "2026-09-01T00:00:00.000Z",
      auditMetadata: null,
      version: 3,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(success([rule]))
      .mockResolvedValueOnce(success(holiday))
      .mockResolvedValueOnce(success(null))
      .mockResolvedValueOnce(success(leave))
      .mockResolvedValueOnce(success(null));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPerformanceRuleHistory()).resolves.toMatchObject([{ id: ruleId, version: 3 }]);
    await expect(updatePerformanceHoliday(holiday.id, { holidayDate: "2026-12-26", name: "Observed holiday", expectedVersion: 2 })).resolves.toMatchObject({ id: holiday.id });
    await expect(deletePerformanceHoliday(holiday.id, 2)).resolves.toBeUndefined();
    await expect(updatePerformanceApprovedLeave(leave.id, {
      bdId,
      startsAt: leave.startsAt,
      endsAt: leave.endsAt,
      reason: leave.reason,
      availableStartHour: leave.availableStartHour,
      availableEndHour: leave.availableEndHour,
      expectedVersion: 3,
    })).resolves.toMatchObject({ id: leave.id });
    await expect(deletePerformanceApprovedLeave(leave.id, 3)).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => ({ url, method: init?.method ?? "GET" }))).toEqual([
      { url: "https://api.orbit.example/api/v1/performance/rules/history", method: "GET" },
      { url: `https://api.orbit.example/api/v1/performance/admin/holidays/${holiday.id}`, method: "PATCH" },
      { url: `https://api.orbit.example/api/v1/performance/admin/holidays/${holiday.id}`, method: "DELETE" },
      { url: `https://api.orbit.example/api/v1/performance/admin/leaves/${leave.id}`, method: "PATCH" },
      { url: `https://api.orbit.example/api/v1/performance/admin/leaves/${leave.id}`, method: "DELETE" },
    ]);
  });
});
