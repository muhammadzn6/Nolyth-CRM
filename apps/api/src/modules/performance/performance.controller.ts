import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticationError,
  PerformanceService,
  ValidationError,
} from "@orbit/backend";
import {
  performanceDrilldownQuerySchema,
  performancePeriodQuerySchema,
  performanceRuleInputSchema,
  performanceRuleMutationSchema,
  reassignPerformanceFollowUpInputSchema,
  updateDuplicateReviewInputSchema,
  uuidSchema,
} from "@orbit/contracts";

import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown } } };

function parse<T>(schema: Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError("The request payload is invalid", parsed.error.issues);
  return parsed.data;
}

@Controller("performance")
@UseGuards(IdentityGuard)
export class PerformanceController {
  constructor(@Inject(PerformanceService) private readonly performance: PerformanceService) {}

  @Get("admin") admin(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.getAdminBdPerformance(this.actor(request), parse(performancePeriodQuerySchema, query));
  }

  @Get("me") mine(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.getBdPerformance(this.actor(request), parse(performancePeriodQuerySchema, query));
  }

  @Get("admin/drilldown") drilldown(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.getAdminPerformanceDrilldown(this.actor(request), parse(performanceDrilldownQuerySchema, query));
  }

  @Get("rules") rules(@Req() request: AuthenticatedRequest) {
    return this.performance.getPerformanceRules(this.actor(request));
  }

  @Post("rules/preview") previewRules(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.previewPerformanceRules(this.actor(request), parse(performanceRuleInputSchema, input));
  }

  @Patch("rules") updateRules(@Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.updatePerformanceRules(this.actor(request), parse(performanceRuleMutationSchema, input));
  }

  @Get("duplicate-reviews") reviewQueue(@Req() request: AuthenticatedRequest) {
    return this.performance.getDuplicateReviewQueue(this.actor(request));
  }

  @Post("duplicate-reviews/:reviewId") review(@Param("reviewId") reviewId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.reviewDuplicateOverride(this.actor(request), parse(uuidSchema, reviewId), parse(updateDuplicateReviewInputSchema, input));
  }

  @Post("follow-ups/:followUpId/reassign") reassign(@Param("followUpId") followUpId: string, @Body() input: unknown, @Req() request: AuthenticatedRequest) {
    return this.performance.reassignFollowUp(this.actor(request), parse(uuidSchema, followUpId), parse(reassignPerformanceFollowUpInputSchema, input));
  }

  private actor(request: AuthenticatedRequest) {
    if (!request.actor) throw new AuthenticationError();
    return request.actor;
  }
}
