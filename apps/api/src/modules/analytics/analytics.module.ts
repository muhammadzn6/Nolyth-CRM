import { Module } from "@nestjs/common";
import { AnalyticsService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { AnalyticsController } from "./analytics.controller";
const analyticsDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule], controllers: [AnalyticsController], providers: [{ provide: AnalyticsService, useFactory: () => new AnalyticsService(analyticsDatabase) }], exports: [AnalyticsService] })
export class AnalyticsModule {}
