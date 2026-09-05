import {
  performanceDrilldownQuerySchema,
  bdTargetScheduleInputSchema,
  bdTargetScheduleListQuerySchema,
  performanceApprovedLeaveInputSchema,
  performanceApprovedLeaveListQuerySchema,
  performanceHolidayInputSchema,
  performanceLeaderboardExceptionInputSchema,
  performanceLeaderboardExceptionListQuerySchema,
  performanceRecordAuditInputSchema,
  performancePeriodQuerySchema,
  performanceRuleInputSchema,
  performanceRuleMutationSchema,
  reassignPerformanceFollowUpInputSchema,
  revokePerformanceLeaderboardExceptionInputSchema,
  performanceVersionInputSchema,
  updateBdTargetScheduleInputSchema,
  updateDuplicateReviewInputSchema,
  updatePerformanceApprovedLeaveInputSchema,
  updatePerformanceHolidayInputSchema,
} from "@orbit/contracts";

import { AuthorizationError, ConflictError, NotFoundError, StaleVersionError, ValidationError } from "../errors/app-error";
import type { Actor } from "../identity/session.service";
import { addBusinessHours, businessCalendarDate, calculateProratedDailyTarget, isEligibleWorkingDay, nextEligibleWorkingDay } from "./business-hours";
import { evaluateEligibility } from "./eligibility";
import { getMaturityCohort, maturityDate } from "./maturity";
import { rankLeaderboard } from "./leaderboard";
import { calculateBalancedScore, calculateEffectiveAttainment, calculateOutcomeScore } from "./score";

type Store = {
  findUnique?(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findFirst?(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findMany?(args?: Record<string, unknown>): Promise<ReadonlyArray<Record<string, unknown>>>;
  updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  create?(args: { data: Record<string, unknown> }): Promise<unknown>;
  deleteMany?(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
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
  performanceLeaderboardException: Store;
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

function isoDate(value: unknown): string {
  const parsed = asDate(value);
  if (parsed) return parsed.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 1_000) / 10 : null;
}

function usableText(value: unknown): boolean {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return Boolean(normalized) && !["-", "n/a", "na", "none", "unknown", "tbd", "test"].includes(normalized);
}

function hasUsableJobUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
}

function jobUrlHost(value: unknown): string | null {
  if (!hasUsableJobUrl(value)) return null;
  return new URL(String(value)).hostname.replace(/^www\./, "").toLocaleLowerCase();
}

function hasValidRecruiterEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = value.trim().match(/^[^\s@]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i);
  return Boolean(match?.[1]);
}

export function outcomeStage(
  status: unknown,
  interviews: readonly Record<string, unknown>[] = [],
  transitions: readonly Record<string, unknown>[] = [],
  offers: readonly Record<string, unknown>[] = [],
): "NONE" | "POSITIVE_REPLY" | "SCREENING" | "INTERVIEW" | "OFFER" {
  const statuses = [status, ...transitions.map((transition) => transition.toStatus)];
  if (offers.length > 0) return "OFFER";
  if (statuses.some((candidate) => ["OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"].includes(String(candidate)))) {
    return "OFFER";
  }
  if (interviews.some((round) => !["PRE_SCREEN", "RECRUITER", "HR"].includes(String(round.roundType)))) return "INTERVIEW";
  if (interviews.some((round) => ["PRE_SCREEN", "RECRUITER", "HR"].includes(String(round.roundType)))) return "SCREENING";
  if (statuses.includes("INTERVIEWING")) return "INTERVIEW";
  if (statuses.includes("RESPONSE_RECEIVED")) return "POSITIVE_REPLY";
  return "NONE";
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
      rankable: row.eligibilitySection === "OFFICIAL",
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
      quality: this.aggregateQuality(completed.map((row) => row.quality)),
      leaderboard: completed.filter((row) => row.eligibilitySection === "OFFICIAL").map((row) => this.leaderboardRow(row)),
      buildingBaseline: completed.filter((row) => row.eligibilitySection === "BUILDING_BASELINE").map((row) => this.leaderboardRow(row)),
      excluded: completed.filter((row) => row.eligibilitySection === "EXCLUDED").map((row) => this.leaderboardRow(row)),
    };
  }

  async auditLeadRecord(actor: Actor, leadId: string, input: unknown) {
    if (!actor.isActive || actor.role !== "ADMIN") throw new AuthorizationError();
    this.authorization.assertRole(actor, ["ADMIN"]);
    const parsed = performanceRecordAuditInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const lead = await this.database.jobLead.findUnique?.({ where: { id: leadId } });
    if (!lead) throw new NotFoundError("The lead was not found");

    const actions = {
      PASSED: "performance.record_audit_passed",
      CORRECTION_REQUIRED: "performance.record_audit_failed",
      CORRECTED: "performance.record_corrected",
    } as const;
    const action = actions[parsed.data.outcome];
    if (parsed.data.outcome === "CORRECTED") {
      const history = await this.database.activityEvent.findMany?.({
        where: { leadId, action: { in: ["performance.record_audit_failed", "performance.record_audit_passed", "performance.record_corrected"] } },
        orderBy: { occurredAt: "asc" },
      }) ?? [];
      const lastFailure = [...history].reverse().find((event) => event.action === "performance.record_audit_failed");
      const lastResolution = [...history].reverse().find((event) => ["performance.record_audit_passed", "performance.record_corrected"].includes(String(event.action)));
      if (!lastFailure || (asDate(lastResolution?.occurredAt)?.getTime() ?? 0) >= (asDate(lastFailure.occurredAt)?.getTime() ?? Number.POSITIVE_INFINITY)) {
        throw new ConflictError("Recording a correction requires a prior audit failure");
      }
    }
    const occurredAt = this.now();
    await this.database.activityEvent.create?.({
      data: {
        action,
        actorId: actor.id,
        actorNameSnapshot: actor.displayName,
        actorRoleSnapshot: actor.role,
        profileId: String(lead.profileId),
        leadId,
        entityType: "lead",
        entityId: leadId,
        oldSnapshot: null,
        newSnapshot: { outcome: parsed.data.outcome, reason: parsed.data.reason },
        metadata: { source: "admin_record_audit" },
        requestId: null,
        occurredAt,
      },
    });
    return { leadId, outcome: parsed.data.outcome, action, occurredAt: occurredAt.toISOString() };
  }

  async getBdPerformance(actor: Actor, query: unknown) {
    if (!actor.isActive || actor.role !== "BD") throw new AuthorizationError();
    const { bdId: _bdId, ...period } = this.parsePeriod(query);
    const adminView = await this.getRowsForBdPeriod(period);
    const self = adminView.find((row) => row.bdId === actor.id);
    if (!self) throw new NotFoundError("The BD performance record was not found");
    const ranked = rankLeaderboard(adminView.map((row) => ({
      bdId: row.bdId,
      bdName: row.bdName,
      rankable: row.eligibilitySection === "OFFICIAL",
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
      quality: self.quality,
      rank,
      peerLeaderboard: adminView.map((row) => {
        const rankedRow = ranked.find((candidate) => candidate.bdId === row.bdId);
        return {
          bdId: row.bdId,
          bdName: row.bdName,
          rank: rankedRow?.rank ?? null,
          qualifiedApplications: row.qualifiedApplications,
          recordHealthRate: row.quality.recordHealthRate,
          adminAuditPassRate: row.quality.adminAuditPassRate,
          duplicateRate: row.quality.duplicateRate,
        };
      }),
      eligibility: {
        eligible: self.eligible,
        eligibilityProgress: self.eligibilityProgress,
        ineligibilityReason: self.ineligibilityReason,
        estimatedEligibilityDate: iso(self.estimatedEligibilityDate),
        eligibilitySection: self.eligibilitySection,
        warnings: self.warnings,
      },
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

  async getPerformanceRuleHistory(actor: Actor) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    const rules = await this.database.performanceRuleSet.findMany?.({ orderBy: { effectiveFrom: "asc" } }) ?? [];
    return rules.map((rule) => this.ruleSummary(rule));
  }

  async listBdTargetSchedules(actor: Actor, query: unknown = {}) {
    this.assertAdmin(actor);
    const parsed = bdTargetScheduleListQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const schedules = await this.database.bdTargetSchedule.findMany?.({
      where: parsed.data.bdId ? { bdId: parsed.data.bdId } : {},
      orderBy: { effectiveFrom: "asc" },
    }) ?? [];
    return schedules.map((schedule) => this.targetScheduleSummary(schedule));
  }

  async createBdTargetSchedule(actor: Actor, input: unknown) {
    this.assertAdmin(actor);
    const parsed = bdTargetScheduleInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.assertActiveBd(parsed.data.bdId);
    const effectiveFrom = await this.nextTargetChangeBoundary(this.now());
    const created = await this.database.$transaction(async (transaction) => {
      await this.assertTargetWindowAvailable(transaction, parsed.data.bdId, effectiveFrom, parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null);
      const row = await transaction.bdTargetSchedule.create?.({
        data: {
          bdId: parsed.data.bdId,
          dailyTarget: parsed.data.dailyTarget,
          effectiveFrom,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          createdById: actor.id,
          auditMetadata: parsed.data.auditMetadata ?? null,
        },
      }) as Record<string, unknown> | undefined;
      if (!row) throw new NotFoundError("The BD target schedule was not created");
      await this.auditPerformanceControl(transaction, actor, "performance.bd_target_created", "bd_target_schedule", String(row.id), null, this.targetScheduleSummary(row));
      return row;
    });
    return this.targetScheduleSummary(created);
  }

  async updateBdTargetSchedule(actor: Actor, scheduleId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = updateBdTargetScheduleInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.bdTargetSchedule.findUnique?.({ where: { id: scheduleId } });
    if (!current) throw new NotFoundError("The BD target schedule was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    await this.assertActiveBd(parsed.data.bdId);
    const effectiveFrom = new Date(parsed.data.effectiveFrom);
    const now = this.now();
    const currentStartsAt = asDate(current.effectiveFrom);
    const currentEndsAt = asDate(current.effectiveTo);
    if (currentStartsAt && currentStartsAt <= now && (!currentEndsAt || currentEndsAt > now)) {
      if (String(current.bdId) !== parsed.data.bdId) throw new ConflictError("Started BD target schedules cannot change ownership");
      const replacementFrom = await this.nextTargetChangeBoundary(now);
      const replacementTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null;
      if (replacementTo && replacementTo <= replacementFrom) {
        throw new ConflictError("The replacement target period must end after its next working-day boundary");
      }
      const replacement = await this.database.$transaction(async (transaction) => {
        const closed = await transaction.bdTargetSchedule.updateMany?.({
          where: { id: scheduleId, version: parsed.data.expectedVersion },
          data: { effectiveTo: replacementFrom, version: { increment: 1 } },
        });
        if (!closed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
        await this.assertTargetWindowAvailable(transaction, parsed.data.bdId, replacementFrom, replacementTo, scheduleId);
        const created = await transaction.bdTargetSchedule.create?.({
          data: {
            bdId: parsed.data.bdId,
            dailyTarget: parsed.data.dailyTarget,
            effectiveFrom: replacementFrom,
            effectiveTo: replacementTo,
            createdById: actor.id,
            auditMetadata: { ...(parsed.data.auditMetadata ?? {}), supersedesTargetScheduleId: scheduleId },
          },
        }) as Record<string, unknown> | undefined;
        if (!created) throw new NotFoundError("The replacement BD target schedule was not created");
        await this.auditPerformanceControl(
          transaction,
          actor,
          "performance.bd_target_versioned",
          "bd_target_schedule",
          String(created.id),
          this.targetScheduleSummary(current),
          this.targetScheduleSummary(created),
        );
        return created;
      });
      return this.targetScheduleSummary(replacement);
    }
    if (effectiveFrom < now) throw new ConflictError("BD target changes cannot rewrite historical performance");
    const updated = await this.database.$transaction(async (transaction) => {
      await this.assertTargetWindowAvailable(transaction, parsed.data.bdId, effectiveFrom, parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null, scheduleId);
      const changed = await transaction.bdTargetSchedule.updateMany?.({
        where: { id: scheduleId, version: parsed.data.expectedVersion },
        data: {
          bdId: parsed.data.bdId, dailyTarget: parsed.data.dailyTarget, effectiveFrom,
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          auditMetadata: parsed.data.auditMetadata ?? current.auditMetadata ?? null,
          version: { increment: 1 },
        },
      });
      if (!changed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      const row = await transaction.bdTargetSchedule.findUnique?.({ where: { id: scheduleId } });
      if (!row) throw new NotFoundError("The BD target schedule was not found after it was updated");
      await this.auditPerformanceControl(transaction, actor, "performance.bd_target_updated", "bd_target_schedule", scheduleId, this.targetScheduleSummary(current), this.targetScheduleSummary(row));
      return row;
    });
    return this.targetScheduleSummary(updated);
  }

  async deleteBdTargetSchedule(actor: Actor, scheduleId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceVersionInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.bdTargetSchedule.findUnique?.({ where: { id: scheduleId } });
    if (!current) throw new NotFoundError("The BD target schedule was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    if ((asDate(current.effectiveFrom) ?? this.now()) < this.now()) throw new ConflictError("Started BD target schedules are retained for performance history");
    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.bdTargetSchedule.deleteMany?.({ where: { id: scheduleId, version: parsed.data.expectedVersion } });
      if (!deleted?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      await this.auditPerformanceControl(transaction, actor, "performance.bd_target_deleted", "bd_target_schedule", scheduleId, this.targetScheduleSummary(current), null);
    });
  }

  async listPerformanceHolidays(actor: Actor) {
    this.assertAdmin(actor);
    const holidays = await this.database.performanceHoliday.findMany?.({ orderBy: { holidayDate: "asc" } }) ?? [];
    return holidays.map((holiday) => this.holidaySummary(holiday));
  }

  async createPerformanceHoliday(actor: Actor, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceHolidayInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const holidayDate = new Date(`${parsed.data.holidayDate}T00:00:00.000Z`);
    const existing = await this.database.performanceHoliday.findFirst?.({ where: { holidayDate } });
    if (existing) throw new ConflictError("A holiday already exists on this date");
    const created = await this.database.$transaction(async (transaction) => {
      const row = await transaction.performanceHoliday.create?.({ data: { holidayDate, name: parsed.data.name, createdById: actor.id, auditMetadata: parsed.data.auditMetadata ?? null } }) as Record<string, unknown> | undefined;
      if (!row) throw new NotFoundError("The holiday was not created");
      await this.auditPerformanceControl(transaction, actor, "performance.holiday_created", "performance_holiday", String(row.id), null, this.holidaySummary(row));
      return row;
    });
    return this.holidaySummary(created);
  }

  async updatePerformanceHoliday(actor: Actor, holidayId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = updatePerformanceHolidayInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceHoliday.findUnique?.({ where: { id: holidayId } });
    if (!current) throw new NotFoundError("The holiday was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    const holidayDate = new Date(`${parsed.data.holidayDate}T00:00:00.000Z`);
    if (await this.isStartedHoliday(current) || holidayDate <= await this.currentCalendarDate()) {
      throw new ConflictError("Started holidays cannot rewrite historical performance");
    }
    const existing = await this.database.performanceHoliday.findFirst?.({ where: { holidayDate, id: { not: holidayId } } });
    if (existing) throw new ConflictError("A holiday already exists on this date");
    const updated = await this.database.$transaction(async (transaction) => {
      const changed = await transaction.performanceHoliday.updateMany?.({ where: { id: holidayId, version: parsed.data.expectedVersion }, data: { holidayDate, name: parsed.data.name, auditMetadata: parsed.data.auditMetadata ?? current.auditMetadata ?? null, version: { increment: 1 } } });
      if (!changed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      const row = await transaction.performanceHoliday.findUnique?.({ where: { id: holidayId } });
      if (!row) throw new NotFoundError("The holiday was not found after it was updated");
      await this.auditPerformanceControl(transaction, actor, "performance.holiday_updated", "performance_holiday", holidayId, this.holidaySummary(current), this.holidaySummary(row));
      return row;
    });
    return this.holidaySummary(updated);
  }

  async deletePerformanceHoliday(actor: Actor, holidayId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceVersionInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceHoliday.findUnique?.({ where: { id: holidayId } });
    if (!current) throw new NotFoundError("The holiday was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    if (await this.isStartedHoliday(current)) throw new ConflictError("Started holidays cannot rewrite historical performance");
    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.performanceHoliday.deleteMany?.({ where: { id: holidayId, version: parsed.data.expectedVersion } });
      if (!deleted?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      await this.auditPerformanceControl(transaction, actor, "performance.holiday_deleted", "performance_holiday", holidayId, this.holidaySummary(current), null);
    });
  }

  async listPerformanceApprovedLeaves(actor: Actor, query: unknown = {}) {
    this.assertAdmin(actor);
    const parsed = performanceApprovedLeaveListQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const leaves = await this.database.performanceApprovedLeave.findMany?.({ where: parsed.data.bdId ? { bdId: parsed.data.bdId } : {}, orderBy: { startsAt: "asc" } }) ?? [];
    return leaves.map((leave) => this.leaveSummary(leave));
  }

  async createPerformanceApprovedLeave(actor: Actor, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceApprovedLeaveInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.assertActiveBd(parsed.data.bdId);
    const startsAt = new Date(parsed.data.startsAt); const endsAt = new Date(parsed.data.endsAt);
    const created = await this.database.$transaction(async (transaction) => {
      await this.assertLeaveWindowAvailable(transaction, parsed.data.bdId, startsAt, endsAt);
      const row = await transaction.performanceApprovedLeave.create?.({ data: { ...parsed.data, startsAt, endsAt, reason: parsed.data.reason ?? null, availableStartHour: parsed.data.availableStartHour ?? null, availableEndHour: parsed.data.availableEndHour ?? null, auditMetadata: null, approvedById: actor.id } }) as Record<string, unknown> | undefined;
      if (!row) throw new NotFoundError("The approved leave was not created");
      await this.auditPerformanceControl(transaction, actor, "performance.leave_created", "performance_approved_leave", String(row.id), null, this.leaveSummary(row));
      return row;
    });
    return this.leaveSummary(created);
  }

  async updatePerformanceApprovedLeave(actor: Actor, leaveId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = updatePerformanceApprovedLeaveInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceApprovedLeave.findUnique?.({ where: { id: leaveId } });
    if (!current) throw new NotFoundError("The approved leave was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    if (this.isStartedLeave(current)) throw new ConflictError("Started approved leave cannot rewrite historical performance");
    await this.assertActiveBd(parsed.data.bdId);
    const startsAt = new Date(parsed.data.startsAt); const endsAt = new Date(parsed.data.endsAt);
    if (startsAt <= this.now()) throw new ConflictError("Started approved leave cannot rewrite historical performance");
    const updated = await this.database.$transaction(async (transaction) => {
      await this.assertLeaveWindowAvailable(transaction, parsed.data.bdId, startsAt, endsAt, leaveId);
      const changed = await transaction.performanceApprovedLeave.updateMany?.({ where: { id: leaveId, version: parsed.data.expectedVersion }, data: { bdId: parsed.data.bdId, startsAt, endsAt, reason: parsed.data.reason ?? null, availableStartHour: parsed.data.availableStartHour ?? null, availableEndHour: parsed.data.availableEndHour ?? null, version: { increment: 1 } } });
      if (!changed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      const row = await transaction.performanceApprovedLeave.findUnique?.({ where: { id: leaveId } });
      if (!row) throw new NotFoundError("The approved leave was not found after it was updated");
      await this.auditPerformanceControl(transaction, actor, "performance.leave_updated", "performance_approved_leave", leaveId, this.leaveSummary(current), this.leaveSummary(row));
      return row;
    });
    return this.leaveSummary(updated);
  }

  async deletePerformanceApprovedLeave(actor: Actor, leaveId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceVersionInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceApprovedLeave.findUnique?.({ where: { id: leaveId } });
    if (!current) throw new NotFoundError("The approved leave was not found");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    if (this.isStartedLeave(current)) throw new ConflictError("Started approved leave cannot rewrite historical performance");
    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.performanceApprovedLeave.deleteMany?.({ where: { id: leaveId, version: parsed.data.expectedVersion } });
      if (!deleted?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      await this.auditPerformanceControl(transaction, actor, "performance.leave_deleted", "performance_approved_leave", leaveId, this.leaveSummary(current), null);
    });
  }

  async listLeaderboardExceptions(actor: Actor, query: unknown = {}) {
    this.assertAdmin(actor);
    const parsed = performanceLeaderboardExceptionListQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const now = this.now();
    const exceptions = await this.database.performanceLeaderboardException?.findMany?.({
      where: {
        ...(parsed.data.bdId ? { bdId: parsed.data.bdId } : {}),
        ...(parsed.data.activeOnly ? { effectiveFrom: { lte: now }, expiresAt: { gt: now }, revokedAt: null } : {}),
      },
      orderBy: { effectiveFrom: "desc" },
    }) ?? [];
    return exceptions.map((exception) => this.leaderboardExceptionSummary(exception, now));
  }

  async createLeaderboardException(actor: Actor, input: unknown) {
    this.assertAdmin(actor);
    const parsed = performanceLeaderboardExceptionInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.assertActiveBd(parsed.data.bdId);
    const effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : this.now();
    const expiresAt = new Date(parsed.data.expiresAt);
    if (expiresAt <= this.now()) throw new ConflictError("Leaderboard exceptions must expire in the future");
    const created = await this.database.$transaction(async (transaction) => {
      await this.assertExceptionWindowAvailable(transaction, parsed.data.bdId, effectiveFrom, expiresAt);
      const row = await transaction.performanceLeaderboardException.create?.({ data: { bdId: parsed.data.bdId, type: parsed.data.type, reason: parsed.data.reason, effectiveFrom, expiresAt, createdById: actor.id, auditMetadata: parsed.data.auditMetadata ?? null } }) as Record<string, unknown> | undefined;
      if (!row) throw new NotFoundError("The leaderboard exception was not created");
      await this.auditPerformanceControl(transaction, actor, "performance.leaderboard_exception_created", "performance_leaderboard_exception", String(row.id), null, this.leaderboardExceptionSummary(row, this.now()));
      return row;
    });
    return this.leaderboardExceptionSummary(created, this.now());
  }

  async revokeLeaderboardException(actor: Actor, exceptionId: string, input: unknown) {
    this.assertAdmin(actor);
    const parsed = revokePerformanceLeaderboardExceptionInputSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues);
    const current = await this.database.performanceLeaderboardException.findUnique?.({ where: { id: exceptionId } });
    if (!current) throw new NotFoundError("The leaderboard exception was not found");
    if (current.revokedAt) throw new ConflictError("The leaderboard exception is already revoked");
    if (number(current.version) !== parsed.data.expectedVersion) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
    const revokedAt = this.now();
    const updated = await this.database.$transaction(async (transaction) => {
      const changed = await transaction.performanceLeaderboardException.updateMany?.({ where: { id: exceptionId, version: parsed.data.expectedVersion, revokedAt: null }, data: { revokedAt, revokedById: actor.id, revocationReason: parsed.data.reason, version: { increment: 1 } } });
      if (!changed?.count) throw new StaleVersionError(parsed.data.expectedVersion, number(current.version));
      const row = await transaction.performanceLeaderboardException.findUnique?.({ where: { id: exceptionId } });
      if (!row) throw new NotFoundError("The leaderboard exception was not found after revocation");
      await this.auditPerformanceControl(transaction, actor, "performance.leaderboard_exception_revoked", "performance_leaderboard_exception", exceptionId, this.leaderboardExceptionSummary(current, revokedAt), this.leaderboardExceptionSummary(row, revokedAt));
      return row;
    });
    return this.leaderboardExceptionSummary(updated, revokedAt);
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

      const persisted = await transaction.duplicateReview.findUnique?.({
        where: { id: reviewId },
        include: { lead: true },
      });
      if (!persisted) throw new NotFoundError("The duplicate review was not found after it was updated");
      return persisted;
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
    return this.duplicateReviewWithLead(reviewed as Record<string, unknown>);
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
      const adminDueAt = asDate(followUp.adminReassignmentSlaDueAt);
      const reassignmentOverdue = followUp.status === "NEEDS_REASSIGNMENT" && Boolean(adminDueAt && now > adminDueAt);
      if (reassignmentOverdue && !await this.markAdminReassignmentOverdue(transaction, followUp, now, parsed.data.expectedVersion)) {
        throw new StaleVersionError(parsed.data.expectedVersion, number(followUp.version));
      }
      const rule = await this.activeCalendarRule(now, transaction);
      const holidays = await transaction.performanceHoliday.findMany?.({}) ?? [];
      const leaves = await transaction.performanceApprovedLeave.findMany?.({
        where: { bdId: parsed.data.newOwnerId, endsAt: { gt: now } },
      }) ?? [];
      const schedule = {
        timeZone: rule.businessCalendarTimeZone,
        workingDays: rule.workingDays,
        workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
        holidays: holidays.flatMap((row) => asDate(row.holidayDate) ? [asDate(row.holidayDate)!] : []),
        leaves: leaves.flatMap((row) => {
          const startsAt = asDate(row.startsAt); const endsAt = asDate(row.endsAt);
          return startsAt && endsAt ? [{ startsAt, endsAt, ...(row.availableStartHour == null || row.availableEndHour == null ? {} : { availableHours: { startHour: number(row.availableStartHour), endHour: number(row.availableEndHour) } }) }] : [];
        }),
      };
      const result = await transaction.performanceFollowUp.updateMany?.({
        where: {
          id: followUpId,
          version: parsed.data.expectedVersion + (reassignmentOverdue ? 1 : 0),
          status: reassignmentOverdue ? "ADMIN_REASSIGNMENT_OVERDUE" : followUp.status,
        },
        data: {
          ownerId: parsed.data.newOwnerId,
          status: "OPEN",
          reassignedAt: now,
          reassignedById: actor.id,
          slaResumedAt: now,
          slaStartedAt: now,
          slaDueAt: addBusinessHours(now, rule.followUpSlaBusinessHours, schedule),
          adminReassignmentBreachedAt: reassignmentOverdue
            ? now
            : followUp.status === "ADMIN_REASSIGNMENT_OVERDUE"
              ? asDate(followUp.adminReassignmentBreachedAt) ?? now
              : null,
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
          metadata: { adminReassignmentSlaMissed: reassignmentOverdue || followUp.status === "ADMIN_REASSIGNMENT_OVERDUE" }, requestId: null,
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
      const persisted = await transaction.performanceFollowUp.findUnique?.({ where: { id: followUpId }, include: { lead: true } });
      if (!persisted) throw new NotFoundError("The follow-up was not found after reassignment");
      return this.followUpWithLead(persisted);
    });
  }

  async getDuplicateReviewQueue(actor: Actor) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    await this.evaluateOverdueSlas();
    const reviews = await this.database.duplicateReview.findMany?.({
      where: { status: "PENDING" },
      include: { lead: true },
      orderBy: { createdAt: "asc" },
    }) ?? [];
    return reviews.map((review) => this.duplicateReviewWithLead(review));
  }

  async getAdminReassignmentQueue(actor: Actor) {
    if (!actor.isActive || actor.role !== "ADMIN") throw new AuthorizationError();
    this.authorization.assertRole(actor, ["ADMIN"]);
    await this.evaluateOverdueSlas();
    const followUps = await this.database.performanceFollowUp.findMany?.({
      where: { status: { in: ["NEEDS_REASSIGNMENT", "ADMIN_REASSIGNMENT_OVERDUE"] } },
      include: { lead: true },
      orderBy: { adminReassignmentSlaDueAt: "asc" },
    }) ?? [];
    return followUps.map((followUp) => this.followUpWithLead(followUp));
  }

  async getAdminPerformanceDrilldown(actor: Actor, query: unknown) {
    this.authorization.assertRole(actor, ["ADMIN"]);
    await this.evaluateOverdueSlas();
    const parsed = performanceDrilldownQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    return this.performanceDrilldown(parsed.data);
  }

  async getMyPerformanceDrilldown(actor: Actor, query: unknown) {
    if (!actor.isActive || actor.role !== "BD") throw new AuthorizationError();
    const parsed = performanceDrilldownQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid(parsed.error.issues);
    await this.evaluateOverdueSlas();
    return this.performanceDrilldown({ ...parsed.data, bdId: actor.id });
  }

  private async performanceDrilldown(parsed: ReturnType<typeof performanceDrilldownQuerySchema.parse>) {
    const from = new Date(parsed.from);
    const to = new Date(parsed.to);
    if (parsed.metric === "DUPLICATE_REVIEWS") {
      const reviews = await this.database.duplicateReview.findMany?.({
        where: { status: parsed.status, createdAt: { gte: from, lte: to }, ...(parsed.bdId ? { createdById: parsed.bdId } : {}) },
        include: { lead: true }, orderBy: { createdAt: "desc" },
      }) ?? [];
      return reviews.map((review) => ({ kind: "DUPLICATE_REVIEW" as const, review: this.duplicateReviewWithLead(review) }));
    }
    if (parsed.metric === "FOLLOW_UP_SLA") {
      const followUps = await this.database.performanceFollowUp.findMany?.({
        where: this.followUpSlaPeriodWhere(from, to, parsed.bdId, parsed.status),
        include: { lead: true }, orderBy: { recruiterRespondedAt: "desc" },
      }) ?? [];
      const observedAt = this.now();
      return followUps.filter((followUp) => {
        if (followUp.status === "NEEDS_REASSIGNMENT") return false;
        const completedAt = asDate(followUp.completedAt);
        const dueAt = asDate(followUp.slaDueAt);
        return Boolean(completedAt || (dueAt && dueAt <= observedAt));
      }).map((followUp) => ({ kind: "FOLLOW_UP" as const, followUp: this.followUpWithLead(followUp) }));
    }
    if (parsed.metric === "REASSIGNMENTS") {
      const followUps = await this.database.performanceFollowUp.findMany?.({
      where: { reassignedAt: { gte: from, lte: to }, ...(parsed.bdId ? { originalOwnerId: parsed.bdId } : {}), ...(parsed.status ? { status: parsed.status } : {}) },
      include: { lead: true }, orderBy: { reassignedAt: "desc" },
      }) ?? [];
      return followUps.map((followUp) => ({ kind: "FOLLOW_UP" as const, followUp: this.followUpWithLead(followUp) }));
    }
    if (parsed.metric === "RECRUITER_RESPONSES") {
      const leads = await this.database.jobLead.findMany?.({
        where: {
          qualifiedCredit: true,
          appliedDate: { gte: from, lte: to },
          ...(parsed.bdId ? { createdById: parsed.bdId } : {}),
        },
        include: { interviews: { where: { startsAt: { lte: to } } }, statusTransitions: true, offers: true }, orderBy: { appliedDate: "desc" },
      }) ?? [];
      return leads.filter((lead) => outcomeStage(
        lead.status,
        Array.isArray(lead.interviews) ? lead.interviews as Record<string, unknown>[] : [],
        Array.isArray(lead.statusTransitions) ? lead.statusTransitions as Record<string, unknown>[] : [],
        Array.isArray(lead.offers) ? lead.offers as Record<string, unknown>[] : [],
      ) !== "NONE").map((lead) => ({ kind: "LEAD" as const, lead: this.leadSummary(lead) }));
    }
    if (parsed.metric === "INTERVIEWS_SCHEDULED") {
      const interviews = await this.database.interviewRound.findMany?.({
      where: { startsAt: { gte: from, lte: to }, status: { in: ["SCHEDULED", "RESCHEDULE_REQUIRED"] }, ...(parsed.bdId ? { lead: { createdById: parsed.bdId } } : {}) },
      include: { lead: true }, orderBy: { startsAt: "asc" },
      }) ?? [];
      return interviews.map((interview) => ({ kind: "INTERVIEW" as const, interview: this.interviewSummary(interview) }));
    }
    if (parsed.metric === "INTERVIEWS_NEEDING_SCHEDULING") {
      const leads = await this.database.jobLead.findMany?.({
      where: {
        qualifiedCredit: true,
        appliedDate: { gte: from, lte: to },
        status: "RESPONSE_RECEIVED",
        ...(parsed.bdId ? { createdById: parsed.bdId } : {}),
        interviews: { none: { startsAt: { lte: to } } },
      },
      orderBy: { updatedAt: "desc" },
      }) ?? [];
      return leads.map((lead) => ({ kind: "LEAD" as const, lead: this.leadSummary(lead) }));
    }
    if (parsed.metric === "OUTCOMES") {
      const [leads, rules] = await Promise.all([
        this.database.jobLead.findMany?.({
          where: { qualifiedCredit: true, appliedDate: { gte: from, lte: to }, ...(parsed.bdId ? { createdById: parsed.bdId } : {}) },
          include: { interviews: true, statusTransitions: true, offers: true }, orderBy: { appliedDate: "desc" },
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
      }).map((lead) => ({ kind: "LEAD" as const, lead: this.leadSummary(lead) }));
    }
    const leads = await this.database.jobLead.findMany?.({
      where: { qualifiedCredit: true, appliedDate: { gte: from, lte: to }, ...(parsed.bdId ? { createdById: parsed.bdId } : {}) },
      orderBy: { appliedDate: "desc" },
    }) ?? [];
    return leads.map((lead) => ({ kind: "LEAD" as const, lead: this.leadSummary(lead) }));
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
    const observedAt = this.now();
    const exceptions = await this.database.performanceLeaderboardException?.findMany?.({
      where: { effectiveFrom: { lte: observedAt }, expiresAt: { gt: observedAt }, revokedAt: null },
    }) ?? [];
    const activeExceptions = exceptions.filter((exception) => {
      const effectiveFrom = asDate(exception.effectiveFrom);
      const expiresAt = asDate(exception.expiresAt);
      return Boolean(effectiveFrom && expiresAt && effectiveFrom <= observedAt && expiresAt > observedAt && !exception.revokedAt);
    });
    const exceptionByBdId = new Map(activeExceptions.map((exception) => [String(exception.bdId), exception]));
    return Promise.all(selected.map((bd) => this.performanceRow(bd, period, exceptionByBdId.get(String(bd.id)))));
  }

  private async performanceRow(bd: Record<string, unknown>, period: { from: string; to: string }, activeException?: Record<string, unknown>) {
    const from = new Date(period.from); const to = new Date(period.to); const now = this.now();
    const bdStartedAt = asDate(bd.createdAt) ?? from;
    const accumulationFrom = bdStartedAt > from ? new Date(Date.UTC(bdStartedAt.getUTCFullYear(), bdStartedAt.getUTCMonth(), bdStartedAt.getUTCDate())) : from;
    const ruleWindowFrom = bdStartedAt < from ? bdStartedAt : from;
    const ruleWindowTo = now > to ? now : to;
    const targetWindowFrom = now < from ? now : from;
    const targetWindowTo = now > to ? now : to;
    const [leads, interviews, followUps, targets, holidays, leaves, rules] = await Promise.all([
      this.database.jobLead.findMany?.({
        where: { createdById: String(bd.id), appliedDate: { gte: from, lte: to } },
        include: {
          company: { select: { canonicalName: true } },
          sourceRef: { select: { name: true } },
          contacts: { where: { role: "RECRUITER", isPrimary: true }, include: { contact: { select: { name: true, email: true } } } },
          statusTransitions: true,
          offers: true,
        },
      }) ?? [],
      this.database.interviewRound.findMany?.({ where: { lead: { createdById: String(bd.id) }, startsAt: { lte: to } } }) ?? [],
      this.database.performanceFollowUp.findMany?.({ where: this.followUpSlaPeriodWhere(from, to, String(bd.id)) }) ?? [],
      this.database.bdTargetSchedule.findMany?.({ where: { bdId: String(bd.id), effectiveFrom: { lte: targetWindowTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetWindowFrom } }] } }) ?? [],
      this.database.performanceHoliday.findMany?.({}) ?? [],
      this.database.performanceApprovedLeave.findMany?.({ where: { bdId: String(bd.id), startsAt: { lte: to }, endsAt: { gt: from } } }) ?? [],
      this.database.performanceRuleSet.findMany?.({ where: { effectiveFrom: { lte: ruleWindowTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: ruleWindowFrom } }] }, orderBy: { effectiveFrom: "asc" } }) ?? [],
    ]);
    const leadIds = leads.map((lead) => String(lead.id));
    const [qualityEvents, duplicateReviews] = await Promise.all([
      leadIds.length
        ? this.database.activityEvent.findMany?.({ where: { leadId: { in: leadIds }, action: { in: ["performance.record_corrected", "performance.record_audit_passed", "performance.record_audit_failed"] } }, orderBy: { occurredAt: "asc" } }) ?? []
        : [],
      leadIds.length
        ? this.database.duplicateReview.findMany?.({ where: { leadId: { in: leadIds } } }) ?? []
        : [],
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
    for (let date = new Date(Date.UTC(accumulationFrom.getUTCFullYear(), accumulationFrom.getUTCMonth(), accumulationFrom.getUTCDate())); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
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
    const highestOutcomeForLead = (lead: Record<string, unknown>) => outcomeStage(
      lead.status,
      interviewsByLead.get(String(lead.id)) ?? [],
      Array.isArray(lead.statusTransitions) ? lead.statusTransitions as Record<string, unknown>[] : [],
      Array.isArray(lead.offers) ? lead.offers as Record<string, unknown>[] : [],
    );
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
      return sum + calculateOutcomeScore([{ highestStage: highestOutcomeForLead(lead) }], {
        POSITIVE_REPLY: number(appliedRule.positiveReplyPoints, 1), SCREENING: number(appliedRule.screeningPoints, 2), INTERVIEW: number(appliedRule.interviewPoints, 3), OFFER: number(appliedRule.offerPoints, 5),
      });
    }, 0) / matured.length;
    const balanced = calculateBalancedScore({
      effectiveAttainmentPercent: effectiveTargetAttainmentPercent,
      followUpSlaCompliancePercent,
      outcome: { scorePercent: maturedOutcomeScorePercent, maturityElapsed: initialMaturityElapsed },
      weights: scoreWeights,
    });
    const eligibility = evaluateEligibility({
      eligibleWorkingDays,
      initialMaturityElapsed,
      qualifiedApplications: qualified,
      maturedApplications: matured.length,
      evaluatedAt: now,
      ...(activeException ? { adminOverride: { type: String(activeException.type) === "EXCLUDE" ? "EXCLUDE" as const : "PROVISIONAL" as const, reason: String(activeException.reason), expiresAt: asDate(activeException.expiresAt) ?? now } } : {}),
    });
    const performance = {
      qualifiedApplications: qualified, targetApplications: Math.round(targetApplications), rawTargetAttainmentPercent: Math.round(rawTargetAttainmentPercent * 10) / 10,
      effectiveTargetAttainmentPercent, recruiterResponses: qualifiedLeads.filter((lead) => highestOutcomeForLead(lead) !== "NONE").length,
      interviewsScheduled: interviews.filter((interview) => asDate(interview.startsAt) && asDate(interview.startsAt)! >= from && asDate(interview.startsAt)! <= to && ["SCHEDULED", "RESCHEDULE_REQUIRED"].includes(String(interview.status))).length,
      interviewsNeedingScheduling: qualifiedLeads.filter((lead) => lead.status === "RESPONSE_RECEIVED" && !(interviewsByLead.get(String(lead.id))?.length)).length,
      followUpSlaCompliancePercent: followUpSlaCompliancePercent === null ? null : Math.round(followUpSlaCompliancePercent * 10) / 10,
      maturedOutcomeScorePercent, balancedScore: balanced.score, scoreCoverage: balanced.status, scoreCoveragePercent: balanced.coveragePercent,
    };
    const qualityResult = this.qualityIndicators(leads, qualityEvents, duplicateReviews);
    return {
      bdId: String(bd.id), bdName: String(bd.displayName), rank: null, eligible: eligibility.eligible, eligibilitySection: eligibility.section, qualifiedApplications: qualified,
      performance, warnings: eligibility.warnings,
      ineligibilityReason: eligibility.reasons[0] ?? null,
      eligibilityProgress: Math.min(100, Math.round((eligibleWorkingDays / 10) * 100)),
      estimatedEligibilityDate: this.estimatedEligibilityDate(bdStartedAt, rules, schedule, initialRule),
      currentDailyTarget: number(this.targetAt(targets, now)?.dailyTarget, number(this.ruleAt(rules, now).defaultDailyTarget, 70)),
      quality: qualityResult.values,
      qualityCounts: qualityResult.counts,
      adminException: activeException ? this.leaderboardExceptionSummary(activeException, now) : null,
    };
  }

  private followUpSlaPeriodWhere(from: Date, to: Date, ownerId?: string, status?: string) {
    const withinPeriod = { gte: from, lte: to };
    const statusFilter = status ? { status } : {};

    if (!ownerId) {
      return {
        ...statusFilter,
        OR: [
          { reassignedAt: null, recruiterRespondedAt: withinPeriod },
          { slaResumedAt: withinPeriod },
          { slaResumedAt: null, reassignedAt: withinPeriod },
        ],
      };
    }

    return {
      ...statusFilter,
      ownerId,
      OR: [
        { originalOwnerId: ownerId, recruiterRespondedAt: withinPeriod },
        {
          originalOwnerId: { not: ownerId },
          OR: [
            { slaResumedAt: withinPeriod },
            { slaResumedAt: null, reassignedAt: withinPeriod },
          ],
        },
      ],
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
      scoreCoveragePercent: rows.length
        ? Math.round(rows.reduce((sum, row) => sum + number((row as { scoreCoveragePercent?: unknown }).scoreCoveragePercent), 0) / rows.length * 10) / 10
        : 0,
    };
  }

  private qualityIndicators(
    leads: readonly Record<string, unknown>[],
    events: readonly Record<string, unknown>[],
    reviews: readonly Record<string, unknown>[],
  ) {
    const total = leads.length;
    const eventsByLead = new Map<string, Record<string, unknown>[]>();
    for (const event of events) {
      const key = String(event.leadId);
      eventsByLead.set(key, [...(eventsByLead.get(key) ?? []), event]);
    }
    const needsCorrection = (leadId: string) => {
      const history = eventsByLead.get(leadId) ?? [];
      const lastFailure = [...history].reverse().find((event) => event.action === "performance.record_audit_failed");
      const lastResolution = [...history].reverse().find((event) => ["performance.record_audit_passed", "performance.record_corrected"].includes(String(event.action)));
      return Boolean(lastFailure && (asDate(lastResolution?.occurredAt)?.getTime() ?? 0) < (asDate(lastFailure.occurredAt)?.getTime() ?? Number.POSITIVE_INFINITY));
    };
    const hasStandardizedCompany = (lead: Record<string, unknown>) => {
      const company = lead.company as Record<string, unknown> | undefined;
      return Boolean(company && usableText(company.canonicalName) && normalizedText(company.canonicalName) === normalizedText(lead.companyName));
    };
    const hasDetectedPlatform = (lead: Record<string, unknown>) => {
      const source = lead.sourceRef as Record<string, unknown> | undefined;
      return Boolean(source && usableText(source.name) && normalizedText(source.name) === jobUrlHost(lead.rawUrl));
    };
    const hasRecruiter = (lead: Record<string, unknown>) => Array.isArray(lead.contacts) && lead.contacts.some((entry) => {
      const link = entry as Record<string, unknown>;
      const contact = link.contact as Record<string, unknown> | undefined;
      return link.role === "RECRUITER" && link.isPrimary === true && Boolean(contact && usableText(contact.name) && hasValidRecruiterEmail(contact.email));
    });
    const healthy = leads.filter((lead) => (
      usableText(lead.companyName)
      && usableText(lead.jobTitle)
      && hasUsableJobUrl(lead.rawUrl)
      && hasStandardizedCompany(lead)
      && hasDetectedPlatform(lead)
      && hasRecruiter(lead)
      && !needsCorrection(String(lead.id))
    )).length;
    const corrections = new Set(events.filter((event) => event.action === "performance.record_corrected").map((event) => String(event.leadId)));
    const latestAudit = new Map<string, Record<string, unknown>>();
    for (const event of events) {
      if (!["performance.record_audit_passed", "performance.record_audit_failed"].includes(String(event.action))) continue;
      const leadId = String(event.leadId);
      const prior = latestAudit.get(leadId);
      if (!prior || (asDate(prior.occurredAt)?.getTime() ?? 0) <= (asDate(event.occurredAt)?.getTime() ?? 0)) latestAudit.set(leadId, event);
    }
    const audited = Array.from(latestAudit.values());
    const duplicateLeadIds = new Set(leads.filter((lead) => lead.duplicateClassification === "CONFIRMED").map((lead) => String(lead.id)));
    for (const review of reviews) if (review.status === "REJECTED") duplicateLeadIds.add(String(review.leadId));
    const counts = {
      recordHealth: { numerator: healthy, denominator: total },
      adminAuditPass: { numerator: audited.filter((event) => event.action === "performance.record_audit_passed").length, denominator: audited.length },
      corrections: { numerator: corrections.size, denominator: total },
      confirmedDuplicates: { numerator: leads.filter((lead) => lead.duplicateClassification === "CONFIRMED").length, denominator: total },
      pendingOverrides: { numerator: reviews.filter((review) => review.status === "PENDING").length, denominator: total },
      rejectedOverrides: { numerator: reviews.filter((review) => review.status === "REJECTED").length, denominator: total },
      duplicates: { numerator: duplicateLeadIds.size, denominator: total },
    };
    return { counts, values: {
      recordHealthRate: percentage(counts.recordHealth.numerator, counts.recordHealth.denominator),
      adminAuditPassRate: percentage(counts.adminAuditPass.numerator, counts.adminAuditPass.denominator),
      correctionRate: percentage(counts.corrections.numerator, counts.corrections.denominator),
      confirmedDuplicateRate: percentage(counts.confirmedDuplicates.numerator, counts.confirmedDuplicates.denominator),
      pendingOverrideRate: percentage(counts.pendingOverrides.numerator, counts.pendingOverrides.denominator),
      rejectedOverrideRate: percentage(counts.rejectedOverrides.numerator, counts.rejectedOverrides.denominator),
      duplicateRate: percentage(counts.duplicates.numerator, counts.duplicates.denominator),
    } };
  }

  private aggregateQuality(rows: Array<Record<string, unknown>>) {
    const empty = { numerator: 0, denominator: 0 };
    const totals = {
      recordHealth: { ...empty }, adminAuditPass: { ...empty }, corrections: { ...empty },
      confirmedDuplicates: { ...empty }, pendingOverrides: { ...empty }, rejectedOverrides: { ...empty }, duplicates: { ...empty },
    };
    for (const row of rows) {
      const counts = row.qualityCounts as Record<string, { numerator?: unknown; denominator?: unknown }> | undefined;
      if (!counts) continue;
      for (const [key, total] of Object.entries(totals)) {
        const count = counts[key];
        total.numerator += number(count?.numerator);
        total.denominator += number(count?.denominator);
      }
    }
    return {
      recordHealthRate: percentage(totals.recordHealth.numerator, totals.recordHealth.denominator),
      adminAuditPassRate: percentage(totals.adminAuditPass.numerator, totals.adminAuditPass.denominator),
      correctionRate: percentage(totals.corrections.numerator, totals.corrections.denominator),
      confirmedDuplicateRate: percentage(totals.confirmedDuplicates.numerator, totals.confirmedDuplicates.denominator),
      pendingOverrideRate: percentage(totals.pendingOverrides.numerator, totals.pendingOverrides.denominator),
      rejectedOverrideRate: percentage(totals.rejectedOverrides.numerator, totals.rejectedOverrides.denominator),
      duplicateRate: percentage(totals.duplicates.numerator, totals.duplicates.denominator),
    };
  }

  private leaderboardRow(row: Record<string, unknown>) {
    return {
      bdId: String(row.bdId), bdName: String(row.bdName), rank: typeof row.rank === "number" ? row.rank : null,
      eligible: Boolean(row.eligible), qualifiedApplications: number(row.qualifiedApplications), performance: row.performance,
      eligibilityProgress: number(row.eligibilityProgress), ineligibilityReason: typeof row.ineligibilityReason === "string" ? row.ineligibilityReason : null,
      estimatedEligibilityDate: iso(row.estimatedEligibilityDate), eligibilitySection: String(row.eligibilitySection), warnings: Array.isArray(row.warnings) ? row.warnings : [], quality: row.quality,
      adminException: row.adminException ?? null,
    };
  }

  private leadSummary(lead: Record<string, unknown>) {
    return {
      id: String(lead.id), profileId: String(lead.profileId), createdById: String(lead.createdById), currentOwnerId: String(lead.currentOwnerId),
      companyName: String(lead.companyName), jobTitle: String(lead.jobTitle), appliedDate: isoDate(lead.appliedDate), status: String(lead.status),
    };
  }

  private duplicateReviewSummary(review: Record<string, unknown>) {
    return {
      id: String(review.id), leadId: String(review.leadId), classification: String(review.classification), status: String(review.status), overrideReason: String(review.overrideReason),
      reviewerId: review.reviewerId ? String(review.reviewerId) : null, reviewReason: typeof review.reviewReason === "string" ? review.reviewReason : null,
      reviewedAt: iso(review.reviewedAt), expiresAt: iso(review.expiresAt), overdueAt: iso(review.overdueAt), provisionalCreditGranted: Boolean(review.provisionalCreditGranted),
      provisionalCreditResolvedAt: iso(review.provisionalCreditResolvedAt), createdById: String(review.createdById), auditMetadata: review.auditMetadata ?? null,
      version: number(review.version, 1), createdAt: iso(review.createdAt), updatedAt: iso(review.updatedAt),
    };
  }

  private duplicateReviewWithLead(review: Record<string, unknown>) {
    return { ...this.duplicateReviewSummary(review), lead: this.leadSummary((review.lead as Record<string, unknown>) ?? {}) };
  }

  private followUpSummary(followUp: Record<string, unknown>) {
    return {
      id: String(followUp.id), leadId: String(followUp.leadId), ownerId: String(followUp.ownerId), originalOwnerId: String(followUp.originalOwnerId), status: String(followUp.status),
      recruiterRespondedAt: iso(followUp.recruiterRespondedAt), slaStartedAt: iso(followUp.slaStartedAt), slaPausedAt: iso(followUp.slaPausedAt), slaResumedAt: iso(followUp.slaResumedAt),
      slaDueAt: iso(followUp.slaDueAt), completedAt: iso(followUp.completedAt), breachedAt: iso(followUp.breachedAt), adminReassignmentSlaStartedAt: iso(followUp.adminReassignmentSlaStartedAt),
      adminReassignmentSlaDueAt: iso(followUp.adminReassignmentSlaDueAt), adminReassignmentBreachedAt: iso(followUp.adminReassignmentBreachedAt), reassignedAt: iso(followUp.reassignedAt),
      reassignedById: followUp.reassignedById ? String(followUp.reassignedById) : null, auditMetadata: followUp.auditMetadata ?? null, version: number(followUp.version, 1),
      createdAt: iso(followUp.createdAt), updatedAt: iso(followUp.updatedAt),
    };
  }

  private followUpWithLead(followUp: Record<string, unknown>) {
    return { ...this.followUpSummary(followUp), lead: this.leadSummary((followUp.lead as Record<string, unknown>) ?? {}) };
  }

  private interviewSummary(interview: Record<string, unknown>) {
    return {
      id: String(interview.id), leadId: String(interview.leadId), roundNumber: number(interview.roundNumber), roundType: String(interview.roundType), status: String(interview.status),
      closerId: String(interview.closerId), startsAt: iso(interview.startsAt), endsAt: iso(interview.endsAt), lead: this.leadSummary((interview.lead as Record<string, unknown>) ?? {}),
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

  private estimatedEligibilityDate(
    startedAt: Date,
    rules: readonly Record<string, unknown>[],
    baseSchedule: {
      timeZone: string;
      workingDays: number[];
      workday: { startHour: number; endHour: number };
      holidays?: Date[];
      leaves?: Array<{ startsAt: Date; endsAt: Date; availableHours?: { startHour: number; endHour: number } }>;
    },
    initialRule: Record<string, unknown>,
  ): Date | null {
    if (Number.isNaN(startedAt.getTime())) return null;
    let count = 0;
    const day = new Date(Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), startedAt.getUTCDate()));
    for (let attempts = 0; attempts < 11 * 366; attempts += 1, day.setUTCDate(day.getUTCDate() + 1)) {
      const rule = this.ruleAt(rules, day);
      const schedule = {
        ...baseSchedule,
        timeZone: String(rule.businessCalendarTimeZone ?? baseSchedule.timeZone),
        workingDays: Array.isArray(rule.workingDays) ? rule.workingDays.map(Number) : baseSchedule.workingDays,
        workday: { startHour: number(rule.workdayStartHour, baseSchedule.workday.startHour), endHour: number(rule.workdayEndHour, baseSchedule.workday.endHour) },
      };
      if (!isEligibleWorkingDay(day, schedule)) continue;
      count += 1;
      if (count === 10) return new Date(Math.max(day.getTime(), maturityDate(startedAt, number(initialRule.maturityWindowDays, 21)).getTime()));
    }
    return null;
  }

  private assertAdmin(actor: Actor) {
    if (!actor.isActive || actor.role !== "ADMIN") throw new AuthorizationError();
    this.authorization.assertRole(actor, ["ADMIN"]);
  }

  private async assertActiveBd(bdId: string) {
    const bd = await this.database.user.findUnique?.({ where: { id: bdId } });
    if (!bd || bd.role !== "BD" || !bd.isActive) throw new ValidationError("The selected user is not an active BD");
  }

  private async nextTargetChangeBoundary(at: Date): Promise<Date> {
    const [rule, holidays] = await Promise.all([
      this.activeCalendarRule(at),
      this.database.performanceHoliday.findMany?.({}) ?? [],
    ]);
    return nextEligibleWorkingDay(at, {
      timeZone: rule.businessCalendarTimeZone,
      workingDays: rule.workingDays,
      workday: { startHour: rule.workdayStartHour, endHour: rule.workdayEndHour },
      holidays: holidays.flatMap((holiday) => asDate(holiday.holidayDate) ? [asDate(holiday.holidayDate)!] : []),
    });
  }

  private async currentCalendarDate(): Promise<Date> {
    const now = this.now();
    const rule = await this.activeCalendarRule(now);
    return businessCalendarDate(now, rule.businessCalendarTimeZone);
  }

  private async isStartedHoliday(holiday: Record<string, unknown>): Promise<boolean> {
    const holidayDate = asDate(holiday.holidayDate);
    return Boolean(holidayDate && holidayDate <= await this.currentCalendarDate());
  }

  private isStartedLeave(leave: Record<string, unknown>): boolean {
    const startsAt = asDate(leave.startsAt);
    return Boolean(startsAt && startsAt <= this.now());
  }

  private intervalsOverlap(start: Date, end: Date | null, candidateStart: Date, candidateEnd: Date | null) {
    return start.getTime() < (candidateEnd?.getTime() ?? Number.POSITIVE_INFINITY)
      && candidateStart.getTime() < (end?.getTime() ?? Number.POSITIVE_INFINITY);
  }

  private async assertTargetWindowAvailable(database: PerformanceDatabase, bdId: string, effectiveFrom: Date, effectiveTo: Date | null, exceptId?: string) {
    const rows = await database.bdTargetSchedule.findMany?.({ where: { bdId, ...(exceptId ? { id: { not: exceptId } } : {}) } }) ?? [];
    if (rows.some((row) => {
      const start = asDate(row.effectiveFrom); if (!start) return false;
      return this.intervalsOverlap(effectiveFrom, effectiveTo, start, asDate(row.effectiveTo));
    })) throw new ConflictError("BD target schedule effective dates overlap an existing schedule");
  }

  private async assertLeaveWindowAvailable(database: PerformanceDatabase, bdId: string, startsAt: Date, endsAt: Date, exceptId?: string) {
    const rows = await database.performanceApprovedLeave.findMany?.({ where: { bdId, ...(exceptId ? { id: { not: exceptId } } : {}) } }) ?? [];
    if (rows.some((row) => {
      const start = asDate(row.startsAt); const end = asDate(row.endsAt);
      return Boolean(start && end && this.intervalsOverlap(startsAt, endsAt, start, end));
    })) throw new ConflictError("Approved leave overlaps an existing leave period");
  }

  private async assertExceptionWindowAvailable(database: PerformanceDatabase, bdId: string, effectiveFrom: Date, expiresAt: Date) {
    const rows = await database.performanceLeaderboardException.findMany?.({ where: { bdId, revokedAt: null } }) ?? [];
    if (rows.some((row) => {
      const start = asDate(row.effectiveFrom); const end = asDate(row.expiresAt);
      return Boolean(start && end && this.intervalsOverlap(effectiveFrom, expiresAt, start, end));
    })) throw new ConflictError("A leaderboard exception already applies during this period");
  }

  private async auditPerformanceControl(
    database: PerformanceDatabase,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    oldSnapshot: Record<string, unknown> | null,
    newSnapshot: Record<string, unknown> | null,
  ) {
    await database.activityEvent.create?.({ data: {
      action, actorId: actor.id, actorNameSnapshot: actor.displayName, actorRoleSnapshot: actor.role,
      profileId: null, leadId: null, entityType, entityId, oldSnapshot, newSnapshot,
      metadata: { source: "performance_admin_controls" }, requestId: null,
    } });
  }

  private targetScheduleSummary(schedule: Record<string, unknown>) {
    return {
      id: String(schedule.id), bdId: String(schedule.bdId), dailyTarget: number(schedule.dailyTarget, 70),
      effectiveFrom: iso(schedule.effectiveFrom), effectiveTo: iso(schedule.effectiveTo), createdById: String(schedule.createdById),
      auditMetadata: schedule.auditMetadata ?? null, version: number(schedule.version, 1), createdAt: iso(schedule.createdAt), updatedAt: iso(schedule.updatedAt),
    };
  }

  private holidaySummary(holiday: Record<string, unknown>) {
    return {
      id: String(holiday.id), holidayDate: isoDate(holiday.holidayDate), name: String(holiday.name), createdById: String(holiday.createdById),
      auditMetadata: holiday.auditMetadata ?? null, version: number(holiday.version, 1), createdAt: iso(holiday.createdAt), updatedAt: iso(holiday.updatedAt),
    };
  }

  private leaveSummary(leave: Record<string, unknown>) {
    return {
      id: String(leave.id), bdId: String(leave.bdId), startsAt: iso(leave.startsAt), endsAt: iso(leave.endsAt),
      reason: typeof leave.reason === "string" ? leave.reason : null,
      availableStartHour: leave.availableStartHour == null ? null : number(leave.availableStartHour),
      availableEndHour: leave.availableEndHour == null ? null : number(leave.availableEndHour),
      approvedById: String(leave.approvedById), approvedAt: iso(leave.approvedAt), auditMetadata: leave.auditMetadata ?? null,
      version: number(leave.version, 1), createdAt: iso(leave.createdAt), updatedAt: iso(leave.updatedAt),
    };
  }

  private leaderboardExceptionSummary(exception: Record<string, unknown>, observedAt: Date) {
    const effectiveFrom = asDate(exception.effectiveFrom);
    const expiresAt = asDate(exception.expiresAt);
    return {
      id: String(exception.id), bdId: String(exception.bdId), type: String(exception.type), reason: String(exception.reason),
      effectiveFrom: iso(exception.effectiveFrom), expiresAt: iso(exception.expiresAt), createdById: String(exception.createdById),
      revokedAt: iso(exception.revokedAt), revokedById: exception.revokedById ? String(exception.revokedById) : null,
      revocationReason: typeof exception.revocationReason === "string" ? exception.revocationReason : null,
      auditMetadata: exception.auditMetadata ?? null, version: number(exception.version, 1), createdAt: iso(exception.createdAt), updatedAt: iso(exception.updatedAt),
      active: Boolean(effectiveFrom && expiresAt && effectiveFrom <= observedAt && expiresAt > observedAt && !exception.revokedAt),
    };
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
      database.performanceApprovedLeave.findMany?.({ where: { bdId: originalOwnerId, endsAt: { gt: respondedAt } } }) ?? [],
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
    const needsReassignment = leaves.some((leave) => {
      const startsAt = asDate(leave.startsAt); const endsAt = asDate(leave.endsAt);
      return Boolean(startsAt && endsAt && startsAt <= respondedAt && endsAt > respondedAt);
    });
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
        return this.markAdminReassignmentOverdue(transaction, followUp, at);
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

  private async markAdminReassignmentOverdue(
    database: PerformanceDatabase,
    followUp: Record<string, unknown>,
    at: Date,
    expectedVersion?: number,
  ) {
    const changed = await database.performanceFollowUp.updateMany?.({
      where: {
        id: String(followUp.id),
        status: "NEEDS_REASSIGNMENT",
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: { status: "ADMIN_REASSIGNMENT_OVERDUE", adminReassignmentBreachedAt: at, version: { increment: 1 } },
    });
    if (!changed?.count) return false;
    const lead = followUp.lead as Record<string, unknown> | undefined;
    await database.activityEvent.create?.({ data: {
      action: "performance.admin_reassignment_overdue", actorId: null, actorNameSnapshot: null, actorRoleSnapshot: null,
      profileId: lead?.profileId ? String(lead.profileId) : null, leadId: lead?.id ? String(lead.id) : null,
      entityType: "performance_follow_up", entityId: String(followUp.id), oldSnapshot: { status: "NEEDS_REASSIGNMENT" },
      newSnapshot: { status: "ADMIN_REASSIGNMENT_OVERDUE", breachedAt: at.toISOString() }, metadata: null, requestId: null,
    } });
    await this.appendAdminAlerts(database, `performance-reassignment-overdue:${String(followUp.id)}`, "Admin reassignment overdue", String(lead?.jobTitle ?? "Recruiter follow-up"), String(lead?.id ?? followUp.leadId));
    return true;
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
