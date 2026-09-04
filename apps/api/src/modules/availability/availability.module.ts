import { Module } from "@nestjs/common";
import { AuthorizationService, AvailabilityService, type LeadsDatabase } from "@orbit/backend";
import { database } from "@orbit/database";
import { IdentityModule } from "../identity/identity.module";
import { AvailabilityController } from "./availability.controller";
const availabilityDatabase = database as unknown as LeadsDatabase;
@Module({ imports: [IdentityModule], controllers: [AvailabilityController], providers: [{ provide: AvailabilityService, inject: [AuthorizationService], useFactory: (authorization: AuthorizationService) => new AvailabilityService(availabilityDatabase, authorization) }], exports: [AvailabilityService] })
export class AvailabilityModule {}
