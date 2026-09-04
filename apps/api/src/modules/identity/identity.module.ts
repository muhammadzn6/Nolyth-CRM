import { Module } from "@nestjs/common";
import {
  AuthorizationService,
  IdentityService,
  PasswordResetService,
  SessionService,
  type IdentityDatabase,
} from "@orbit/backend";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";

import { APP_BASE_URL_TOKEN, IdentityController } from "./identity.controller";
import { IdentityGuard } from "./identity.guard";

const identityDatabase = database as unknown as IdentityDatabase;

@Module({
  controllers: [IdentityController],
  providers: [
    {
      provide: APP_BASE_URL_TOKEN,
      useFactory: () => loadServerEnv().appBaseUrl,
    },
    {
      provide: SessionService,
      useFactory: () => new SessionService(identityDatabase, loadServerEnv().sessionSecret),
    },
    {
      provide: IdentityService,
      inject: [SessionService],
      useFactory: (sessions: SessionService) => new IdentityService(identityDatabase, sessions),
    },
    {
      provide: PasswordResetService,
      inject: [SessionService],
      useFactory: (sessions: SessionService) => new PasswordResetService(database as never, sessions),
    },
    {
      provide: AuthorizationService,
      useFactory: () => new AuthorizationService(identityDatabase),
    },
    IdentityGuard,
  ],
  exports: [IdentityService, SessionService, AuthorizationService, IdentityGuard],
})
export class IdentityModule {}
