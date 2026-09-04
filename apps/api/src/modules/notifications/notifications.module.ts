import { Module } from "@nestjs/common";
import { NotificationsService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsController } from "./notifications.controller";
const notificationsDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule], controllers: [NotificationsController], providers: [{ provide: NotificationsService, useFactory: () => new NotificationsService(notificationsDatabase) }], exports: [NotificationsService] })
export class NotificationsModule {}
