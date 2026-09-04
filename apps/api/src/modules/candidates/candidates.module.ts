import { Module } from "@nestjs/common";
import {
  AuthorizationService,
  CandidatesService,
  type CandidateProfileDatabase,
} from "@orbit/backend";
import { loadServerEnv } from "@orbit/config";
import { database } from "@orbit/database";

import { APP_BASE_URL_TOKEN } from "../identity/identity.controller";
import { IdentityModule } from "../identity/identity.module";
import { CandidatesController } from "./candidates.controller";

const candidateProfileDatabase = database as unknown as CandidateProfileDatabase;

@Module({
  imports: [IdentityModule],
  controllers: [CandidatesController],
  providers: [
    {
      provide: APP_BASE_URL_TOKEN,
      useFactory: () => loadServerEnv().appBaseUrl,
    },
    {
      provide: CandidatesService,
      inject: [AuthorizationService],
      useFactory: (authorization: AuthorizationService) =>
        new CandidatesService(candidateProfileDatabase, authorization),
    },
  ],
  exports: [CandidatesService],
})
export class CandidatesModule {}
