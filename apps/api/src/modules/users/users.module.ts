import { randomBytes } from "node:crypto";

import { Module } from "@nestjs/common";
import {
  InvitationService,
  SessionService,
  UserManagementService,
  type InvitationDatabase,
  type UserManagementDatabase,
} from "@orbit/backend";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";

import { APP_BASE_URL_TOKEN } from "../identity/identity.controller";
import { IdentityModule } from "../identity/identity.module";
import { InvitationsController } from "../invitations/invitations.controller";
import { UsersController } from "./users.controller";

const userManagementDatabase = database as unknown as UserManagementDatabase;
const invitationDatabase = database as unknown as InvitationDatabase;

@Module({
  imports: [IdentityModule],
  controllers: [UsersController, InvitationsController],
  providers: [
    {
      provide: APP_BASE_URL_TOKEN,
      useFactory: () => loadServerEnv().appBaseUrl,
    },
    {
      provide: UserManagementService,
      inject: [SessionService],
      useFactory: (sessions: SessionService) =>
        new UserManagementService(
          userManagementDatabase,
          sessions,
          () => new Date(),
          () => randomBytes(32).toString("base64url"),
        ),
    },
    {
      provide: InvitationService,
      inject: [SessionService],
      useFactory: (sessions: SessionService) =>
        new InvitationService(invitationDatabase, sessions),
    },
  ],
})
export class UsersModule {}
