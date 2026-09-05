import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticationError,
  PerformanceService,
  ValidationError,
} from "@orbit/backend";
import {
  adminBdPerformanceResponseSchema,
  bdPerformanceResponseSchema,
  duplicateReviewWithLeadSchema,
  bdTargetScheduleInputSchema,
  bdTargetScheduleListQuerySchema,
  bdTargetScheduleSchema,
  performanceApprovedLeaveInputSchema,
  performanceApprovedLeaveListQuerySchema,
  performanceApprovedLeaveSchema,
  performanceHolidayInputSchema,
  performanceHolidaySchema,
  performanceLeaderboardExceptionInputSchema,
  performanceLeaderboardExceptionListQuerySchema,
  performanceLeaderboardExceptionSchema,
  performanceVersionInputSchema,
  performanceDrilldownResponseSchema,
  performanceDrilldownQuerySchema,
  performanceRecordAuditInputSchema,
  performanceRecordAuditSchema,
  performanceFollowUpWithLeadSchema,
  performancePeriodQuerySchema,
  performanceRuleInputSchema,
  performanceRuleMutationSchema,
  performanceRulePreviewSchema,
  performanceRuleSchema,
  reassignPerformanceFollowUpInputSchema,
  revokePerformanceLeaderboardExceptionInputSchema,
  updateBdTargetScheduleInputSchema,
  updateDuplicateReviewInputSchema,
  updatePerformanceApprovedLeaveInputSchema,
  updatePerformanceHolidayInputSchema,
  uuidSchema,
} from "@orbit/contracts";

import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } };
  parse(value: unknown): T;
};

function parse<T>(schema: Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError("The request payload is invalid", parsed.error.issues);
  return parsed.data;
}

function parseResponse<T>(schema: Pick<Schema<T>, "parse">, value: unknown): T {
  return schema.parse(value);
}

const nullablePerformanceRuleSchema = performanceRuleSchema.nullable();
const duplicateReviewQueueSchema = duplicateReviewWithLeadSchema.array();
const targetScheduleListSchema = bdTargetScheduleSchema.array();
const holidayListSchema = performanceHolidaySchema.array();
const leaveListSchema = performanceApprovedLeaveSchema.array();
const leaderboardExceptionListSchema = performanceLeaderboardExceptionSchema.array();

@Controller("performance")
@UseGuards(IdentityGuard)
export class PerformanceController {
  constructor(@Inject(PerformanceService) private readonly performance: PerformanceService) {}

  @Get("admin") admin(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .getAdminBdPerformance(this.actor(request), parse(performancePeriodQuerySchema, query))
      .then((response) => parseResponse(adminBdPerformanceResponseSchema, response));
  }

  @Get("me") mine(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    const { bdId: _bdId, ...period } = parse(performancePeriodQuerySchema, query);
    return this.performance
      .getBdPerformance(this.actor(request), period)
      .then((response) => parseResponse(bdPerformanceResponseSchema, response));
  }

  @Get("me/drilldown") myDrilldown(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .getMyPerformanceDrilldown(this.actor(request), parse(performanceDrilldownQuerySchema, query))
      .then((response) => parseResponse(performanceDrilldownResponseSchema, response));
  }

  @Get("admin/drilldown") drilldown(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .getAdminPerformanceDrilldown(this.actor(request), parse(performanceDrilldownQuerySchema, query))
      .then((response) => parseResponse(performanceDrilldownResponseSchema, response));
  }

  @Get("rules") rules(@Req() request: AuthenticatedRequest) {
    return this.performance
      .getPerformanceRules(this.actor(request))
      .then((response) => parseResponse(nullablePerformanceRuleSchema, response));
  }

  @Post("rules/preview") previewRules(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .previewPerformanceRules(this.actor(request), parse(performanceRuleInputSchema, input))
      .then((response) => parseResponse(performanceRulePreviewSchema, response));
  }

  @Patch("rules") updateRules(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .updatePerformanceRules(this.actor(request), parse(performanceRuleMutationSchema, input))
      .then((response) => parseResponse(performanceRuleSchema, response));
  }

  @Get("admin/targets") targets(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .listBdTargetSchedules(this.actor(request), parse(bdTargetScheduleListQuerySchema, query))
      .then((response) => parseResponse(targetScheduleListSchema, response));
  }

  @Post("admin/targets") createTarget(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .createBdTargetSchedule(this.actor(request), parse(bdTargetScheduleInputSchema, input))
      .then((response) => parseResponse(bdTargetScheduleSchema, response));
  }

  @Patch("admin/targets/:scheduleId") updateTarget(@Param("scheduleId") scheduleId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .updateBdTargetSchedule(this.actor(request), parse(uuidSchema, scheduleId), parse(updateBdTargetScheduleInputSchema, input))
      .then((response) => parseResponse(bdTargetScheduleSchema, response));
  }

  @Delete("admin/targets/:scheduleId") deleteTarget(@Param("scheduleId") scheduleId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.deleteBdTargetSchedule(this.actor(request), parse(uuidSchema, scheduleId), parse(performanceVersionInputSchema, input));
  }

  @Get("admin/holidays") holidays(@Req() request: AuthenticatedRequest) {
    return this.performance.listPerformanceHolidays(this.actor(request)).then((response) => parseResponse(holidayListSchema, response));
  }

  @Post("admin/holidays") createHoliday(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .createPerformanceHoliday(this.actor(request), parse(performanceHolidayInputSchema, input))
      .then((response) => parseResponse(performanceHolidaySchema, response));
  }

  @Patch("admin/holidays/:holidayId") updateHoliday(@Param("holidayId") holidayId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .updatePerformanceHoliday(this.actor(request), parse(uuidSchema, holidayId), parse(updatePerformanceHolidayInputSchema, input))
      .then((response) => parseResponse(performanceHolidaySchema, response));
  }

  @Delete("admin/holidays/:holidayId") deleteHoliday(@Param("holidayId") holidayId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.deletePerformanceHoliday(this.actor(request), parse(uuidSchema, holidayId), parse(performanceVersionInputSchema, input));
  }

  @Get("admin/leaves") leaves(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .listPerformanceApprovedLeaves(this.actor(request), parse(performanceApprovedLeaveListQuerySchema, query))
      .then((response) => parseResponse(leaveListSchema, response));
  }

  @Post("admin/leaves") createLeave(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .createPerformanceApprovedLeave(this.actor(request), parse(performanceApprovedLeaveInputSchema, input))
      .then((response) => parseResponse(performanceApprovedLeaveSchema, response));
  }

  @Patch("admin/leaves/:leaveId") updateLeave(@Param("leaveId") leaveId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .updatePerformanceApprovedLeave(this.actor(request), parse(uuidSchema, leaveId), parse(updatePerformanceApprovedLeaveInputSchema, input))
      .then((response) => parseResponse(performanceApprovedLeaveSchema, response));
  }

  @Delete("admin/leaves/:leaveId") deleteLeave(@Param("leaveId") leaveId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.deletePerformanceApprovedLeave(this.actor(request), parse(uuidSchema, leaveId), parse(performanceVersionInputSchema, input));
  }

  @Get("admin/leaderboard-exceptions") leaderboardExceptions(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .listLeaderboardExceptions(this.actor(request), parse(performanceLeaderboardExceptionListQuerySchema, query))
      .then((response) => parseResponse(leaderboardExceptionListSchema, response));
  }

  @Post("admin/leaderboard-exceptions") createLeaderboardException(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .createLeaderboardException(this.actor(request), parse(performanceLeaderboardExceptionInputSchema, input))
      .then((response) => parseResponse(performanceLeaderboardExceptionSchema, response));
  }

  @Post("admin/leaderboard-exceptions/:exceptionId/revoke") revokeLeaderboardException(@Param("exceptionId") exceptionId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .revokeLeaderboardException(this.actor(request), parse(uuidSchema, exceptionId), parse(revokePerformanceLeaderboardExceptionInputSchema, input))
      .then((response) => parseResponse(performanceLeaderboardExceptionSchema, response));
  }

  @Get("duplicate-reviews") reviewQueue(@Req() request: AuthenticatedRequest) {
    return this.performance
      .getDuplicateReviewQueue(this.actor(request))
      .then((response) => parseResponse(duplicateReviewQueueSchema, response));
  }

  @Post("duplicate-reviews/:reviewId") review(@Param("reviewId") reviewId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .reviewDuplicateOverride(this.actor(request), parse(uuidSchema, reviewId), parse(updateDuplicateReviewInputSchema, input))
      .then((response) => parseResponse(duplicateReviewWithLeadSchema, response));
  }

  @Post("follow-ups/:followUpId/reassign") reassign(@Param("followUpId") followUpId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .reassignFollowUp(this.actor(request), parse(uuidSchema, followUpId), parse(reassignPerformanceFollowUpInputSchema, input))
      .then((response) => parseResponse(performanceFollowUpWithLeadSchema, response));
  }

  @Post("records/:leadId/audit") auditRecord(@Param("leadId") leadId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance
      .auditLeadRecord(this.actor(request), parse(uuidSchema, leadId), parse(performanceRecordAuditInputSchema, input))
      .then((response) => parseResponse(performanceRecordAuditSchema, response));
  }

  private actor(request: AuthenticatedRequest) {
    if (!request.actor) throw new AuthenticationError();
    return request.actor;
  }
}
