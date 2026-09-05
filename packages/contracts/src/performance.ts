import { z } from "zod";

import { uuidSchema } from "./common";

const textSchema = z.string().trim().min(1);
const dateTimeSchema = z.iso.datetime();
const percentageSchema = z.number().min(0).max(100);
const nonnegativeNumberSchema = z.number().nonnegative();
const nonnegativeIntegerSchema = z.number().int().nonnegative();
const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .refine((days) => new Set(days).size === days.length, "Working days must be unique");

const performanceRuleInputShape = {
  effectiveFrom: dateTimeSchema,
  effectiveTo: dateTimeSchema.optional(),
  defaultDailyTarget: z.number().int().positive().default(70),
  workingDays: workingDaysSchema.default([1, 2, 3, 4, 5]),
  followUpSlaBusinessHours: z.number().int().positive().default(48),
  adminReassignmentSlaBusinessHours: z.number().int().positive().default(2),
  maturityWindowDays: z.number().int().positive().default(21),
  duplicateLookbackMonths: z.number().int().positive().default(6),
  applicationWeightPercent: percentageSchema.default(45),
  followUpWeightPercent: percentageSchema.default(25),
  outcomeWeightPercent: percentageSchema.default(30),
  positiveReplyPoints: z.number().int().nonnegative().default(1),
  screeningPoints: z.number().int().nonnegative().default(2),
  interviewPoints: z.number().int().nonnegative().default(3),
  offerPoints: z.number().int().nonnegative().default(5),
  slowdownThresholdPercent: z.number().positive().default(120),
  slowdownMultiplierPercent: percentageSchema.default(25),
  auditMetadata: z.record(z.string(), z.unknown()).optional(),
};

export const performanceRuleInputSchema = z
  .strictObject(performanceRuleInputShape)
  .refine(
    ({ applicationWeightPercent, followUpWeightPercent, outcomeWeightPercent }) =>
      applicationWeightPercent + followUpWeightPercent + outcomeWeightPercent === 100,
    { message: "Performance score weights must total 100 percent" },
  )
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const performanceRuleSchema = z
  .strictObject({
    ...performanceRuleInputShape,
    id: uuidSchema,
    effectiveTo: dateTimeSchema.nullable(),
    createdById: uuidSchema,
    version: z.number().int().positive(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .refine(
    ({ applicationWeightPercent, followUpWeightPercent, outcomeWeightPercent }) =>
      applicationWeightPercent + followUpWeightPercent + outcomeWeightPercent === 100,
    { message: "Performance score weights must total 100 percent" },
  )
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const updatePerformanceRuleInputSchema = z
  .strictObject({ ...performanceRuleInputShape, expectedVersion: z.number().int().positive() })
  .refine(
    ({ applicationWeightPercent, followUpWeightPercent, outcomeWeightPercent }) =>
      applicationWeightPercent + followUpWeightPercent + outcomeWeightPercent === 100,
    { message: "Performance score weights must total 100 percent" },
  )
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

const bdTargetScheduleInputShape = {
  bdId: uuidSchema,
  dailyTarget: z.number().int().positive().default(70),
  effectiveFrom: dateTimeSchema,
  effectiveTo: dateTimeSchema.optional(),
  auditMetadata: z.record(z.string(), z.unknown()).optional(),
};

export const bdTargetScheduleInputSchema = z
  .strictObject(bdTargetScheduleInputShape)
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const updateBdTargetScheduleInputSchema = z
  .strictObject({ ...bdTargetScheduleInputShape, expectedVersion: z.number().int().positive() })
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const bdTargetScheduleSchema = z
  .strictObject({
    ...bdTargetScheduleInputShape,
    id: uuidSchema,
    effectiveTo: dateTimeSchema.nullable(),
    createdById: uuidSchema,
    auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    version: z.number().int().positive(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const duplicateReviewSchema = z.strictObject({
  id: uuidSchema,
  leadId: uuidSchema,
  classification: z.enum(["LIKELY"]),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  overrideReason: textSchema,
  reviewerId: uuidSchema.nullable(),
  reviewReason: textSchema.nullable(),
  reviewedAt: dateTimeSchema.nullable(),
  expiresAt: dateTimeSchema.nullable(),
  provisionalCreditGranted: z.boolean(),
  provisionalCreditResolvedAt: dateTimeSchema.nullable(),
  createdById: uuidSchema,
  auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  version: z.number().int().positive(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const updateDuplicateReviewInputSchema = z.strictObject({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewReason: textSchema,
  expectedVersion: z.number().int().positive(),
});

export const performanceKpiSchema = z.strictObject({
  qualifiedApplications: nonnegativeIntegerSchema,
  targetApplications: nonnegativeIntegerSchema,
  rawTargetAttainmentPercent: nonnegativeNumberSchema,
  effectiveTargetAttainmentPercent: nonnegativeNumberSchema,
  recruiterResponses: nonnegativeIntegerSchema,
  interviewsScheduled: nonnegativeIntegerSchema,
  interviewsNeedingScheduling: nonnegativeIntegerSchema,
  followUpSlaCompliancePercent: nonnegativeNumberSchema.nullable(),
  maturedOutcomeScorePercent: nonnegativeNumberSchema.nullable(),
  balancedScore: nonnegativeNumberSchema.nullable(),
  scoreCoverage: z.enum(["COMPLETE", "PARTIAL_MEASUREMENT", "PROVISIONAL", "INSUFFICIENT_DATA"]),
});

export const performanceLeaderboardRowSchema = z.strictObject({
  bdId: uuidSchema,
  bdName: textSchema,
  rank: z.number().int().positive().nullable(),
  eligible: z.boolean(),
  qualifiedApplications: nonnegativeIntegerSchema,
  performance: performanceKpiSchema,
  eligibilityProgress: percentageSchema.optional(),
  ineligibilityReason: textSchema.nullable().optional(),
  estimatedEligibilityDate: dateTimeSchema.nullable().optional(),
  warnings: z.array(z.enum(["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE", "ADMIN_OVERRIDE_PROVISIONAL"])).default([]),
});

export const performanceDrilldownQuerySchema = z
  .strictObject({
    from: dateTimeSchema,
    to: dateTimeSchema,
    bdId: uuidSchema.optional(),
    metric: z.enum([
      "QUALIFIED_APPLICATIONS",
      "TARGET_ATTAINMENT",
      "RECRUITER_RESPONSES",
      "INTERVIEWS_SCHEDULED",
      "INTERVIEWS_NEEDING_SCHEDULING",
      "FOLLOW_UP_SLA",
      "OUTCOMES",
      "DUPLICATE_REVIEWS",
      "REASSIGNMENTS",
    ]),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "OPEN", "COMPLETED", "NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"]).optional(),
  })
  .refine(({ from, to }) => from < to, { message: "Period must end after it starts", path: ["to"] });

export const adminBdPerformanceResponseSchema = z.strictObject({
  period: z.strictObject({ from: dateTimeSchema, to: dateTimeSchema }),
  team: performanceKpiSchema,
  leaderboard: z.array(performanceLeaderboardRowSchema),
  buildingBaseline: z.array(performanceLeaderboardRowSchema),
});

export const bdPerformanceResponseSchema = z.strictObject({
  period: z.strictObject({ from: dateTimeSchema, to: dateTimeSchema }),
  currentDailyTarget: z.number().int().positive(),
  nextTargetChangeEffectiveAt: dateTimeSchema.nullable(),
  performance: performanceKpiSchema,
  rank: z.number().int().positive().nullable(),
  peerLeaderboard: z.array(performanceLeaderboardRowSchema),
});

export type PerformanceRuleSet = z.infer<typeof performanceRuleSchema>;
export type UpdatePerformanceRuleInput = z.infer<typeof updatePerformanceRuleInputSchema>;
export type BdTargetSchedule = z.infer<typeof bdTargetScheduleSchema>;
export type UpdateBdTargetScheduleInput = z.infer<typeof updateBdTargetScheduleInputSchema>;
export type DuplicateReview = z.infer<typeof duplicateReviewSchema>;
export type UpdateDuplicateReviewInput = z.infer<typeof updateDuplicateReviewInputSchema>;
export type PerformanceKpi = z.infer<typeof performanceKpiSchema>;
export type PerformanceLeaderboardRow = z.infer<typeof performanceLeaderboardRowSchema>;
export type PerformanceDrilldownQuery = z.infer<typeof performanceDrilldownQuerySchema>;
export type AdminBdPerformanceResponse = z.infer<typeof adminBdPerformanceResponseSchema>;
export type BdPerformanceResponse = z.infer<typeof bdPerformanceResponseSchema>;
