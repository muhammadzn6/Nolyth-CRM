import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { AuthenticationError, CloserDashboardService } from "@orbit/backend";
import { closerDashboardDataSchema } from "@orbit/contracts";

import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

@Controller("closer-dashboard")
@UseGuards(IdentityGuard)
export class CloserDashboardController {
  constructor(
    @Inject(CloserDashboardService)
    private readonly closerDashboard: CloserDashboardService,
  ) {}

  @Get()
  async get(@Req() request: AuthenticatedRequest) {
    if (!request.actor) {
      throw new AuthenticationError();
    }

    return closerDashboardDataSchema.parse(await this.closerDashboard.get(request.actor));
  }
}
