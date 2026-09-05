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
  upsert?(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, never> }): Promise<unknown>;
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
  leadStatusTransition: Store;
  outboxEvent: Store;
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

export function outcomeStage(status: unknown, interviews: readonly Record<string, unknown>[] = []): "NONE" | "POSITIVE_REPLY" | "SCREENING" | "INTERVIEW" | "OFFER" {
  switch (status) {
    case "OFFER_RECEIVED":
    case "OFFER_ACCEPTED":
    case "PLACED":
    case "STARTED": return "OFFER";
  }
  if (interviews.some((round) => !["PRE_SCREEN", "RECRUITER", "HR"].includes(String(round.roundType)))) return "INTERVIEW";
  if (interviews.some((round) => ["PRE_SCREEN", "RECRUITER", "HR"].includes(String(round.roundType)))) return "SCREENING";
  switch (status) {
    case "INTERVIEWING": return "INTERVIEW";
    case "RESPONSE_RECEIVED": return "POSITIVE_REPLY";
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
    await this.evaluateOverdueSlas();
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
        return {
          bdId: row.bdId,
          bdName: row.bdName,
          rank: rankedRow?.rank ?? null,
          qualifiedApplications: row.qualifiedApplications,
          recordHealthRate: null,
          adminAuditPassRate: null,
          duplicateRate: row.duplicateRate ?? null,
        };
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
    return this.previewRuleImpact(parsed.data);
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
    const effectiveFrom = new Date(parsed.data.effectiveFrom);
    if (effectiveFrom <= this.now()) throw new ConflictError("Performance rule changes must take effect in the future");
    const result = await this.database.$transaction(async (transaction) => {
      const overlaps = await transaction.performanceRuleSet.findMany?.({
        where: { id: { not: parsed.data.id }, effectiveFrom: { gte: effectiveFrom } },
      }) ?? [];
      const inputEnd = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
      if (overlaps.some((row) => {
        const start = asDate(row.effectiveFrom)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const end = asDate(row.effectiveTo)?.getTime() ?? Number.POSITIVE_INFINITY;
        return effectiveFrom.getTime() < end && start < inputEnd;
      })) throw new ConflictError("Performance rule effective dates overlap an existing future rule set");

      const closed = await transaction.performanceRuleSet.updateMany?.({
        where: { id: parsed.data.id, version: parsed.data.expectedVersion, effectiveTo: null },
        data: { effectiveTo: effectiveFrom, version: { increment: 1 } },
      });
      if (!closed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      const { id: _id, expectedVersion: _expectedVersion, ...data } = parsed.data;
      const created = await transaction.performanceRuleSet.create?.({
        data: {
          ...data,
          effectiveFrom,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          createdById: actor.id,
          auditMetadata: { ...(parsed.data.auditMetadata ?? {}), supersedesRuleSetId: String(current.id) },
        },
      }) as Record<string, unknown> | undefined;
      if (!created) throw new NotFoundError("The new performance rule set was not created");
      await transaction.activityEvent.create?.({
        data: {
          action: "performance.rules_versioned", actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
          profileId: null, leadId: null, entityType: "performance_rule_set", entityId: String(created.id),
          oldSnapshot: { id: current.id, version: current.version, effectiveTo: effectiveFrom.toISOString() },
          newSnapshot: { id: created.id, effectiveFrom: created.effectiveFrom }, metadata: { supersedesRuleSetId: String(current.id) }, requestId: null,
        },
      });
      return created;
    });
    await this.notifyAdmins(`performance-rules:${String(result.id)}`, "Performance rules scheduled", "A future performance rule version was scheduled", String(result.id));
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
    return this.database.$transaction((transaction) => this.createRecruiterResponseFollowUp(actor, leadId, respondedAt, transaction));
  }

  /** Used by the response-status endpoint so state transition and SLA record share one transaction. */
  async transitionRecruiterResponse(actor: Actor, leadId: string, expectedVersion: number, reason?: string) {
    if (!actor.isActive || actor.role === "CLOSER") throw new AuthorizationError();
    return this.database.$transaction(async (transaction) => {
      const lead = await transaction.jobLead.findUnique?.({ where: { id: leadId } });
      if (!lead) throw new NotFoundError("The application was not found");
      if (actor.role === "BD" && lead.currentOwnerId !== actor.id) throw new AuthorizationError();
      const existing = await transaction.performanceFollowUp.findUnique?.({ where: { leadId } });
      if (lead.status === "RESPONSE_RECEIVED" && existing) return lead;
      if (lead.status !== "APPLIED") throw new ConflictError("The requested lead status transition is not allowed");
      const changed = await transaction.jobLead.updateMany?.({
        where: { id: leadId, version: expectedVersion, status: "APPLIED" },
        data: { status: "RESPONSE_RECEIVED", version: { increment: 1 } },
      });
      if (!changed?.count) throw new StaleVersionError(expectedVersion, number(lead.version));
      await transaction.leadStatusTransition.create?.({ data: { leadId, fromStatus: "APPLIED", toStatus: "RESPONSE_RECEIVED", actorId: actor.id, reason: reason ?? null } });
      await this.createRecruiterResponseFollowUp(actor, leadId, this.now(), transaction, lead);
      await transaction.activityEvent.create?.({ data: {
        action: "lead.status_changed", actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
        profileId: String(lead.profileId), leadId, entityType: "lead", entityId: leadId,
        oldSnapshot: { status: "APPLIED" }, newSnapshot: { status: "RESPONSE_RECEIVED" }, metadata: { reason: reason ?? null }, requestId: null,
      } });
      return { ...lead, status: "RESPONSE_RECEIVED", version: number(lead.version) + 1 };
    });
  }

  async completeFollowUpFromCommunication(
    actor: Actor,
    leadId: string,
    communicationId: string,
    occurredAt: Date,
    database: PerformanceDatabase = this.database,
  ) {
    const followUp = await database.performanceFollowUp.findUnique?.({ where: { leadId } });
    if (!followUp || followUp.status !== "OPEN" || (actor.role !== "ADMIN" && followUp.ownerId !== actor.id)) return followUp;
    const completedAt = occurredAt;
    const dueAt = asDate(followUp.slaDueAt);
    const changed = await database.performanceFollowUp.updateMany?.({
      where: { id: String(followUp.id), version: number(followUp.version), status: "OPEN" },
      data: {
        status: "COMPLETED", completedAt,
        breachedAt: dueAt && completedAt > dueAt ? completedAt : null,
        auditMetadata: { ...(typeof followUp.auditMetadata === "object" && followUp.auditMetadata ? followUp.auditMetadata as object : {}), completionSource: "communication", communicationId, completedById: actor.id },
        version: { increment: 1 },
      },
    });
    if (changed?.count) {
      await database.activityEvent.create?.({ data: {
        action: "performance.follow_up_completed", actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
        profileId: null, leadId, entityType: "performance_follow_up", entityId: String(followUp.id), oldSnapshot: { status: "OPEN" },
        newSnapshot: { status: "COMPLETED", completedAt: completedAt.toISOString(), breached: Boolean(dueAt && completedAt > dueAt) },
        metadata: { source: "communication", communicationId }, requestId: null,
      } });
    }
    return database.performanceFollowUp.findUnique?.({ where: { leadId } });
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
      if (followUp.status !== "NEEDS_REASSIGNMENT" && followUp.status !== "ADMIN_REASSIGNMENT_OVERDUE") throw new ConflictError("This follow-up does not need reassignment");
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
        where: { id: followUpId, version: parsed.data.expectedVersion, status: { in: ["NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"] } },
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
    await this.evaluateOverdueSlas();
    return this.database.duplicateReview.findMany?.({
      where: { status: "PENDING" },
      include: { lead: true },
      orderBy: { createdAt: "asc" },
    }) ?? [];
  }

  async getAdminPerformanceDrilldown(actor: Actor, query: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    await this.evaluateOverdueSlas();
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
    if (parsed.data.metric === "FOLLOW_UP_SLA") {
      return this.database.performanceFollowUp.findMany?.({
        where: {
          recruiterRespondedAt: { gte: from, lte: to }, ...(parsed.data.bdId ? { originalOwnerId: parsed.data.bdId } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
        include: { lead: true }, orderBy: { recruiterRespondedAt: "desc" },
      }) ?? [];
    }
    if (parsed.data.metric === "REASSIGNMENTS") return this.database.performanceFollowUp.findMany?.({
      where: { reassignedAt: { gte: from, lte: to }, ...(parsed.data.bdId ? { originalOwnerId: parsed.data.bdId } : {}), ...(parsed.data.status ? { status: parsed.data.status } : {}) },
      include: { lead: true }, orderBy: { reassignedAt: "desc" },
    }) ?? [];
    if (parsed.data.metric === "RECRUITER_RESPONSES") return this.database.leadStatusTransition.findMany?.({
      where: { toStatus: "RESPONSE_RECEIVED", createdAt: { gte: from, lte: to }, ...(parsed.data.bdId ? { lead: { createdById: parsed.data.bdId } } : {}) },
      include: { lead: true }, orderBy: { createdAt: "desc" },
    }) ?? [];
    if (parsed.data.metric === "INTERVIEWS_SCHEDULED") return this.database.interviewRound.findMany?.({
      where: { startsAt: { gte: from, lte: to }, status: { in: ["SCHEDULED", "RESCHEDULE_REQUIRED"] }, ...(parsed.data.bdId ? { lead: { createdById: parsed.data.bdId } } : {}) },
      include: { lead: true }, orderBy: { startsAt: "asc" },
    }) ?? [];
    if (parsed.data.metric === "INTERVIEWS_NEEDING_SCHEDULING") return this.database.jobLead.findMany?.({
      where: {
        qualifiedCredit: true,
        appliedDate: { gte: from, lte: to },
        status: "RESPONSE_RECEIVED",
        ...(parsed.data.bdId ? { createdById: parsed.data.bdId } : {}),
        interviews: { none: {} },
      },
      orderBy: { updatedAt: "desc" },
    }) ?? [];
    if (parsed.data.metric === "OUTCOMES") {
      const [leads, rules] = await Promise.all([
        this.database.jobLead.findMany?.({
          where: { qualifiedCredit: true, appliedDate: { gte: from, lte: to }, ...(parsed.data.bdId ? { createdById: parsed.data.bdId } : {}) },
          include: { interviews: true }, orderBy: { appliedDate: "desc" },
        }) ?? [],
        this.rulesForPeriod(from, to),
      ]);
      const observedAt = this.now();
      return leads.filter((lead) => {
        const appliedAt = asDate(lead.appliedDate);
        return lead.qualifiedCredit !== false && Boolean(appliedAt && getMaturityCohort({
          appliedAt,
          maturityDays: number(this.ruleAt(rules, appliedAt).maturityWindowDays, 21),
          observedAt,
        }).isMatured);
      });
    }
    return this.database.jobLead.findMany?.({
      where: { qualifiedCredit: true, appliedDate: { gte: from, lte: to }, ...(parsed.data.bdId ? { createdById: parsed.data.bdId } : {}) },
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
    const bdStartedAt = asDate(bd.createdAt) ?? from;
    const ruleWindowFrom = bdStartedAt < from ? bdStartedAt : from;
    const ruleWindowTo = now > to ? now : to;
    const targetWindowFrom = now < from ? now : from;
    const targetWindowTo = now > to ? now : to;
    const [leads, interviews, followUps, targets, holidays, leaves, rules] = await Promise.all([
      this.database.jobLead.findMany?.({ where: { createdById: String(bd.id), appliedDate: { gte: from, lte: to } } }) ?? [],
      this.database.interviewRound.findMany?.({ where: { lead: { createdById: String(bd.id) }, startsAt: { lte: to } } }) ?? [],
      this.database.performanceFollowUp.findMany?.({ where: { ownerId: String(bd.id), recruiterRespondedAt: { gte: from, lte: to } } }) ?? [],
      this.database.bdTargetSchedule.findMany?.({ where: { bdId: String(bd.id), effectiveFrom: { lte: targetWindowTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetWindowFrom } }] } }) ?? [],
      this.database.performanceHoliday.findMany?.({}) ?? [],
      this.database.performanceApprovedLeave.findMany?.({ where: { bdId: String(bd.id), startsAt: { lte: to }, endsAt: { gt: from } } }) ?? [],
      this.database.performanceRuleSet.findMany?.({ where: { effectiveFrom: { lte: ruleWindowTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: ruleWindowFrom } }] }, orderBy: { effectiveFrom: "asc" } }) ?? [],
    ]);
    const rule = this.ruleAt(rules, to);
    const calendarRule = this.toCalendarRule(rule);
    const schedule = {
      timeZone: calendarRule.businessCalendarTimeZone, workingDays: calendarRule.workingDays,
      workday: { startHour: calendarRule.workdayStartHour, endHour: calendarRule.workdayEndHour },
      holidays: holidays.flatMap((holiday) => asDate(holiday.holidayDate) ? [asDate(holiday.holidayDate)!] : []),
      leaves: leaves.flatMap((leave) => {
        const startsAt = asDate(leave.startsAt); const endsAt = asDate(leave.endsAt);
        return startsAt && endsAt ? [{ startsAt, endsAt, ...(leave.availableStartHour == null || leave.availableEndHour == null ? {} : { availableHours: { startHour: number(leave.availableStartHour), endHour: number(leave.availableEndHour) } }) }] : [];
      }),
    };
    type RuleSegment = {
      rule: Record<string, unknown>;
      targetApplications: number;
      eligibleWorkingDays: number;
      qualifiedApplications: number;
    };
    const ruleSegments = new Map<string, RuleSegment>();
    const segmentFor = (datedRule: Record<string, unknown>) => {
      const key = `${String(datedRule.id ?? "fallback")}:${iso(datedRule.effectiveFrom) ?? ""}`;
      const existing = ruleSegments.get(key);
      if (existing) return existing;
      const created = { rule: datedRule, targetApplications: 0, eligibleWorkingDays: 0, qualifiedApplications: 0 };
      ruleSegments.set(key, created);
      return created;
    };
    let targetApplications = 0; let eligibleWorkingDays = 0;
    for (let date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
      const datedRule = this.ruleAt(rules, date);
      const datedCalendarRule = this.toCalendarRule(datedRule);
      const datedSchedule = {
        ...schedule,
        timeZone: datedCalendarRule.businessCalendarTimeZone,
        workingDays: datedCalendarRule.workingDays,
        workday: { startHour: datedCalendarRule.workdayStartHour, endHour: datedCalendarRule.workdayEndHour },
      };
      if (!isEligibleWorkingDay(date, datedSchedule)) continue;
      eligibleWorkingDays += 1;
      const segment = segmentFor(datedRule);
      segment.eligibleWorkingDays += 1;
      const activeTarget = this.targetAt(targets, date);
      const dailyTarget = calculateProratedDailyTarget(number(activeTarget?.dailyTarget, number(datedRule.defaultDailyTarget, 70)), date, datedSchedule);
      targetApplications += dailyTarget;
      segment.targetApplications += dailyTarget;
    }
    const qualifiedLeads = leads.filter((lead) => lead.qualifiedCredit !== false);
    const qualified = qualifiedLeads.length;
    for (const lead of qualifiedLeads) {
      const appliedAt = asDate(lead.appliedDate);
      if (appliedAt) segmentFor(this.ruleAt(rules, appliedAt)).qualifiedApplications += 1;
    }
    const rawTargetAttainmentPercent = targetApplications ? (qualified / targetApplications) * 100 : 0;
    const effectiveTargetAttainmentPercent = targetApplications ? Array.from(ruleSegments.values()).reduce((sum, segment) => {
      if (segment.targetApplications === 0) return sum;
      const rawSegmentAttainment = (segment.qualifiedApplications / segment.targetApplications) * 100;
      const effectiveSegmentAttainment = calculateEffectiveAttainment(
        rawSegmentAttainment,
        number(segment.rule.slowdownThresholdPercent, 120),
        number(segment.rule.slowdownMultiplierPercent, 25),
      );
      return sum + effectiveSegmentAttainment * segment.targetApplications;
    }, 0) / targetApplications : 0;
    const scoreWeightDays = Array.from(ruleSegments.values()).reduce((sum, segment) => sum + segment.eligibleWorkingDays, 0);
    const scoreWeights = scoreWeightDays === 0
      ? { applications: number(rule.applicationWeightPercent, 45), followUps: number(rule.followUpWeightPercent, 25), outcomes: number(rule.outcomeWeightPercent, 30) }
      : Array.from(ruleSegments.values()).reduce((weights, segment) => ({
        applications: weights.applications + number(segment.rule.applicationWeightPercent, 45) * (segment.eligibleWorkingDays / scoreWeightDays),
        followUps: weights.followUps + number(segment.rule.followUpWeightPercent, 25) * (segment.eligibleWorkingDays / scoreWeightDays),
        outcomes: weights.outcomes + number(segment.rule.outcomeWeightPercent, 30) * (segment.eligibleWorkingDays / scoreWeightDays),
      }), { applications: 0, followUps: 0, outcomes: 0 });
    const interviewsByLead = new Map<string, Record<string, unknown>[]>();
    for (const interview of interviews) interviewsByLead.set(String(interview.leadId), [...(interviewsByLead.get(String(interview.leadId)) ?? []), interview]);
    const ruleForLead = (lead: Record<string, unknown>) => this.ruleAt(rules, asDate(lead.appliedDate) ?? to);
    const initialRule = this.ruleAt(rules, bdStartedAt);
    const initialMaturityElapsed = getMaturityCohort({
      appliedAt: bdStartedAt,
      maturityDays: number(initialRule.maturityWindowDays, 21),
      observedAt: now,
    }).isMatured;
    const matured = leads.filter((lead) => lead.qualifiedCredit !== false && asDate(lead.appliedDate) && getMaturityCohort({ appliedAt: asDate(lead.appliedDate)!, maturityDays: number(ruleForLead(lead).maturityWindowDays, 21), observedAt: now }).isMatured);
    const eligibleFollowUps = followUps.filter((followUp) => followUp.status !== "NEEDS_REASSIGNMENT" && (asDate(followUp.completedAt) || asDate(followUp.slaDueAt)?.getTime()! <= now.getTime()));
    const metFollowUps = eligibleFollowUps.filter((followUp) => !asDate(followUp.breachedAt)).length;
    const followUpSlaCompliancePercent = eligibleFollowUps.length ? (metFollowUps / eligibleFollowUps.length) * 100 : null;
    const maturedOutcomeScorePercent = !initialMaturityElapsed ? null : matured.length === 0 ? 0 : matured.reduce((sum, lead) => {
      const appliedRule = ruleForLead(lead);
      return sum + calculateOutcomeScore([{ highestStage: outcomeStage(lead.status, interviewsByLead.get(String(lead.id)) ?? []) }], {
        POSITIVE_REPLY: number(appliedRule.positiveReplyPoints, 1), SCREENING: number(appliedRule.screeningPoints, 2), INTERVIEW: number(appliedRule.interviewPoints, 3), OFFER: number(appliedRule.offerPoints, 5),
      });
    }, 0) / matured.length;
    const balanced = calculateBalancedScore({
      effectiveAttainmentPercent: effectiveTargetAttainmentPercent,
      followUpSlaCompliancePercent,
      outcome: { scorePercent: maturedOutcomeScorePercent, maturityElapsed: initialMaturityElapsed },
      weights: scoreWeights,
    });
    const eligibility = evaluateEligibility({ eligibleWorkingDays, initialMaturityElapsed, qualifiedApplications: qualified, maturedApplications: matured.length, evaluatedAt: now });
    const performance = {
      qualifiedApplications: qualified, targetApplications: Math.round(targetApplications), rawTargetAttainmentPercent: Math.round(rawTargetAttainmentPercent * 10) / 10,
      effectiveTargetAttainmentPercent, recruiterResponses: leads.filter((lead) => outcomeStage(lead.status, interviewsByLead.get(String(lead.id)) ?? []) !== "NONE").length,
      interviewsScheduled: interviews.filter((interview) => asDate(interview.startsAt) && asDate(interview.startsAt)! >= from && asDate(interview.startsAt)! <= to && ["SCHEDULED", "RESCHEDULE_REQUIRED"].includes(String(interview.status))).length,
      interviewsNeedingScheduling: leads.filter((lead) => lead.status === "RESPONSE_RECEIVED" && !(interviewsByLead.get(String(lead.id))?.length)).length,
      followUpSlaCompliancePercent: followUpSlaCompliancePercent === null ? null : Math.round(followUpSlaCompliancePercent * 10) / 10,
      maturedOutcomeScorePercent, balancedScore: balanced.score, scoreCoverage: balanced.status,
    };
    return {
      bdId: String(bd.id), bdName: String(bd.displayName), rank: null, eligible: eligibility.eligible, qualifiedApplications: qualified,
      performance, warnings: eligibility.warnings,
      ineligibilityReason: eligibility.reasons[0] ?? null,
      eligibilityProgress: Math.min(100, Math.round((eligibleWorkingDays / 10) * 100)),
      estimatedEligibilityDate: null,
      currentDailyTarget: number(this.targetAt(targets, now)?.dailyTarget, number(this.ruleAt(rules, now).defaultDailyTarget, 70)),
      duplicateRate: leads.length ? (leads.filter((lead) => lead.duplicateClassification === "CONFIRMED").length / leads.length) * 100 : null,
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

  private ruleAt(rows: readonly Record<string, unknown>[], at: Date): Record<string, unknown> {
    return rows
      .filter((row) => {
        const start = asDate(row.effectiveFrom);
        const end = asDate(row.effectiveTo);
        return Boolean(start && start <= at && (!end || end > at));
      })
      .sort((left, right) => number(asDate(right.effectiveFrom)?.getTime()) - number(asDate(left.effectiveFrom)?.getTime()))[0]
      ?? fallbackRule;
  }

  private targetAt(rows: readonly Record<string, unknown>[], at: Date): Record<string, unknown> | undefined {
    return rows
      .filter((row) => {
        const start = asDate(row.effectiveFrom);
        const end = asDate(row.effectiveTo);
        return Boolean(start && start <= at && (!end || end > at));
      })
      .sort((left, right) => number(asDate(right.effectiveFrom)?.getTime()) - number(asDate(left.effectiveFrom)?.getTime()))[0];
  }

  private async rulesForPeriod(from: Date, to: Date): Promise<ReadonlyArray<Record<string, unknown>>> {
    return this.database.performanceRuleSet.findMany?.({
      where: { effectiveFrom: { lte: to }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
      orderBy: { effectiveFrom: "asc" },
    }) ?? [];
  }

  private async previewRuleImpact(proposed: Record<string, unknown>) {
    const affectedFrom = new Date(String(proposed.effectiveFrom));
    const configuredEnd = proposed.effectiveTo ? new Date(String(proposed.effectiveTo)) : null;
    const affectedTo = configuredEnd && configuredEnd < new Date(affectedFrom.getTime() + 30 * 86_400_000)
      ? configuredEnd
      : new Date(affectedFrom.getTime() + 30 * 86_400_000);
    const [bds, currentRules, targets] = await Promise.all([
      this.database.user?.findMany?.({ where: { role: "BD", isActive: true }, orderBy: { displayName: "asc" } }) ?? [],
      this.database.performanceRuleSet?.findMany?.({ where: { effectiveFrom: { lte: affectedTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: affectedFrom } }] } }) ?? [],
      this.database.bdTargetSchedule?.findMany?.({ where: { effectiveFrom: { lte: affectedTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: affectedFrom } }] } }) ?? [],
    ]);
    const targetFor = (bdId: string, resolveRule: (date: Date) => Record<string, unknown>) => {
      let total = 0;
      for (let date = new Date(Date.UTC(affectedFrom.getUTCFullYear(), affectedFrom.getUTCMonth(), affectedFrom.getUTCDate())); date < affectedTo; date.setUTCDate(date.getUTCDate() + 1)) {
        const rule = resolveRule(date);
        const schedule = { timeZone: String(rule.businessCalendarTimeZone ?? "UTC"), workingDays: Array.isArray(rule.workingDays) ? rule.workingDays.map(Number) : [1, 2, 3, 4, 5], workday: { startHour: number(rule.workdayStartHour, 9), endHour: number(rule.workdayEndHour, 17) } };
        if (!isEligibleWorkingDay(date, schedule)) continue;
        const target = targets.find((row) => String(row.bdId) === bdId && asDate(row.effectiveFrom) && asDate(row.effectiveFrom)! <= date && (!asDate(row.effectiveTo) || asDate(row.effectiveTo)! > date));
        total += number(target?.dailyTarget, number(rule.defaultDailyTarget, 70));
      }
      return Math.round(total);
    };
    const currentAtStart = this.ruleAt(currentRules, affectedFrom);
    const proposedAt = (date: Date) => date >= affectedFrom && (!configuredEnd || date < configuredEnd)
      ? proposed
      : this.ruleAt(currentRules, date);
    return {
      effectiveFrom: affectedFrom.toISOString(), effectiveTo: configuredEnd?.toISOString() ?? null,
      affectedFrom: affectedFrom.toISOString(), affectedTo: affectedTo.toISOString(),
      projection: {
        kind: "TARGET_AND_CONFIGURATION" as const,
        exactFutureScoresAvailable: false as const,
        unavailableExactScoreDimensions: ["QUALIFIED_APPLICATIONS", "FOLLOW_UP_COMPLETION", "RECRUITER_OUTCOMES", "BALANCED_SCORE"],
      },
      configuration: { current: this.ruleProjectionConfiguration(currentAtStart), proposed: this.ruleProjectionConfiguration(proposed) },
      impacts: bds.map((bd) => {
        const currentTargetApplications = targetFor(String(bd.id), (date) => this.ruleAt(currentRules, date));
        const proposedTargetApplications = targetFor(String(bd.id), proposedAt);
        return {
          bdId: String(bd.id), currentTargetApplications, proposedTargetApplications,
          targetDelta: proposedTargetApplications - currentTargetApplications,
        };
      }),
    };
  }

  private ruleProjectionConfiguration(rule: Record<string, unknown>) {
    return {
      defaultDailyTarget: number(rule.defaultDailyTarget, 70), workingDays: Array.isArray(rule.workingDays) ? rule.workingDays.map(number) : [1, 2, 3, 4, 5],
      businessCalendarTimeZone: String(rule.businessCalendarTimeZone ?? "UTC"), workdayStartHour: number(rule.workdayStartHour, 9), workdayEndHour: number(rule.workdayEndHour, 17),
      followUpSlaBusinessHours: number(rule.followUpSlaBusinessHours, 48), adminReassignmentSlaBusinessHours: number(rule.adminReassignmentSlaBusinessHours, 2), maturityWindowDays: number(rule.maturityWindowDays, 21), duplicateLookbackMonths: number(rule.duplicateLookbackMonths, 6),
      applicationWeightPercent: number(rule.applicationWeightPercent, 45), followUpWeightPercent: number(rule.followUpWeightPercent, 25), outcomeWeightPercent: number(rule.outcomeWeightPercent, 30),
      positiveReplyPoints: number(rule.positiveReplyPoints, 1), screeningPoints: number(rule.screeningPoints, 2), interviewPoints: number(rule.interviewPoints, 3), offerPoints: number(rule.offerPoints, 5),
      slowdownThresholdPercent: number(rule.slowdownThresholdPercent, 120), slowdownMultiplierPercent: number(rule.slowdownMultiplierPercent, 25),
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

  private async activeCalendarRule(at: Date, database: Pick<PerformanceDatabase, "performanceRuleSet"> = this.database): Promise<CalendarRule> {
    const row = await database.performanceRuleSet.findFirst?.({
      where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    return this.toCalendarRule(row ?? {});
  }

  private toCalendarRule(row: Record<string, unknown>): CalendarRule {
    return {
      businessCalendarTimeZone: typeof row.businessCalendarTimeZone === "string" ? row.businessCalendarTimeZone : fallbackRule.businessCalendarTimeZone,
      workingDays: Array.isArray(row.workingDays) ? row.workingDays.map(Number) : fallbackRule.workingDays,
      workdayStartHour: number(row.workdayStartHour, fallbackRule.workdayStartHour),
      workdayEndHour: number(row.workdayEndHour, fallbackRule.workdayEndHour),
      followUpSlaBusinessHours: number(row.followUpSlaBusinessHours, fallbackRule.followUpSlaBusinessHours),
      adminReassignmentSlaBusinessHours: number(row.adminReassignmentSlaBusinessHours, fallbackRule.adminReassignmentSlaBusinessHours),
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

  private async createRecruiterResponseFollowUp(
    actor: Actor,
    leadId: string,
    respondedAt: Date,
    database: PerformanceDatabase,
    knownLead?: Record<string, unknown>,
  ) {
    const lead = knownLead ?? await database.jobLead.findUnique?.({ where: { id: leadId } });
    if (!lead) throw new NotFoundError("The application was not found");
    if (actor.role !== "ADMIN" && lead.currentOwnerId !== actor.id) throw new AuthorizationError();
    const existing = await database.performanceFollowUp.findUnique?.({ where: { leadId } });
    if (existing) return existing;
    const rule = await this.activeCalendarRule(respondedAt, database);
    const originalOwnerId = String(lead.currentOwnerId);
    const [holidays, leaves] = await Promise.all([
      database.performanceHoliday.findMany?.({}) ?? [],
      database.performanceApprovedLeave.findMany?.({ where: { bdId: originalOwnerId, startsAt: { lte: respondedAt }, endsAt: { gt: respondedAt } } }) ?? [],
    ]);
    const schedule = {
      timeZone: rule.businessCalendarTimeZone, workingDays: rule.workingDays,
      workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
      holidays: holidays.flatMap((holiday) => asDate(holiday.holidayDate) ? [asDate(holiday.holidayDate)!] : []),
      leaves: leaves.flatMap((leave) => {
        const startsAt = asDate(leave.startsAt); const endsAt = asDate(leave.endsAt);
        return startsAt && endsAt ? [{ startsAt, endsAt }] : [];
      }),
    };
    const needsReassignment = leaves.length > 0;
    const data = {
      leadId, ownerId: originalOwnerId, originalOwnerId,
      status: needsReassignment ? "NEEDS_REASSIGNMENT" : "OPEN",
      recruiterRespondedAt: respondedAt, slaStartedAt: respondedAt,
      slaPausedAt: needsReassignment ? respondedAt : null,
      slaDueAt: needsReassignment ? null : addBusinessHours(respondedAt, rule.followUpSlaBusinessHours, schedule),
      adminReassignmentSlaStartedAt: needsReassignment ? respondedAt : null,
      adminReassignmentSlaDueAt: needsReassignment ? addBusinessHours(respondedAt, rule.adminReassignmentSlaBusinessHours, { ...schedule, leaves: [] }) : null,
    };
    const created = await database.performanceFollowUp.create?.({ data }) as Record<string, unknown> | undefined;
    await database.activityEvent.create?.({ data: {
      action: needsReassignment ? "performance.follow_up_needs_reassignment" : "performance.follow_up_created",
      actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
      profileId: String(lead.profileId), leadId, entityType: "performance_follow_up", entityId: String(created?.id ?? leadId),
      oldSnapshot: null, newSnapshot: { status: data.status, originalOwnerId }, metadata: { recruiterRespondedAt: respondedAt.toISOString() }, requestId: null,
    } });
    if (needsReassignment) await this.appendAdminAlerts(database, `performance-reassignment:${leadId}`, "Follow-up needs reassignment", String(lead.jobTitle), leadId);
    return created;
  }

  /** Idempotent worker/read-time evaluator. A scheduler may call this as often as needed. */
  async evaluateOverdueSlas(at = this.now()) {
    const [followUps, reviews] = await Promise.all([
      this.database.performanceFollowUp.findMany?.({ where: { status: "NEEDS_REASSIGNMENT", adminReassignmentSlaDueAt: { lte: at } }, include: { lead: true } }) ?? [],
      this.database.duplicateReview.findMany?.({ where: { status: "PENDING", expiresAt: { lte: at }, overdueAt: null }, include: { lead: true } }) ?? [],
    ]);
    let reassignmentOverdue = 0;
    for (const followUp of followUps) {
      const updated = await this.database.$transaction(async (transaction) => {
        const changed = await transaction.performanceFollowUp.updateMany?.({
          where: { id: String(followUp.id), status: "NEEDS_REASSIGNMENT" },
          data: { status: "ADMIN_REASSIGNMENT_OVERDUE", adminReassignmentBreachedAt: at, version: { increment: 1 } },
        });
        if (!changed?.count) return false;
        const lead = followUp.lead as Record<string, unknown> | undefined;
        await transaction.activityEvent.create?.({ data: {
          action: "performance.admin_reassignment_overdue", actorId: null, actorNameSnapshot: null, actorRoleSnapshot: null,
          profileId: lead?.profileId ? String(lead.profileId) : null, leadId: lead?.id ? String(lead.id) : null,
          entityType: "performance_follow_up", entityId: String(followUp.id), oldSnapshot: { status: "NEEDS_REASSIGNMENT" },
          newSnapshot: { status: "ADMIN_REASSIGNMENT_OVERDUE", breachedAt: at.toISOString() }, metadata: null, requestId: null,
        } });
        await this.appendAdminAlerts(transaction, `performance-reassignment-overdue:${String(followUp.id)}`, "Admin reassignment overdue", String(lead?.jobTitle ?? "Recruiter follow-up"), String(lead?.id ?? followUp.leadId));
        return true;
      });
      if (updated) reassignmentOverdue += 1;
    }
    let reviewOverdue = 0;
    for (const review of reviews) {
      const lead = review.lead as Record<string, unknown> | undefined;
      const updated = await this.database.$transaction(async (transaction) => {
        const changed = await transaction.duplicateReview.updateMany?.({
          where: { id: String(review.id), status: "PENDING", overdueAt: null },
          data: { overdueAt: at, version: { increment: 1 } },
        });
        if (!changed?.count) return false;
        await transaction.activityEvent.create?.({ data: {
          action: "performance.duplicate_review_overdue", actorId: null, actorNameSnapshot: null, actorRoleSnapshot: null,
          profileId: lead?.profileId ? String(lead.profileId) : null, leadId: lead?.id ? String(lead.id) : null,
          entityType: "duplicate_review", entityId: String(review.id), oldSnapshot: { status: "PENDING", overdueAt: null },
          newSnapshot: { status: "PENDING", overdueAt: at.toISOString() }, metadata: { expiresAt: iso(review.expiresAt) }, requestId: null,
        } });
        await this.appendAdminAlerts(transaction, `performance-duplicate-review-overdue:${String(review.id)}`, "Duplicate override review overdue", String(lead?.jobTitle ?? "Application"), String(lead?.id ?? review.leadId));
        return true;
      });
      if (updated) reviewOverdue += 1;
    }
    return { reassignmentOverdue, reviewOverdue };
  }

  private async appendAdminAlerts(database: PerformanceDatabase, prefix: string, title: string, message: string, leadId: string) {
    const admins = await database.user.findMany?.({ where: { role: "ADMIN", isActive: true }, select: { id: true, email: true } }) ?? [];
    await Promise.all(admins.flatMap((admin) => {
      const recipientUserId = String(admin.id);
      const notification = database.outboxEvent?.upsert?.({ where: { idempotencyKey: `${prefix}:in-app:${recipientUserId}` }, update: {}, create: {
        aggregateType: "user", aggregateId: recipientUserId, eventType: "notification.create_requested", idempotencyKey: `${prefix}:in-app:${recipientUserId}`,
        payload: { recipientUserId, title, message, relatedEntityType: "lead", relatedEntityId: leadId },
      } });
      const email = typeof admin.email === "string" ? database.outboxEvent?.upsert?.({ where: { idempotencyKey: `${prefix}:email:${recipientUserId}` }, update: {}, create: {
        aggregateType: "user", aggregateId: recipientUserId, eventType: "email.send_requested", idempotencyKey: `${prefix}:email:${recipientUserId}`,
        payload: { recipientUserId, to: admin.email, subject: title, text: message },
      } }) : undefined;
      return [notification, email].filter((event): event is Promise<unknown> => Boolean(event));
    }));
  }
}
