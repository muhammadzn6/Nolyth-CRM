import { Module } from "@nestjs/common";
import { AuthorizationService, NotificationsService, OffersService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OffersController } from "./offers.controller";
const offersDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule, NotificationsModule], controllers: [OffersController], providers: [{ provide: OffersService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new OffersService(offersDatabase, authorization) }], exports: [OffersService] })
export class OffersModule {}
