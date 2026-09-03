import { Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticationError, NotificationsService } from "@orbit/backend";
import { uuidSchema } from "@orbit/contracts";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";
@Controller()
@UseGuards(IdentityGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}
  @Get("notifications") list(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.notifications.list(this.actor(request), query); }
  @Post("notifications/:notificationId/read") read(@Param("notificationId") id: string, @Req() request: AuthenticatedRequest) { return this.notifications.read(this.actor(request), uuidSchema.parse(id)); }
  @Post("notifications/read-all") readAll(@Req() request: AuthenticatedRequest) { return this.notifications.readAll(this.actor(request)); }
  @Get("activity") activity(@Query() query: unknown, @Req() request: AuthenticatedRequest) { return this.notifications.activity(this.actor(request), query); }
  private actor(request: AuthenticatedRequest) { if (!request.actor) throw new AuthenticationError(); return request.actor; }
}
