import { Module } from "@nestjs/common";
import { AuthorizationService, CollaborationService, LeadsService, NotificationsService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PerformanceModule } from "../performance/performance.module";
import { LeadsController } from "./leads.controller";

const leadsDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule, NotificationsModule, PerformanceModule], controllers: [LeadsController], providers: [{ provide: LeadsService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new LeadsService(leadsDatabase, authorization) }, { provide: CollaborationService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new CollaborationService(leadsDatabase, authorization) }], exports: [LeadsService, CollaborationService] })
export class LeadsModule {}
