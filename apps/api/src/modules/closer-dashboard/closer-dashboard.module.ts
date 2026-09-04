import { Module } from "@nestjs/common";
import { CloserDashboardService, GoogleCalendarService, NotificationsService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";

import { IdentityModule } from "../identity/identity.module";
import { CalendarModule } from "../calendar/calendar.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CloserDashboardController } from "./closer-dashboard.controller";

const closerDashboardDatabase = database as unknown as LeadsDatabase;

@Module({
  imports: [IdentityModule, NotificationsModule, CalendarModule],
  controllers: [CloserDashboardController],
  providers: [
    {
      provide: CloserDashboardService,
      inject: [NotificationsService, GoogleCalendarService],
      useFactory: (notifications: NotificationsService, googleCalendar: GoogleCalendarService) =>
        new CloserDashboardService(closerDashboardDatabase, notifications, undefined, googleCalendar),
    },
  ],
  exports: [CloserDashboardService],
})
export class CloserDashboardModule {}
