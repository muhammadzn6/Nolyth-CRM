import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { AnalyticsService, AuthenticationError } from "@orbit/backend";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";
@Controller()
@UseGuards(IdentityGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}
  @Get("dashboard") dashboard(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.analytics.dashboard(this.actor(request), query); }
  @Get("analytics/funnel") funnel(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.analytics.funnel(this.actor(request), query); }
  @Get("analytics/sources") sources(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.analytics.sources(this.actor(request), query); }
  @Get("analytics/companies") companies(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.analytics.companies(this.actor(request), query); }
  private actor(request: AuthenticatedRequest) { if (!request.actor) throw new AuthenticationError(); return request.actor; }
}
