import {
  performanceDrilldownQuerySchema,
  performancePeriodQuerySchema,
  performanceRuleInputSchema,
  performanceRuleMutationSchema,
  reassignPerformanceFollowUpInputSchema,
  updateDuplicateReviewInputSchema,
} from "@orbit/contracts";

import { AuthorizationError, ConflictError, NotFoundError, StaleVersionError, ValidationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";
import { addBusinessHours, calculateProratedDailyTarget, isEligibleWorkingDay } from "./business-hours";
import { evaluateEligibility } from "./eligibility";
import { getMaturityCohort } from "./maturity";
import { rankLeaderboard } from "./leaderboard";
import { calculateBalancedScore, calculateEffectiveAttainment, calculateOutcomeScore } from "./score";

type Store = {
  findUnique?(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findFirst?(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findMany?(args?: Record<string, unknown>): Promise<ReadonlyArray<Record<string, unknown>>>;
  updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  create?(args: { data: Record<string, unknown> }): Promise<unknown>;
};

export type PerformanceDatabase = {
  duplicateReview: Store;
  jobLead: Store;
  activityEvent: Store;
  performanceRuleSet: Store;
  performanceHoliday: Store;
  performanceApprovedLeave: Store;
  performanceFollowUp: Store;
  bdTargetSchedule: Store;
  interviewRound: Store;
  user: Store;
  $transaction<T>(work: (transaction: PerformanceDatabase) => Promise<T>): Promise<T>;
};

function invalid(issues: unknown): ValidationError {
  return new ValidationError("The request payload is invalid", issues);
}

type NotificationWriter = {
  createInApp(input: {
    idempotencyKey: string;
    recipientUserId: string;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<unknown>;
};

type CalendarRule = {
  businessCalendarTimeZone: string;
  workingDays: number[];
  workdayStartHour: number;
  workdayEndHour: number;
  followUpSlaBusinessHours: number;
  adminReassignmentSlaBusinessHours: number;
};

const fallbackRule: CalendarRule = {
  businessCalendarTimeZone: "UTC",
  workingDays: [1, 2, 3, 4, 5],
  workdayStartHour: 9,
  workdayEndHour: 17,
  followUpSlaBusinessHours: 48,
  adminReassignmentSlaBusinessHours: 2,
};

function asDate(value: unknown): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function iso(value: unknown): string | null {
  const parsed = asDate(value);
  return parsed ? parsed.toISOString() : typeof value === "string" ? value : null;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function outcomeStage(status: unknown): "NONE" | "POSITIVE_REPLY" | "SCREENING" | "INTERVIEW" | "OFFER" {
  switch (status) {
    case "RESPONSE_RECEIVED": return "POSITIVE_REPLY";
    case "INTERVIEWING": return "INTERVIEW";
    case "OFFER_RECEIVED":
    case "OFFER_ACCEPTED":
    case "PLACED":
    case "STARTED": return "OFFER";
    default: return "NONE";
  }
}

export class PerformanceService {
  constructor(
    private readonly database: PerformanceDatabase,
    private readonly authorization: { assertRole(actor: Actor, roles: readonly Actor["role"][]): void },
    private readonly notifications?: NotificationWriter,
    private readonly now = () => new Date(),
  ) {}

  async getAdminBdPerformance(actor: Actor, query: unknown) {
    if (!actor.isActive || actor.role !== "ADMIN") throw new AuthorizationError();
    this.authorization.assertRole(actor, ["ADMIN"]);
    const period = this.parsePeriod(query);
    const rows = await this.performanceRows(period);
    const selected = period.bdId ? rows.filter((row) => row.bdId === period.bdId) : rows;
    const ranked = rankLeaderboard(selected.map((row) => ({
      bdId: row.bdId,
      bdName: row.bdName,
      rankable: row.eligible,
      balancedScore: row.performance.balancedScore,
      effectiveAttainmentPercent: row.performance.effectiveTargetAttainmentPercent,
      maturedOutcomeScorePercent: row.performance.maturedOutcomeScorePercent,
      followUpSlaCompliancePercent: row.performance.followUpSlaCompliancePercent,
    })));
    const byId = new Map(ranked.map((row) => [row.bdId, row]));
    const completed = selected.map((row) => ({ ...row, rank: byId.get(row.bdId)?.rank ?? null }));
    return {
      period: { from: period.from, to: period.to },
      team: this.aggregateKpis(completed.map((row) => row.performance)),
      leaderboard: completed.filter((row) => row.eligible),
      buildingBaseline: completed.filter((row) => !row.eligible),
    };
  }

  async getBdPerformance(actor: Actor, query: unknown) {
    if (!actor.isActive || actor.role !== "BD") throw new AuthorizationError();
    const period = this.parsePeriod(query);
    if (period.bdId && period.bdId !== actor.id) throw new AuthorizationError();
    const adminView = await this.getRowsForBdPeriod(period);
    const self = adminView.find((row) => row.bdId === actor.id);
    if (!self) throw new NotFoundError("The BD performance record was not found");
    const ranked = rankLeaderboard(adminView.map((row) => ({
      bdId: row.bdId,
      bdName: row.bdName,
      rankable: row.eligible,
      balancedScore: row.performance.balancedScore,
      effectiveAttainmentPercent: row.performance.effectiveTargetAttainmentPercent,
      maturedOutcomeScorePercent: row.performance.maturedOutcomeScorePercent,
      followUpSlaCompliancePercent: row.performance.followUpSlaCompliancePercent,
    })));
    const rank = ranked.find((row) => row.bdId === actor.id)?.rank ?? null;
    const nextTarget = await this.database.bdTargetSchedule.findFirst?.({
      where: { bdId: actor.id, effectiveFrom: { gt: new Date(period.to) } },
      orderBy: { effectiveFrom: "asc" },
    });
    return {
      period: { from: period.from, to: period.to },
      currentDailyTarget: self.currentDailyTarget,
      nextTargetChangeEffectiveAt: iso(nextTarget?.effectiveFrom),
      performance: self.performance,
      rank,
      peerLeaderboard: adminView.map((row) => {
        const rankedRow = ranked.find((candidate) => candidate.bdId === row.bdId);
        return { ...row, rank: rankedRow?.rank ?? null };
      }),
    };
  }

  async getPerformanceRules(actor: Actor) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const rule = await this.database.performanceRuleSet.findFirst?.({
      where: { effectiveFrom: { lte: this.now() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: this.now() } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    return rule ? this.ruleSummary(rule) : null;
  }

  async previewPerformanceRules(actor: Actor, input: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = performanceRuleInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    return parsed.data;
  }

  async updatePerformanceRules(actor: Actor, input: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = performanceRuleMutationSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceRuleSet.findUnique?.({ where: { id: parsed.data.id } });
    if (!current) throw new NotFoundError("The performance rule set was not found");
    if (number(current.version) !== parsed.data.expectedVersion) {
      throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    }
    const overlaps = await this.database.performanceRuleSet.findMany?.({
      where: { id: { not: parsed.data.id } },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
    }) ?? [];
    const inputStart = new Date(parsed.data.effectiveFrom).getTime();
    const inputEnd = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    if (overlaps.some((row) => {
      const start = asDate(row.effectiveFrom)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const end = asDate(row.effectiveTo)?.getTime() ?? Number.POSITIVE_INFINITY;
      return inputStart < end && start < inputEnd;
    })) throw new ConflictError("Performance rule effective dates overlap an existing rule set");

    const { id, expectedVersion, ...data } = parsed.data;
    const updated = await this.database.performanceRuleSet.updateMany?.({
      where: { id, version: expectedVersion },
      data: { ...data, createdById: String(current.createdById), version: { increment: 1 } },
    });
    if (!updated?.count) throw new StaleVersionError(expectedVersion, number(current.version));
    const result = await this.database.performanceRuleSet.findUnique?.({ where: { id } });
    if (!result) throw new NotFoundError("The performance rule set was not found");
    await this.database.activityEvent.create?.({
      data: {
        action: "performance.rules_updated", actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
        profileId: null, leadId: null, entityType: "performance_rule_set", entityId: id,
        oldSnapshot: { version: current.version }, newSnapshot: { version: result.version, effectiveFrom: result.effectiveFrom }, metadata: null, requestId: null,
      },
    });
    await this.notifyAdmins(`performance-rules:${id}:${number(result.version)}`, "Performance rules updated", "Performance rules are now effective", id);
    return this.ruleSummary(result);
  }

  async reviewDuplicateOverride(actor: Actor, reviewId: string, input: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = updateDuplicateReviewInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);

    const reviewed = await this.database.$transaction(async (transaction) => {
      const review = await transaction.duplicateReview.findUnique?.({
        where: { id: reviewId },
        include: { lead: true },
      });
      if (!review) throw new NotFoundError("The duplicate review was not found");
      if (review.status !== "PENDING") throw new ConflictError("This duplicate override has already been reviewed");

      const result = await transaction.duplicateReview.updateMany?.({
        where: { id: reviewId, version: parsed.data.expectedVersion, status: "PENDING" },
        data: {
          status: parsed.data.status,
          reviewerId: actor.id,
          reviewReason: parsed.data.reviewReason,
          reviewedAt: new Date(),
          provisionalCreditResolvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (!result?.count) {
        throw new StaleVersionError(parsed.data.expectedVersion, Number(review.version));
      }

      const lead = review.lead as Record<string, unknown> | undefined;
      if (!lead) throw new NotFoundError("The application for this duplicate review was not found");
      const rejected = parsed.data.status === "REJECTED";
      await transaction.jobLead.updateMany?.({
        where: { id: String(lead.id) },
        data: rejected
          ? { duplicateClassification: "CONFIRMED", qualifiedCredit: false, version: { increment: 1 } }
          : { qualifiedCredit: true, version: { increment: 1 } },
      });
      await transaction.activityEvent.create?.({
        data: {
          action: rejected ? "performance.duplicate_override_rejected" : "performance.duplicate_override_approved",
          actorId: actor.id,
          actorNameSnapshot: actor.displayName,
          actorRoleSnapshot: actor.role,
          profileId: String(lead.profileId),
          leadId: String(lead.id),
          entityType: "duplicate_review",
          entityId: reviewId,
          oldSnapshot: { status: "PENDING", qualifiedCredit: Boolean(review.provisionalCreditGranted) },
          newSnapshot: { status: parsed.data.status, qualifiedCredit: !rejected },
          metadata: { reviewReason: parsed.data.reviewReason },
          requestId: null,
        },
      });

      return { ...review, status: parsed.data.status, reviewerId: actor.id, reviewReason: parsed.data.reviewReason };
    });
    const reviewedRecord = reviewed as Record<string, unknown>;
    const rejected = parsed.data.status === "REJECTED";
    await this.notifications?.createInApp({
      idempotencyKey: `performance-duplicate-review:${reviewId}:${parsed.data.expectedVersion + 1}`,
      recipientUserId: String(reviewedRecord.createdById),
      title: rejected ? "Duplicate override rejected" : "Duplicate override approved",
      message: parsed.data.reviewReason,
      relatedEntityType: "lead",
      relatedEntityId: String(reviewedRecord.leadId),
    });
    return reviewed;
  }

  async recordRecruiterResponse(actor: Actor, leadId: string, respondedAt = this.now()) {
    if (!actor.isActive) throw new AuthorizationError();
    const lead = await this.database.jobLead.findUnique?.({ where: { id: leadId } });
    if (!lead) throw new NotFoundError("The application was not found");
    if (actor.role !== "ADMIN" && lead.currentOwnerId !== actor.id) throw new AuthorizationError();
    const existing = await this.database.performanceFollowUp.findUnique?.({ where: { leadId } });
    if (existing) return existing;

    const rule = await this.activeCalendarRule(respondedAt);
    const originalOwnerId = String(lead.currentOwnerId);
    const [holidays, leaves] = await Promise.all([
      this.database.performanceHoliday.findMany?.({}) ?? [],
      this.database.performanceApprovedLeave.findMany?.({ where: { bdId: originalOwnerId, startsAt: { lte: respondedAt }, endsAt: { gt: respondedAt } } }) ?? [],
    ]);
    const schedule = {
      timeZone: rule.businessCalendarTimeZone,
      workingDays: rule.workingDays,
      workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
      holidays: holidays.map((holiday) => new Date(String(holiday.holidayDate))),
      leaves: leaves.flatMap((leave) => {
        const startsAt = asDate(leave.startsAt);
        const endsAt = asDate(leave.endsAt);
        return startsAt && endsAt ? [{
          startsAt,
          endsAt,
          ...(leave.availableStartHour == null || leave.availableEndHour == null ? {} : {
            availableHours: { startHour: Number(leave.availableStartHour), endHour: Number(leave.availableEndHour) },
          }),
        }] : [];
      }),
    };
    const needsReassignment = leaves.length > 0;
    const data = {
      leadId,
      ownerId: originalOwnerId,
      originalOwnerId,
      status: needsReassignment ? "NEEDS_REASSIGNMENT" : "OPEN",
      recruiterRespondedAt: respondedAt,
      slaStartedAt: respondedAt,
      slaPausedAt: needsReassignment ? respondedAt : null,
      slaDueAt: needsReassignment ? null : addBusinessHours(respondedAt, rule.followUpSlaBusinessHours, schedule),
      adminReassignmentSlaStartedAt: needsReassignment ? respondedAt : null,
      adminReassignmentSlaDueAt: needsReassignment
        ? addBusinessHours(respondedAt, rule.adminReassignmentSlaBusinessHours, { ...schedule, leaves: [] })
        : null,
    };
    const created = await this.database.performanceFollowUp.create?.({ data });
    await this.database.activityEvent.create?.({
      data: {
        action: needsReassignment ? "performance.follow_up_needs_reassignment" : "performance.follow_up_created",
        actorId: actor.id,
        actorNameSnapshot: actor.displayName,
        actorRoleSnapshot: actor.role,
        profileId: String(lead.profileId),
        leadId,
        entityType: "performance_follow_up",
        entityId: String((created as Record<string, unknown> | undefined)?.id ?? leadId),
        oldSnapshot: null,
        newSnapshot: { status: data.status, originalOwnerId },
        metadata: { recruiterRespondedAt: respondedAt.toISOString() },
        requestId: null,
      },
    });
    if (needsReassignment) await this.notifyAdmins(
      `performance-reassignment:${leadId}`,
      "Follow-up needs reassignment",
      String(lead.jobTitle),
      leadId,
    );
    return created;
  }

  async reassignFollowUp(actor: Actor, followUpId: string, input: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = reassignPerformanceFollowUpInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const newOwner = await this.database.user.findUnique?.({ where: { id: parsed.data.newOwnerId } });
    if (!newOwner || newOwner.role !== "BD" || !newOwner.isActive) {
      throw new ValidationError("The selected user is not an active BD");
    }
    return this.database.$transaction(async (transaction) => {
      const followUp = await transaction.performanceFollowUp.findUnique?.({ where: { id: followUpId }, include: { lead: true } });
      if (!followUp) throw new NotFoundError("The follow-up was not found");
      if (followUp.status !== "NEEDS_REASSIGNMENT") throw new ConflictError("This follow-up does not need reassignment");
      if (number(followUp.version) !== parsed.data.expectedVersion) {
        throw new StaleVersionError(parsed.data.expectedVersion, number(followUp.version));
      }
      const now = this.now();
      const rule = await this.activeCalendarRule(asDate(followUp.recruiterRespondedAt) ?? now);
      const holidays = await transaction.performanceHoliday.findMany?.({}) ?? [];
      const leaves = await transaction.performanceApprovedLeave.findMany?.({
        where: { bdId: parsed.data.newOwnerId, startsAt: { lte: now }, endsAt: { gt: now } },
      }) ?? [];
      const schedule = {
        timeZone: rule.businessCalendarTimeZone,
        workingDays: rule.workingDays,
        workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
        holidays: holidays.flatMap((row) => asDate(row.holidayDate) ? [asDate(row.holidayDate)!] : []),
        leaves: leaves.flatMap((row) => {
          const startsAt = asDate(row.startsAt); const endsAt = asDate(row.endsAt);
          return startsAt && endsAt ? [{ startsAt, endsAt }] : [];
        }),
      };
      const adminDueAt = asDate(followUp.adminReassignmentSlaDueAt);
      const result = await transaction.performanceFollowUp.updateMany?.({
        where: { id: followUpId, version: parsed.data.expectedVersion, status: "NEEDS_REASSIGNMENT" },
        data: {
          ownerId: parsed.data.newOwnerId,
          status: "OPEN",
          reassignedAt: now,
          reassignedById: actor.id,
          slaResumedAt: now,
          slaStartedAt: now,
          slaDueAt: addBusinessHours(now, rule.followUpSlaBusinessHours, schedule),
          adminReassignmentBreachedAt: adminDueAt && now > adminDueAt ? now : null,
          version: { increment: 1 },
        },
      });
      if (!result?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(followUp.version));
      const lead = followUp.lead as Record<string, unknown> | undefined;
      await transaction.activityEvent.create?.({
        data: {
          action: "performance.follow_up_reassigned", actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
          profileId: lead?.profileId ? String(lead.profileId) : null, leadId: lead?.id ? String(lead.id) : null,
          entityType: "performance_follow_up", entityId: followUpId,
          oldSnapshot: { ownerId: followUp.ownerId, status: followUp.status },
          newSnapshot: { ownerId: parsed.data.newOwnerId, status: "OPEN" },
          metadata: { adminReassignmentSlaMissed: Boolean(adminDueAt && now > adminDueAt) }, requestId: null,
        },
      });
      if (lead) await this.notifications?.createInApp({
        idempotencyKey: `performance-follow-up-assigned:${followUpId}:${number(followUp.version) + 1}`,
        recipientUserId: parsed.data.newOwnerId,
        title: "Follow-up assigned to you",
        message: String(lead.jobTitle),
        relatedEntityType: "lead",
        relatedEntityId: String(lead.id),
      });
      return transaction.performanceFollowUp.findUnique?.({ where: { id: followUpId } });
    });
  }

  async getDuplicateReviewQueue(actor: Actor) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    return this.database.duplicateReview.findMany?.({
      where: { status: "PENDING" },
      include: { lead: true },
      orderBy: { createdAt: "asc" },
    }) ?? [];
  }

  async getAdminPerformanceDrilldown(actor: Actor, query: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = performanceDrilldownQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    if (parsed.data.metric === "DUPLICATE_REVIEWS") {
      return this.database.duplicateReview.findMany?.({
        where: { status: parsed.data.status, createdAt: { gte: from, lte: to }, ...(parsed.data.bdId ? { createdById: parsed.data.bdId } : {}) },
        include: { lead: true }, orderBy: { createdAt: "desc" },
      }) ?? [];
    }
    if (parsed.data.metric === "REASSIGNMENTS" || parsed.data.metric === "FOLLOW_UP_SLA") {
      return this.database.performanceFollowUp.findMany?.({
        where: { recruiterRespondedAt: { gte: from, lte: to }, ...(parsed.data.bdId ? { originalOwnerId: parsed.data.bdId } : {}) },
        include: { lead: true }, orderBy: { recruiterRespondedAt: "desc" },
      }) ?? [];
    }
    return this.database.jobLead.findMany?.({
      where: { appliedDate: { gte: from, lte: to }, ...(parsed.data.bdId ? { createdById: parsed.data.bdId } : {}) },
      orderBy: { appliedDate: "desc" },
    }) ?? [];
  }

  private parsePeriod(query: unknown) {
    const parsed = performancePeriodQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    return parsed.data;
  }

  private async getRowsForBdPeriod(period: { from: string; to: string; bdId?: string }) {
    return this.performanceRows(period);
  }

  private async performanceRows(period: { from: string; to: string; bdId?: string }) {
    const bds = await this.database.user.findMany?.({ where: { role: "BD", isActive: true }, orderBy: { displayName: "asc" } }) ?? [];
    const selected = period.bdId ? bds.filter((bd) => String(bd.id) === period.bdId) : bds;
    return Promise.all(selected.map((bd) => this.performanceRow(bd, period)));
  }

  private async performanceRow(bd: Record<string, unknown>, period: { from: string; to: string }) {
    const from = new Date(period.from); const to = new Date(period.to); const now = this.now();
    const rule = await this.activeCalendarRule(to);
    const [leads, interviews, followUps, targets, holidays, leaves] = await Promise.all([
      this.database.jobLead.findMany?.({ where: { createdById: String(bd.id), appliedDate: { gte: from, lte: to } } }) ?? [],
      this.database.interviewRound.findMany?.({ where: { lead: { createdById: String(bd.id) }, startsAt: { gte: from, lte: to } } }) ?? [],
      this.database.performanceFollowUp.findMany?.({ where: { ownerId: String(bd.id), recruiterRespondedAt: { gte: from, lte: to } } }) ?? [],
      this.database.bdTargetSchedule.findMany?.({ where: { bdId: String(bd.id), effectiveFrom: { lte: to }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] } }) ?? [],
      this.database.performanceHoliday.findMany?.({}) ?? [],
      this.database.performanceApprovedLeave.findMany?.({ where: { bdId: String(bd.id), startsAt: { lte: to }, endsAt: { gt: from } } }) ?? [],
    ]);
    const schedule = {
      timeZone: rule.businessCalendarTimeZone, workingDays: rule.workingDays,
      workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
      holidays: holidays.flatMap((holiday) => asDate(holiday.holidayDate) ? [asDate(holiday.holidayDate)!] : []),
      leaves: leaves.flatMap((leave) => {
        const startsAt = asDate(leave.startsAt); const endsAt = asDate(leave.endsAt);
        return startsAt && endsAt ? [{ startsAt, endsAt, ...(leave.availableStartHour == null || leave.availableEndHour == null ? {} : { availableHours: { startHour: number(leave.availableStartHour), endHour: number(leave.availableEndHour) } }) }] : [];
      }),
    };
    let targetApplications = 0; let eligibleWorkingDays = 0;
    for (let date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
      if (!isEligibleWorkingDay(date, schedule)) continue;
      eligibleWorkingDays += 1;
      const activeTarget = targets.find((target) => {
        const start = asDate(target.effectiveFrom); const end = asDate(target.effectiveTo);
        return Boolean(start && start <= date && (!end || end > date));
      });
      targetApplications += calculateProratedDailyTarget(number(activeTarget?.dailyTarget, 70), date, schedule);
    }
    const qualified = leads.filter((lead) => lead.qualifiedCredit !== false).length;
    const rawTargetAttainmentPercent = targetApplications ? (qualified / targetApplications) * 100 : 0;
    const effectiveTargetAttainmentPercent = calculateEffectiveAttainment(rawTargetAttainmentPercent, number((rule as Record<string, unknown>).slowdownThresholdPercent, 120), number((rule as Record<string, unknown>).slowdownMultiplierPercent, 25));
    const matured = leads.filter((lead) => lead.qualifiedCredit !== false && asDate(lead.appliedDate) && getMaturityCohort({ appliedAt: asDate(lead.appliedDate)!, maturityDays: number((rule as Record<string, unknown>).maturityWindowDays, 21), observedAt: now }).isMatured);
    const maturityElapsed = leads.some((lead) => asDate(lead.appliedDate) && getMaturityCohort({ appliedAt: asDate(lead.appliedDate)!, maturityDays: number((rule as Record<string, unknown>).maturityWindowDays, 21), observedAt: now }).isMatured);
    const eligibleFollowUps = followUps.filter((followUp) => followUp.status !== "NEEDS_REASSIGNMENT" && (asDate(followUp.completedAt) || asDate(followUp.slaDueAt)?.getTime()! <= now.getTime()));
    const metFollowUps = eligibleFollowUps.filter((followUp) => !asDate(followUp.breachedAt)).length;
    const followUpSlaCompliancePercent = eligibleFollowUps.length ? (metFollowUps / eligibleFollowUps.length) * 100 : null;
    const maturedOutcomeScorePercent = maturityElapsed ? calculateOutcomeScore(matured.map((lead) => ({ highestStage: outcomeStage(lead.status) })), {
      POSITIVE_REPLY: number((rule as Record<string, unknown>).positiveReplyPoints, 1), SCREENING: number((rule as Record<string, unknown>).screeningPoints, 2), INTERVIEW: number((rule as Record<string, unknown>).interviewPoints, 3), OFFER: number((rule as Record<string, unknown>).offerPoints, 5),
    }) : null;
    const balanced = calculateBalancedScore({
      effectiveAttainmentPercent: effectiveTargetAttainmentPercent,
      followUpSlaCompliancePercent,
      outcome: { scorePercent: maturedOutcomeScorePercent, maturityElapsed },
      weights: { applications: number((rule as Record<string, unknown>).applicationWeightPercent, 45), followUps: number((rule as Record<string, unknown>).followUpWeightPercent, 25), outcomes: number((rule as Record<string, unknown>).outcomeWeightPercent, 30) },
    });
    const eligibility = evaluateEligibility({ eligibleWorkingDays, initialMaturityElapsed: maturityElapsed, qualifiedApplications: qualified, maturedApplications: matured.length, evaluatedAt: now });
    const performance = {
      qualifiedApplications: qualified, targetApplications: Math.round(targetApplications), rawTargetAttainmentPercent: Math.round(rawTargetAttainmentPercent * 10) / 10,
      effectiveTargetAttainmentPercent, recruiterResponses: leads.filter((lead) => outcomeStage(lead.status) !== "NONE").length,
      interviewsScheduled: interviews.length, interviewsNeedingScheduling: leads.filter((lead) => lead.status === "RESPONSE_RECEIVED").length,
      followUpSlaCompliancePercent: followUpSlaCompliancePercent === null ? null : Math.round(followUpSlaCompliancePercent * 10) / 10,
      maturedOutcomeScorePercent, balancedScore: balanced.score, scoreCoverage: balanced.status,
    };
    return {
      bdId: String(bd.id), bdName: String(bd.displayName), rank: null, eligible: eligibility.eligible, qualifiedApplications: qualified,
      performance, warnings: eligibility.warnings,
      ineligibilityReason: eligibility.reasons[0] ?? null,
      eligibilityProgress: Math.min(100, Math.round((eligibleWorkingDays / 10) * 100)),
      estimatedEligibilityDate: null,
      currentDailyTarget: number(targets.find((target) => asDate(target.effectiveFrom) && asDate(target.effectiveFrom)! <= now)?.dailyTarget, 70),
    };
  }

  private aggregateKpis(rows: Array<Record<string, unknown>>) {
    const total = (key: string) => rows.reduce((sum, row) => sum + number((row as Record<string, unknown>)[key]), 0);
    const count = rows.length || 1;
    const qualifiedApplications = total("qualifiedApplications"); const targetApplications = total("targetApplications");
    const followUpValues = rows.map((row) => (row as { followUpSlaCompliancePercent: number | null }).followUpSlaCompliancePercent).filter((value): value is number => value !== null);
    const outcomeValues = rows.map((row) => (row as { maturedOutcomeScorePercent: number | null }).maturedOutcomeScorePercent).filter((value): value is number => value !== null);
    const scoreValues = rows.map((row) => (row as { balancedScore: number | null }).balancedScore).filter((value): value is number => value !== null);
    const raw = targetApplications ? (qualifiedApplications / targetApplications) * 100 : 0;
    return {
      qualifiedApplications, targetApplications, rawTargetAttainmentPercent: Math.round(raw * 10) / 10, effectiveTargetAttainmentPercent: Math.round(raw * 10) / 10,
      recruiterResponses: total("recruiterResponses"), interviewsScheduled: total("interviewsScheduled"), interviewsNeedingScheduling: total("interviewsNeedingScheduling"),
      followUpSlaCompliancePercent: followUpValues.length ? Math.round((followUpValues.reduce((sum, value) => sum + value, 0) / followUpValues.length) * 10) / 10 : null,
      maturedOutcomeScorePercent: outcomeValues.length ? Math.round((outcomeValues.reduce((sum, value) => sum + value, 0) / outcomeValues.length) * 10) / 10 : null,
      balancedScore: scoreValues.length ? Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 10) / 10 : null,
      scoreCoverage: rows.every((row) => (row as { scoreCoverage: string }).scoreCoverage === "COMPLETE") ? "COMPLETE" : rows.length ? "PARTIAL_MEASUREMENT" : "INSUFFICIENT_DATA",
    };
  }

  private ruleSummary(rule: Record<string, unknown>) {
    return {
      id: String(rule.id), effectiveFrom: iso(rule.effectiveFrom), effectiveTo: iso(rule.effectiveTo), createdById: String(rule.createdById),
      defaultDailyTarget: number(rule.defaultDailyTarget, 70), workingDays: Array.isArray(rule.workingDays) ? rule.workingDays.map(number) : [1, 2, 3, 4, 5],
      businessCalendarTimeZone: String(rule.businessCalendarTimeZone ?? "UTC"), workdayStartHour: number(rule.workdayStartHour, 9), workdayEndHour: number(rule.workdayEndHour, 17),
      followUpSlaBusinessHours: number(rule.followUpSlaBusinessHours, 48), adminReassignmentSlaBusinessHours: number(rule.adminReassignmentSlaBusinessHours, 2), maturityWindowDays: number(rule.maturityWindowDays, 21), duplicateLookbackMonths: number(rule.duplicateLookbackMonths, 6),
      applicationWeightPercent: number(rule.applicationWeightPercent, 45), followUpWeightPercent: number(rule.followUpWeightPercent, 25), outcomeWeightPercent: number(rule.outcomeWeightPercent, 30), positiveReplyPoints: number(rule.positiveReplyPoints, 1), screeningPoints: number(rule.screeningPoints, 2), interviewPoints: number(rule.interviewPoints, 3), offerPoints: number(rule.offerPoints, 5), slowdownThresholdPercent: number(rule.slowdownThresholdPercent, 120), slowdownMultiplierPercent: number(rule.slowdownMultiplierPercent, 25),
      auditMetadata: rule.auditMetadata ?? null, version: number(rule.version, 1), createdAt: iso(rule.createdAt), updatedAt: iso(rule.updatedAt),
    };
  }

  private async activeCalendarRule(at: Date): Promise<CalendarRule> {
    const row = await this.database.performanceRuleSet.findFirst?.({
      where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    return {
      businessCalendarTimeZone: typeof row?.businessCalendarTimeZone === "string" ? row.businessCalendarTimeZone : fallbackRule.businessCalendarTimeZone,
      workingDays: Array.isArray(row?.workingDays) ? row.workingDays.map(Number) : fallbackRule.workingDays,
      workdayStartHour: Number(row?.workdayStartHour ?? fallbackRule.workdayStartHour),
      workdayEndHour: Number(row?.workdayEndHour ?? fallbackRule.workdayEndHour),
      followUpSlaBusinessHours: Number(row?.followUpSlaBusinessHours ?? fallbackRule.followUpSlaBusinessHours),
      adminReassignmentSlaBusinessHours: Number(row?.adminReassignmentSlaBusinessHours ?? fallbackRule.adminReassignmentSlaBusinessHours),
    };
  }

  private async notifyAdmins(idempotencyKey: string, title: string, message: string, leadId: string) {
    if (!this.notifications) return;
    const admins = await this.database.user.findMany?.({ where: { role: "ADMIN", isActive: true }, select: { id: true } }) ?? [];
    await Promise.all(admins.map((admin) => this.notifications!.createInApp({
      idempotencyKey: `${idempotencyKey}:${String(admin.id)}`,
      recipientUserId: String(admin.id),
      title,
      message,
      relatedEntityType: "lead",
      relatedEntityId: leadId,
    })));
  }
}
