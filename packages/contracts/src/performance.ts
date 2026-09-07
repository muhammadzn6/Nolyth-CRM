import { z } from "zod";

import { uuidSchema } from "./common";

const textSchema = z.string().trim().min(1);
const dateTimeSchema = z.iso.datetime();
const percentageSchema = z.number().min(0).max(100);
const nonnegativeNumberSchema = z.number().nonnegative();
const nonnegativeIntegerSchema = z.number().int().nonnegative();
const timeZoneSchema = z.string().trim().min(1).refine((timeZone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}, "Business calendar timezone must be a valid IANA timezone");
const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .refine((days) => new Set(days).size === days.length, "Working days must be unique");

const performanceRuleInputShape = {
  effectiveFrom: dateTimeSchema,
  effectiveTo: dateTimeSchema.optional(),
  defaultDailyTarget: z.number().int().positive().default(70),
  workingDays: workingDaysSchema.default([1, 2, 3, 4, 5]),
  businessCalendarTimeZone: timeZoneSchema.default("UTC"),
  workdayStartHour: z.number().int().min(0).max(23).default(9),
  workdayEndHour: z.number().int().min(1).max(24).default(17),
  followUpSlaBusinessHours: z.number().int().positive().default(48),
  adminReassignmentSlaBusinessHours: z.number().int().positive().default(2),
  maturityWindowDays: z.number().int().positive().default(21),
  duplicateLookbackMonths: z.number().int().positive().default(6),
  applicationWeightPercent: percentageSchema.default(45),
  followUpWeightPercent: percentageSchema.default(25),
  outcomeWeightPercent: percentageSchema.default(30),
  positiveReplyPoints: z.number().int().positive().default(1),
  screeningPoints: z.number().int().positive().default(2),
  interviewPoints: z.number().int().positive().default(3),
  offerPoints: z.number().int().positive().default(5),
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
    ({ workdayStartHour, workdayEndHour }) => workdayStartHour < workdayEndHour,
    { message: "Workday must end after it starts", path: ["workdayEndHour"] },
  )
  .refine(
    ({ positiveReplyPoints, screeningPoints, interviewPoints, offerPoints }) =>
      positiveReplyPoints <= screeningPoints
      && screeningPoints <= interviewPoints
      && interviewPoints <= offerPoints,
    { message: "Outcome points must be positive and non-decreasing", path: ["offerPoints"] },
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
    auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
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
    ({ workdayStartHour, workdayEndHour }) => workdayStartHour < workdayEndHour,
    { message: "Workday must end after it starts", path: ["workdayEndHour"] },
  )
  .refine(
    ({ positiveReplyPoints, screeningPoints, interviewPoints, offerPoints }) =>
      positiveReplyPoints <= screeningPoints
      && screeningPoints <= interviewPoints
      && interviewPoints <= offerPoints,
    { message: "Outcome points must be positive and non-decreasing", path: ["offerPoints"] },
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
    ({ workdayStartHour, workdayEndHour }) => workdayStartHour < workdayEndHour,
    { message: "Workday must end after it starts", path: ["workdayEndHour"] },
  )
  .refine(
    ({ positiveReplyPoints, screeningPoints, interviewPoints, offerPoints }) =>
      positiveReplyPoints <= screeningPoints
      && screeningPoints <= interviewPoints
      && interviewPoints <= offerPoints,
    { message: "Outcome points must be positive and non-decreasing", path: ["offerPoints"] },
  )
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

const bdTargetScheduleInputShape = {
  bdId: uuidSchema,
  dailyTarget: z.number().int().positive().default(70),
  effectiveTo: dateTimeSchema.optional(),
  auditMetadata: z.record(z.string(), z.unknown()).optional(),
};

const leaveHourStartSchema = z.number().int().min(0).max(23);
const leaveHourEndSchema = z.number().int().min(1).max(24);
const performanceApprovedLeaveInputShape = {
  bdId: uuidSchema,
  startsAt: dateTimeSchema,
  endsAt: dateTimeSchema,
  reason: z.string().trim().min(1).nullable().optional(),
  availableStartHour: leaveHourStartSchema.nullable().optional(),
  availableEndHour: leaveHourEndSchema.nullable().optional(),
};

const performanceHolidayInputShape = {
  holidayDate: z.iso.date(),
  name: textSchema,
  auditMetadata: z.record(z.string(), z.unknown()).optional(),
};

function validateApprovedLeaveWindow(
  value: { startsAt: string; endsAt: string; availableStartHour?: number | null; availableEndHour?: number | null },
) {
  return value.startsAt < value.endsAt
    && (value.availableStartHour == null) === (value.availableEndHour == null)
    && (value.availableStartHour == null || value.availableStartHour < value.availableEndHour!);
}

export const performanceApprovedLeaveInputSchema = z
  .strictObject(performanceApprovedLeaveInputShape)
  .refine(validateApprovedLeaveWindow, {
    message: "Approved leave must have a valid period and complete reduced availability window",
    path: ["availableEndHour"],
  });

export const performanceApprovedLeaveSchema = z
  .strictObject({
    ...performanceApprovedLeaveInputShape,
    id: uuidSchema,
    availableStartHour: leaveHourStartSchema.nullable(),
    availableEndHour: leaveHourEndSchema.nullable(),
    approvedById: uuidSchema,
    approvedAt: dateTimeSchema,
    auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    version: z.number().int().positive(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .refine(validateApprovedLeaveWindow, {
    message: "Approved leave must have a valid period and complete reduced availability window",
    path: ["availableEndHour"],
  });

export const updatePerformanceApprovedLeaveInputSchema = z
  .strictObject({ ...performanceApprovedLeaveInputShape, expectedVersion: z.number().int().positive() })
  .refine(validateApprovedLeaveWindow, {
    message: "Approved leave must have a valid period and complete reduced availability window",
    path: ["availableEndHour"],
  });

export const performanceHolidayInputSchema = z.strictObject(performanceHolidayInputShape);

export const updatePerformanceHolidayInputSchema = z.strictObject({
  ...performanceHolidayInputShape,
  expectedVersion: z.number().int().positive(),
});

export const performanceHolidaySchema = z.strictObject({
  ...performanceHolidayInputShape,
  id: uuidSchema,
  auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdById: uuidSchema,
  version: z.number().int().positive(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const bdTargetScheduleInputSchema = z.strictObject(bdTargetScheduleInputShape);

export const updateBdTargetScheduleInputSchema = z
  .strictObject({ ...bdTargetScheduleInputShape, effectiveFrom: dateTimeSchema, expectedVersion: z.number().int().positive() })
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

export const performanceVersionInputSchema = z.strictObject({ expectedVersion: z.number().int().positive() });

const leaderboardExceptionInputShape = {
  bdId: uuidSchema,
  type: z.enum(["EXCLUDE", "PROVISIONAL"]),
  reason: textSchema,
  effectiveFrom: dateTimeSchema.optional(),
  expiresAt: dateTimeSchema,
  auditMetadata: z.record(z.string(), z.unknown()).optional(),
};

function validateLeaderboardExceptionPeriod(value: { effectiveFrom?: string; expiresAt: string }) {
  return !value.effectiveFrom || value.effectiveFrom < value.expiresAt;
}

export const performanceLeaderboardExceptionInputSchema = z
  .strictObject(leaderboardExceptionInputShape)
  .refine(validateLeaderboardExceptionPeriod, {
    message: "Leaderboard exception must expire after it begins",
    path: ["expiresAt"],
  });

export const revokePerformanceLeaderboardExceptionInputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  reason: textSchema,
});

export const performanceLeaderboardExceptionSchema = z
  .strictObject({
    ...leaderboardExceptionInputShape,
    id: uuidSchema,
    effectiveFrom: dateTimeSchema,
    createdById: uuidSchema,
    revokedAt: dateTimeSchema.nullable(),
    revokedById: uuidSchema.nullable(),
    revocationReason: textSchema.nullable(),
    auditMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    version: z.number().int().positive(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    active: z.boolean(),
  })
  .refine(validateLeaderboardExceptionPeriod, {
    message: "Leaderboard exception must expire after it begins",
    path: ["expiresAt"],
  });

const optionalBdFilterSchema = z.strictObject({ bdId: uuidSchema.optional() });
export const performanceLeaderboardExceptionListQuerySchema = optionalBdFilterSchema.extend({
  activeOnly: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
});
export const bdTargetScheduleListQuerySchema = optionalBdFilterSchema;
export const performanceApprovedLeaveListQuerySchema = optionalBdFilterSchema;

export const bdTargetScheduleSchema = z
  .strictObject({
    ...bdTargetScheduleInputShape,
    effectiveFrom: dateTimeSchema,
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
  overdueAt: dateTimeSchema.nullable(),
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

export const performanceRecordAuditInputSchema = z.strictObject({
  outcome: z.enum(["PASSED", "CORRECTION_REQUIRED", "CORRECTED"]),
  reason: textSchema,
});

export const performanceRecordAuditSchema = z.strictObject({
  leadId: uuidSchema,
  outcome: z.enum(["PASSED", "CORRECTION_REQUIRED", "CORRECTED"]),
  action: z.enum([
    "performance.record_audit_passed",
    "performance.record_audit_failed",
    "performance.record_corrected",
  ]),
  occurredAt: dateTimeSchema,
});

/** Role-scoped date range for KPI reads. `bdId` is accepted only by Admin endpoints. */
export const performancePeriodQuerySchema = z
  .strictObject({
    from: dateTimeSchema,
    to: dateTimeSchema,
    bdId: uuidSchema.optional(),
  })
  .refine(({ from, to }) => from < to, { message: "Period must end after it starts", path: ["to"] });

export const reassignPerformanceFollowUpInputSchema = z.strictObject({
  newOwnerId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const performanceRuleMutationSchema = z
  .strictObject({
    id: uuidSchema,
    ...performanceRuleInputShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ applicationWeightPercent, followUpWeightPercent, outcomeWeightPercent }) =>
      applicationWeightPercent + followUpWeightPercent + outcomeWeightPercent === 100,
    { message: "Performance score weights must total 100 percent" },
  )
  .refine(
    ({ workdayStartHour, workdayEndHour }) => workdayStartHour < workdayEndHour,
    { message: "Workday must end after it starts", path: ["workdayEndHour"] },
  )
  .refine(
    ({ positiveReplyPoints, screeningPoints, interviewPoints, offerPoints }) =>
      positiveReplyPoints <= screeningPoints
      && screeningPoints <= interviewPoints
      && interviewPoints <= offerPoints,
    { message: "Outcome points must be positive and non-decreasing", path: ["offerPoints"] },
  )
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || effectiveFrom < effectiveTo,
    { message: "Effective period must end after it starts", path: ["effectiveTo"] },
  );

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
  scoreCoveragePercent: percentageSchema,
});

export const performanceQualityIndicatorsSchema = z.strictObject({
  recordHealthRate: percentageSchema.nullable(),
  adminAuditPassRate: percentageSchema.nullable(),
  correctionRate: percentageSchema.nullable(),
  confirmedDuplicateRate: percentageSchema.nullable(),
  pendingOverrideRate: percentageSchema.nullable(),
  rejectedOverrideRate: percentageSchema.nullable(),
  duplicateRate: percentageSchema.nullable(),
});

const platformTotalSchema = z.strictObject({
  platform: textSchema,
  count: nonnegativeIntegerSchema,
});

const sevenDayApplicationTotalsSchema = z.array(z.strictObject({
  date: z.iso.date(),
  total: nonnegativeIntegerSchema,
  platformTotals: z.array(platformTotalSchema),
})).length(7).superRefine((days, context) => {
  days.forEach((day, index) => {
    const platformTotal = day.platformTotals.reduce((total, platform) => total + platform.count, 0);
    if (platformTotal !== day.total) context.addIssue({ code: "custom", message: "Daily platform totals must equal the daily total", path: [index, "total"] });
    if (index > 0 && Date.parse(`${day.date}T00:00:00.000Z`) - Date.parse(`${days[index - 1]!.date}T00:00:00.000Z`) !== 86_400_000) {
      context.addIssue({ code: "custom", message: "Seven-day activity dates must be consecutive", path: [index, "date"] });
    }
  });
});

/** Server-owned BD queue totals. Preview arrays must never be used as these totals. */
export const bdWorkQueueSchema = z.strictObject({
  recruiterResponses: nonnegativeIntegerSchema,
  activeApplications: nonnegativeIntegerSchema,
  openFollowUps: nonnegativeIntegerSchema,
  platformTotals: z.array(platformTotalSchema),
  businessTimeZone: timeZoneSchema,
  todayPlatformTotals: z.array(platformTotalSchema),
  sevenDayApplicationTotals: sevenDayApplicationTotalsSchema,
  pipelineTotals: z.strictObject({
    jobsApplied: nonnegativeIntegerSchema,
    activeJobs: nonnegativeIntegerSchema,
    interviews: nonnegativeIntegerSchema,
    offers: nonnegativeIntegerSchema,
    placements: nonnegativeIntegerSchema,
  }),
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
  eligibilitySection: z.enum(["OFFICIAL", "BUILDING_BASELINE", "EXCLUDED"]),
  warnings: z.array(z.enum(["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE", "ADMIN_OVERRIDE_PROVISIONAL", "ADMIN_EXCLUDED"])).default([]),
  adminException: performanceLeaderboardExceptionSchema.nullable().optional(),
  quality: performanceQualityIndicatorsSchema,
});

/** The only team-performance information a BD may see for another BD. */
export const bdPeerSummarySchema = z.strictObject({
  bdId: uuidSchema,
  bdName: textSchema,
  rank: z.number().int().positive().nullable(),
  qualifiedApplications: nonnegativeIntegerSchema,
  recordHealthRate: percentageSchema.nullable(),
  adminAuditPassRate: percentageSchema.nullable(),
  duplicateRate: percentageSchema.nullable(),
});

/** Self-only eligibility state; it is never included in BD peer rows. */
export const bdPerformanceEligibilitySchema = z.strictObject({
  eligible: z.boolean(),
  eligibilityProgress: percentageSchema,
  ineligibilityReason: z.enum([
    "INSUFFICIENT_ELIGIBLE_WORKING_DAYS",
    "INITIAL_MATURITY_WINDOW_NOT_ELAPSED",
    "ADMIN_OVERRIDE_PROVISIONAL",
    "ADMIN_EXCLUDED",
  ]).nullable(),
  estimatedEligibilityDate: dateTimeSchema.nullable(),
  eligibilitySection: z.enum(["OFFICIAL", "BUILDING_BASELINE", "EXCLUDED"]),
  warnings: z.array(z.enum(["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE", "ADMIN_OVERRIDE_PROVISIONAL", "ADMIN_EXCLUDED"])),
});

export const performanceLeadSummarySchema = z.strictObject({
  id: uuidSchema,
  profileId: uuidSchema,
  createdById: uuidSchema,
  currentOwnerId: uuidSchema,
  companyName: textSchema,
  jobTitle: textSchema,
  appliedDate: z.iso.date(),
  status: z.enum(["APPLIED", "RESPONSE_RECEIVED", "INTERVIEWING", "OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED", "CLOSED"]),
});

export const performanceFollowUpSchema = z.strictObject({
  id: uuidSchema,
  leadId: uuidSchema,
  ownerId: uuidSchema,
  originalOwnerId: uuidSchema,
  status: z.enum(["OPEN", "COMPLETED", "NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"]),
  recruiterRespondedAt: dateTimeSchema,
  slaStartedAt: dateTimeSchema,
  slaPausedAt: dateTimeSchema.nullable(),
  slaResumedAt: dateTimeSchema.nullable(),
  slaDueAt: dateTimeSchema.nullable(),
  completedAt: dateTimeSchema.nullable(),
  breachedAt: dateTimeSchema.nullable(),
  adminReassignmentSlaStartedAt: dateTimeSchema.nullable(),
  adminReassignmentSlaDueAt: dateTimeSchema.nullable(),
  adminReassignmentBreachedAt: dateTimeSchema.nullable(),
  reassignedAt: dateTimeSchema.nullable(),
  reassignedById: uuidSchema.nullable(),
  auditMetadata: z.record(z.string(), z.unknown()).nullable(),
  version: z.number().int().positive(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const duplicateReviewWithLeadSchema = z.strictObject({
  ...duplicateReviewSchema.shape,
  lead: performanceLeadSummarySchema,
});

export const performanceFollowUpWithLeadSchema = z.strictObject({
  ...performanceFollowUpSchema.shape,
  lead: performanceLeadSummarySchema,
});

export const performanceInterviewDrilldownSchema = z.strictObject({
  id: uuidSchema,
  leadId: uuidSchema,
  roundNumber: z.number().int().positive(),
  roundType: textSchema,
  status: z.string().trim().min(1),
  closerId: uuidSchema,
  startsAt: dateTimeSchema,
  endsAt: dateTimeSchema,
  lead: performanceLeadSummarySchema,
});

export const performanceDrilldownItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("LEAD"), lead: performanceLeadSummarySchema }),
  z.strictObject({ kind: z.literal("FOLLOW_UP"), followUp: performanceFollowUpWithLeadSchema }),
  z.strictObject({ kind: z.literal("DUPLICATE_REVIEW"), review: duplicateReviewWithLeadSchema }),
  z.strictObject({ kind: z.literal("INTERVIEW"), interview: performanceInterviewDrilldownSchema }),
]);

export const performanceDrilldownResponseSchema = z.array(performanceDrilldownItemSchema);

export const performanceRuleImpactSchema = z.strictObject({
  bdId: uuidSchema,
  currentTargetApplications: nonnegativeIntegerSchema,
  proposedTargetApplications: nonnegativeIntegerSchema,
  targetDelta: z.number().int(),
});

const performanceRuleProjectionConfigurationSchema = z.strictObject({
  defaultDailyTarget: z.number().int().positive(),
  workingDays: workingDaysSchema,
  businessCalendarTimeZone: timeZoneSchema,
  workdayStartHour: z.number().int().min(0).max(23),
  workdayEndHour: z.number().int().min(1).max(24),
  followUpSlaBusinessHours: z.number().int().positive(),
  adminReassignmentSlaBusinessHours: z.number().int().positive(),
  maturityWindowDays: z.number().int().positive(),
  duplicateLookbackMonths: z.number().int().positive(),
  applicationWeightPercent: percentageSchema,
  followUpWeightPercent: percentageSchema,
  outcomeWeightPercent: percentageSchema,
  positiveReplyPoints: z.number().int().positive(),
  screeningPoints: z.number().int().positive(),
  interviewPoints: z.number().int().positive(),
  offerPoints: z.number().int().positive(),
  slowdownThresholdPercent: z.number().positive(),
  slowdownMultiplierPercent: percentageSchema,
});

export const performanceRulePreviewSchema = z.strictObject({
  effectiveFrom: dateTimeSchema,
  effectiveTo: dateTimeSchema.nullable(),
  affectedFrom: dateTimeSchema,
  affectedTo: dateTimeSchema,
  projection: z.strictObject({
    kind: z.literal("TARGET_AND_CONFIGURATION"),
    exactFutureScoresAvailable: z.literal(false),
    unavailableExactScoreDimensions: z.array(z.enum(["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"])),
  }),
  configuration: z.strictObject({
    current: performanceRuleProjectionConfigurationSchema,
    proposed: performanceRuleProjectionConfigurationSchema,
  }),
  impacts: z.array(performanceRuleImpactSchema),
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
  .refine(({ from, to }) => from < to, { message: "Period must end after it starts", path: ["to"] })
  .refine(({ metric, status }) => {
    if (!status) return true;
    if (metric === "DUPLICATE_REVIEWS") return ["PENDING", "APPROVED", "REJECTED"].includes(status);
    if (["FOLLOW_UP_SLA", "REASSIGNMENTS"].includes(metric)) return ["OPEN", "COMPLETED", "NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"].includes(status);
    return false;
  }, { message: "The selected status is not valid for this drill-down metric", path: ["status"] });

export const adminBdPerformanceResponseSchema = z.strictObject({
  period: z.strictObject({ from: dateTimeSchema, to: dateTimeSchema }),
  team: performanceKpiSchema,
  leaderboard: z.array(performanceLeaderboardRowSchema),
  buildingBaseline: z.array(performanceLeaderboardRowSchema),
  excluded: z.array(performanceLeaderboardRowSchema),
  quality: performanceQualityIndicatorsSchema,
});

export const bdPerformanceResponseSchema = z.strictObject({
  period: z.strictObject({ from: dateTimeSchema, to: dateTimeSchema }),
  currentDailyTarget: z.number().int().positive(),
  nextTargetChangeEffectiveAt: dateTimeSchema.nullable(),
  performance: performanceKpiSchema,
  rank: z.number().int().positive().nullable(),
  peerLeaderboard: z.array(bdPeerSummarySchema),
  quality: performanceQualityIndicatorsSchema,
  eligibility: bdPerformanceEligibilitySchema,
});

export type PerformanceRuleSet = z.infer<typeof performanceRuleSchema>;
export type UpdatePerformanceRuleInput = z.infer<typeof updatePerformanceRuleInputSchema>;
export type BdTargetSchedule = z.infer<typeof bdTargetScheduleSchema>;
export type PerformanceApprovedLeave = z.infer<typeof performanceApprovedLeaveSchema>;
export type UpdatePerformanceApprovedLeaveInput = z.infer<typeof updatePerformanceApprovedLeaveInputSchema>;
export type PerformanceHoliday = z.infer<typeof performanceHolidaySchema>;
export type PerformanceHolidayInput = z.infer<typeof performanceHolidayInputSchema>;
export type UpdatePerformanceHolidayInput = z.infer<typeof updatePerformanceHolidayInputSchema>;
export type UpdateBdTargetScheduleInput = z.infer<typeof updateBdTargetScheduleInputSchema>;
export type PerformanceVersionInput = z.infer<typeof performanceVersionInputSchema>;
export type PerformanceLeaderboardException = z.infer<typeof performanceLeaderboardExceptionSchema>;
export type PerformanceLeaderboardExceptionInput = z.infer<typeof performanceLeaderboardExceptionInputSchema>;
export type RevokePerformanceLeaderboardExceptionInput = z.infer<typeof revokePerformanceLeaderboardExceptionInputSchema>;
export type DuplicateReview = z.infer<typeof duplicateReviewSchema>;
export type UpdateDuplicateReviewInput = z.infer<typeof updateDuplicateReviewInputSchema>;
export type PerformanceRecordAuditInput = z.infer<typeof performanceRecordAuditInputSchema>;
export type PerformancePeriodQuery = z.infer<typeof performancePeriodQuerySchema>;
export type ReassignPerformanceFollowUpInput = z.infer<typeof reassignPerformanceFollowUpInputSchema>;
export type PerformanceFollowUpWithLead = z.infer<typeof performanceFollowUpWithLeadSchema>;
export type PerformanceRuleMutation = z.infer<typeof performanceRuleMutationSchema>;
export type PerformanceKpi = z.infer<typeof performanceKpiSchema>;
export type PerformanceQualityIndicators = z.infer<typeof performanceQualityIndicatorsSchema>;
export type BdWorkQueue = z.infer<typeof bdWorkQueueSchema>;
export type PerformanceLeaderboardRow = z.infer<typeof performanceLeaderboardRowSchema>;
export type BdPeerSummary = z.infer<typeof bdPeerSummarySchema>;
export type BdPerformanceEligibility = z.infer<typeof bdPerformanceEligibilitySchema>;
export type PerformanceRulePreview = z.infer<typeof performanceRulePreviewSchema>;
export type PerformanceDrilldownQuery = z.infer<typeof performanceDrilldownQuerySchema>;
export type PerformanceDrilldownResponse = z.infer<typeof performanceDrilldownResponseSchema>;
export type AdminBdPerformanceResponse = z.infer<typeof adminBdPerformanceResponseSchema>;
export type BdPerformanceResponse = z.infer<typeof bdPerformanceResponseSchema>;
