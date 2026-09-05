import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import { ValidationError, type PerformanceService } from "@orbit/backend";

import { PerformanceController } from "./performance.controller";

const admin = { id: "10000000-0000-4000-8000-000000000001", displayName: "Admin", email: "admin@orbit.test", role: "ADMIN" as const, isActive: true };
const bd = { id: "10000000-0000-4000-8000-000000000002", displayName: "BD", email: "bd@orbit.test", role: "BD" as const, isActive: true };
const request = (actor: typeof admin | typeof bd = admin) => ({ actor, cookies: {} });
const date = "2026-09-05T00:00:00.000Z";
const period = { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" };
const lead = {
  id: "10000000-0000-4000-8000-000000000010",
  profileId: "10000000-0000-4000-8000-000000000011",
  createdById: bd.id,
  currentOwnerId: bd.id,
  companyName: "Orbit",
  jobTitle: "Platform Engineer",
  appliedDate: "2026-09-01",
  status: "APPLIED" as const,
};
const performance = {
  qualifiedApplications: 4,
  targetApplications: 10,
  rawTargetAttainmentPercent: 40,
  effectiveTargetAttainmentPercent: 40,
  recruiterResponses: 1,
  interviewsScheduled: 1,
  interviewsNeedingScheduling: 0,
  followUpSlaCompliancePercent: 100,
  maturedOutcomeScorePercent: 50,
  balancedScore: 62,
  scoreCoverage: "COMPLETE" as const,
};
const quality = {
  recordHealthRate: 100,
  adminAuditPassRate: null,
  correctionRate: 0,
  confirmedDuplicateRate: 0,
  pendingOverrideRate: 0,
  rejectedOverrideRate: 0,
  duplicateRate: 0,
};
const leaderboardRow = {
  bdId: bd.id,
  bdName: bd.displayName,
  rank: 1,
  eligible: true,
  qualifiedApplications: 4,
  performance,
  warnings: [],
  quality,
};
const rule = {
  id: "10000000-0000-4000-8000-000000000020",
  effectiveFrom: date,
  effectiveTo: null,
  defaultDailyTarget: 70,
  workingDays: [1, 2, 3, 4, 5],
  businessCalendarTimeZone: "UTC",
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
  auditMetadata: null,
  version: 1,
  createdAt: date,
  updatedAt: date,
};
const ruleInput = {
  effectiveFrom: rule.effectiveFrom,
  defaultDailyTarget: rule.defaultDailyTarget,
  workingDays: rule.workingDays,
  businessCalendarTimeZone: rule.businessCalendarTimeZone,
  workdayStartHour: rule.workdayStartHour,
  workdayEndHour: rule.workdayEndHour,
  followUpSlaBusinessHours: rule.followUpSlaBusinessHours,
  adminReassignmentSlaBusinessHours: rule.adminReassignmentSlaBusinessHours,
  maturityWindowDays: rule.maturityWindowDays,
  duplicateLookbackMonths: rule.duplicateLookbackMonths,
  applicationWeightPercent: rule.applicationWeightPercent,
  followUpWeightPercent: rule.followUpWeightPercent,
  outcomeWeightPercent: rule.outcomeWeightPercent,
  positiveReplyPoints: rule.positiveReplyPoints,
  screeningPoints: rule.screeningPoints,
  interviewPoints: rule.interviewPoints,
  offerPoints: rule.offerPoints,
  slowdownThresholdPercent: rule.slowdownThresholdPercent,
  slowdownMultiplierPercent: rule.slowdownMultiplierPercent,
};
const review = {
  id: "10000000-0000-4000-8000-000000000030",
  leadId: lead.id,
  classification: "LIKELY" as const,
  status: "PENDING" as const,
  overrideReason: "Reposted role",
  reviewerId: null,
  reviewReason: null,
  reviewedAt: null,
  expiresAt: null,
  overdueAt: null,
  provisionalCreditGranted: true,
  provisionalCreditResolvedAt: null,
  createdById: bd.id,
  auditMetadata: null,
  version: 1,
  createdAt: date,
  updatedAt: date,
  lead,
};
const followUp = {
  id: "10000000-0000-4000-8000-000000000040",
  leadId: lead.id,
  ownerId: bd.id,
  originalOwnerId: bd.id,
  status: "OPEN" as const,
  recruiterRespondedAt: date,
  slaStartedAt: date,
  slaPausedAt: null,
  slaResumedAt: null,
  slaDueAt: date,
  completedAt: null,
  breachedAt: null,
  adminReassignmentSlaStartedAt: null,
  adminReassignmentSlaDueAt: null,
  adminReassignmentBreachedAt: null,
  reassignedAt: null,
  reassignedById: null,
  auditMetadata: null,
  version: 1,
  createdAt: date,
  updatedAt: date,
  lead,
};
const preview = {
  effectiveFrom: date,
  effectiveTo: null,
  affectedFrom: date,
  affectedTo: "2026-10-05T00:00:00.000Z",
  projection: {
    kind: "TARGET_AND_CONFIGURATION" as const,
    exactFutureScoresAvailable: false as const,
    unavailableExactScoreDimensions: ["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"] as const,
  },
  configuration: {
    current: {
      defaultDailyTarget: 70, workingDays: [1, 2, 3, 4, 5], businessCalendarTimeZone: "UTC", workdayStartHour: 9, workdayEndHour: 17,
      followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2, maturityWindowDays: 21, duplicateLookbackMonths: 6,
      applicationWeightPercent: 45, followUpWeightPercent: 25, outcomeWeightPercent: 30, positiveReplyPoints: 1, screeningPoints: 2,
      interviewPoints: 3, offerPoints: 5, slowdownThresholdPercent: 120, slowdownMultiplierPercent: 25,
    },
    proposed: {
      defaultDailyTarget: 70, workingDays: [1, 2, 3, 4, 5], businessCalendarTimeZone: "UTC", workdayStartHour: 9, workdayEndHour: 17,
      followUpSlaBusinessHours: 48, adminReassignmentSlaBusinessHours: 2, maturityWindowDays: 21, duplicateLookbackMonths: 6,
      applicationWeightPercent: 45, followUpWeightPercent: 25, outcomeWeightPercent: 30, positiveReplyPoints: 1, screeningPoints: 2,
      interviewPoints: 3, offerPoints: 5, slowdownThresholdPercent: 120, slowdownMultiplierPercent: 25,
    },
  },
  impacts: [{ bdId: bd.id, currentTargetApplications: 70, proposedTargetApplications: 70, targetDelta: 0 }],
};
const auditRecord = {
  leadId: lead.id,
  outcome: "PASSED" as const,
  action: "performance.record_audit_passed" as const,
  occurredAt: date,
};

describe("PerformanceController", () => {
  it("validates admin performance filters before reaching the service", async () => {
    const service = { getAdminBdPerformance: vi.fn() };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    expect(() => controller.admin({ from: "not-a-date", to: "2026-09-05T00:00:00.000Z" }, { actor: admin, cookies: {} })).toThrow(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(service.getAdminBdPerformance).not.toHaveBeenCalled();
  });

  it("passes a validated duplicate review decision to the service", async () => {
    const service = { reviewDuplicateOverride: vi.fn().mockResolvedValue({ ...review, status: "APPROVED", reviewerId: admin.id, reviewReason: "Verified reposting", reviewedAt: date, provisionalCreditResolvedAt: date }) };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.review(
      "10000000-0000-4000-8000-000000000002",
      { status: "APPROVED", reviewReason: "Verified reposting", expectedVersion: 1 },
      request(),
    )).resolves.toMatchObject({ status: "APPROVED", reviewerId: admin.id });
    expect(service.reviewDuplicateOverride).toHaveBeenCalledWith(admin, "10000000-0000-4000-8000-000000000002", expect.objectContaining({ status: "APPROVED" }));
  });

  it("validates and returns the explicit Admin record-audit action", async () => {
    const service = { auditLeadRecord: vi.fn().mockResolvedValue(auditRecord) };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.auditRecord(lead.id, { outcome: "PASSED", reason: "All required record fields are verified." }, request())).resolves.toEqual(auditRecord);
    expect(service.auditLeadRecord).toHaveBeenCalledWith(admin, lead.id, {
      outcome: "PASSED",
      reason: "All required record fields are verified.",
    });
  });

  it("validates every performance endpoint response against its shared contract", async () => {
    const service = {
      getAdminBdPerformance: vi.fn().mockResolvedValue({ period, team: performance, leaderboard: [leaderboardRow], buildingBaseline: [], quality }),
      getBdPerformance: vi.fn().mockResolvedValue({ period, currentDailyTarget: 70, nextTargetChangeEffectiveAt: null, performance, rank: 1, peerLeaderboard: [{ bdId: admin.id, bdName: admin.displayName, rank: 1, qualifiedApplications: 4, recordHealthRate: 100, adminAuditPassRate: null, duplicateRate: 0 }], quality }),
      getAdminPerformanceDrilldown: vi.fn().mockResolvedValue([{ kind: "FOLLOW_UP", followUp }]),
      getPerformanceRules: vi.fn().mockResolvedValue(rule),
      previewPerformanceRules: vi.fn().mockResolvedValue(preview),
      updatePerformanceRules: vi.fn().mockResolvedValue(rule),
      getDuplicateReviewQueue: vi.fn().mockResolvedValue([review]),
      reviewDuplicateOverride: vi.fn().mockResolvedValue(review),
      reassignFollowUp: vi.fn().mockResolvedValue(followUp),
      auditLeadRecord: vi.fn().mockResolvedValue(auditRecord),
    };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.admin(period, request())).resolves.toEqual({ period, team: performance, leaderboard: [leaderboardRow], buildingBaseline: [], quality });
    await expect(controller.mine(period, request(bd))).resolves.toMatchObject({ currentDailyTarget: 70, peerLeaderboard: [expect.objectContaining({ bdId: admin.id })] });
    await expect(controller.drilldown({ ...period, metric: "FOLLOW_UP_SLA" }, request())).resolves.toEqual([{ kind: "FOLLOW_UP", followUp }]);
    await expect(controller.rules(request())).resolves.toEqual(rule);
    await expect(controller.previewRules(ruleInput, request())).resolves.toEqual(preview);
    await expect(controller.updateRules({ ...ruleInput, id: rule.id, expectedVersion: 1 }, request())).resolves.toEqual(rule);
    await expect(controller.reviewQueue(request())).resolves.toEqual([review]);
    await expect(controller.review(review.id, { status: "APPROVED", reviewReason: "Verified reposting", expectedVersion: 1 }, request())).resolves.toEqual(review);
    await expect(controller.reassign(followUp.id, { newOwnerId: bd.id, expectedVersion: 1 }, request())).resolves.toEqual(followUp);
    await expect(controller.auditRecord(lead.id, { outcome: "PASSED", reason: "Verified." }, request())).resolves.toEqual(auditRecord);
  });

  it("rejects a private peer field from the BD performance response", async () => {
    const service = {
      getBdPerformance: vi.fn().mockResolvedValue({
        period,
        currentDailyTarget: 70,
        nextTargetChangeEffectiveAt: null,
        performance,
        rank: 1,
        quality,
        peerLeaderboard: [{ bdId: admin.id, bdName: admin.displayName, rank: 1, qualifiedApplications: 4, recordHealthRate: 100, adminAuditPassRate: null, duplicateRate: 0, recruiterEmail: "private@orbit.test" }],
      }),
    };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.mine(period, request(bd))).rejects.toThrow();
  });

  it("rejects contract-breaking fields from every performance response endpoint", async () => {
    const service = {
      getAdminBdPerformance: vi.fn().mockResolvedValue({ period, team: performance, leaderboard: [leaderboardRow], buildingBaseline: [], quality, internalTeamNote: "private" }),
      getBdPerformance: vi.fn().mockResolvedValue({ period, currentDailyTarget: 70, nextTargetChangeEffectiveAt: null, performance, rank: 1, peerLeaderboard: [], quality, internalRankFormula: "private" }),
      getAdminPerformanceDrilldown: vi.fn().mockResolvedValue([{ kind: "FOLLOW_UP", followUp: { ...followUp, internalOwnerEmail: "private@orbit.test" } }]),
      getPerformanceRules: vi.fn().mockResolvedValue({ ...rule, internalAuditTrail: [] }),
      previewPerformanceRules: vi.fn().mockResolvedValue({ ...preview, internalForecast: [] }),
      updatePerformanceRules: vi.fn().mockResolvedValue({ ...rule, internalAuditTrail: [] }),
      getDuplicateReviewQueue: vi.fn().mockResolvedValue([{ ...review, internalReviewerNotes: "private" }]),
      reviewDuplicateOverride: vi.fn().mockResolvedValue({ ...review, internalReviewerNotes: "private" }),
      reassignFollowUp: vi.fn().mockResolvedValue({ ...followUp, internalOwnerEmail: "private@orbit.test" }),
      auditLeadRecord: vi.fn().mockResolvedValue({ ...auditRecord, internalAuditNotes: "private" }),
    };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    await expect(controller.admin(period, request())).rejects.toThrow();
    await expect(controller.mine(period, request(bd))).rejects.toThrow();
    await expect(controller.drilldown({ ...period, metric: "FOLLOW_UP_SLA" }, request())).rejects.toThrow();
    await expect(controller.rules(request())).rejects.toThrow();
    await expect(controller.previewRules(ruleInput, request())).rejects.toThrow();
    await expect(controller.updateRules({ ...ruleInput, id: rule.id, expectedVersion: 1 }, request())).rejects.toThrow();
    await expect(controller.reviewQueue(request())).rejects.toThrow();
    await expect(controller.review(review.id, { status: "APPROVED", reviewReason: "Verified reposting", expectedVersion: 1 }, request())).rejects.toThrow();
    await expect(controller.reassign(followUp.id, { newOwnerId: bd.id, expectedVersion: 1 }, request())).rejects.toThrow();
    await expect(controller.auditRecord(lead.id, { outcome: "PASSED", reason: "Verified." }, request())).rejects.toThrow();
  });

  it("rejects a status that is invalid for a drill-down metric before calling the service", () => {
    const service = { getAdminPerformanceDrilldown: vi.fn() };
    const controller = new PerformanceController(service as unknown as PerformanceService);

    expect(() => controller.drilldown({ ...period, metric: "QUALIFIED_APPLICATIONS", status: "OPEN" }, request())).toThrow(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(service.getAdminPerformanceDrilldown).not.toHaveBeenCalled();
  });
});
