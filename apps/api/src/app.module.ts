import { Module } from "@nestjs/common";

import { CandidatesModule } from "./modules/candidates/candidates.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { OffersModule } from "./modules/offers/offers.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { CloserDashboardModule } from "./modules/closer-dashboard/closer-dashboard.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { ImportsModule } from "./modules/imports/imports.module";

@Module({ imports: [HealthModule, IdentityModule, UsersModule, CandidatesModule, LeadsModule, TasksModule, InterviewsModule, DocumentsModule, AvailabilityModule, OffersModule, NotificationsModule, AnalyticsModule, CloserDashboardModule, CalendarModule, ImportsModule] })
export class AppModule {}
