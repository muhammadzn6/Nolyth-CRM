import { Module } from "@nestjs/common";
import { AuthorizationService, GoogleCalendarService, InterviewsService, NotificationsService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { CalendarModule } from "../calendar/calendar.module";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InterviewsController } from "./interviews.controller";
const interviewsDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule, NotificationsModule, CalendarModule], controllers: [InterviewsController], providers: [{ provide: InterviewsService, inject: [AuthorizationService, GoogleCalendarService], useFactory: (authorization: AuthorizationService, calendar: GoogleCalendarService) => new InterviewsService(interviewsDatabase, authorization, undefined, calendar) }], exports: [InterviewsService] })
export class InterviewsModule {}
