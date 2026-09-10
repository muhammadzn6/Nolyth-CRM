import type { ChangePasswordRequest, LoginRequest, SessionUser } from "@orbit/contracts";

import { AuthenticationError } from "../errors/app-error";
import { hashPassword, verifyPassword } from "./password";
import {
  type IdentityDatabase,
  type SessionRequest,
  type SessionService,
  toSessionUser,
} from "./session.service";

export type LoginResult = {
  user: SessionUser;
  sessionToken: string;
  expiresAt: Date;
  accessToken?: string;
};

export class IdentityService {
  constructor(
    private readonly database: IdentityDatabase,
    private readonly sessions: SessionService,
  ) {}

  async login(input: LoginRequest, _requestContext: SessionRequest): Promise<LoginResult> {
    const user = await this.database.user.findUnique({ where: { email: input.email } });
    const passwordMatches = await verifyPassword(
      user?.isActive ? user.passwordHash : null,
      input.password,
    );

    if (!user || !user.passwordHash || !user.isActive || !passwordMatches) {
      throw new AuthenticationError("Invalid email or password");
    }

    const [session] = await Promise.all([
      this.sessions.create(user.id),
      this.database.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);

    return { user: toSessionUser(user), ...session };
  }

  async logout(requestContext: SessionRequest): Promise<void> {
    await this.sessions.revoke(requestContext);
  }

  async refreshAccessToken(requestContext: SessionRequest) {
    return this.sessions.refreshAccessToken(requestContext);
  }

  async changePassword(actor: SessionUser, input: ChangePasswordRequest): Promise<void> {
    const user = await this.database.user.findUnique({ where: { id: actor.id } });
    const currentPasswordMatches = await verifyPassword(user?.passwordHash, input.currentPassword);

    if (!user || !user.isActive || !currentPasswordMatches) {
      throw new AuthenticationError("The current password is incorrect");
    }

    await this.database.user.update({
      where: { id: actor.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.sessions.revokeUserSessions(actor.id);
  }
}
