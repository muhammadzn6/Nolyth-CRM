import { Module } from "@nestjs/common";
import { AuthorizationService, NotificationsService, PerformanceService, type PerformanceDatabase } from "@orbit/backend";
import { database } from "@orbit/database";

import { IdentityModule } from "../identity/identity.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PerformanceController } from "./performance.controller";

const performanceDatabase = database as unknown as PerformanceDatabase;

@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [PerformanceController],
  providers: [{
    provide: PerformanceService,
    inject: [AuthorizationService, NotificationsService],
    useFactory: (authorization: AuthorizationService, notifications: NotificationsService) => new PerformanceService(performanceDatabase, authorization, notifications),
  }],
  exports: [PerformanceService],
})
export class PerformanceModule {}
