import { Module } from "@nestjs/common";
import { CandidatesModule } from "../candidates/candidates.module";
import { IdentityModule } from "../identity/identity.module";
import { LeadsModule } from "../leads/leads.module";
import { ImportsController } from "./imports.controller";

@Module({ imports: [IdentityModule, CandidatesModule, LeadsModule], controllers: [ImportsController] })
export class ImportsModule {}
