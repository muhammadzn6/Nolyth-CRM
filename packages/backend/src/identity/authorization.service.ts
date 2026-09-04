import type { UserRole } from "@orbit/contracts";

import { AuthorizationError } from "../errors/app-error";
import type { Actor, IdentityDatabase } from "./session.service";

export class AuthorizationService {
  constructor(private readonly database: IdentityDatabase) {}

  assertRole(actor: Actor, roles: readonly UserRole[]): void {
    if (!actor.isActive || !roles.includes(actor.role)) {
      throw new AuthorizationError();
    }
  }

  async assertProfileAccess(actor: Actor, profileId: string): Promise<void> {
    if (!actor.isActive) {
      throw new AuthorizationError();
    }

    if (actor.role === "ADMIN") {
      return;
    }

    const assignment = actor.role === "BD"
      ? await this.database.profileBdAssignment.findFirst({
        where: { profileId, userId: actor.id, endedAt: null },
      })
      : await this.database.profileCloserEligibility.findFirst({
        where: { profileId, userId: actor.id, isEligible: true, endedAt: null },
      });

    if (!assignment) {
      throw new AuthorizationError();
    }
  }
}
