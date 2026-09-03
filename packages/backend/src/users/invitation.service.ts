import { createHash } from "node:crypto";

import {
  acceptInvitationSchema,
  type SessionUser,
} from "@orbit/contracts";

import {
  AuthenticationError,
  ValidationError,
} from "../errors/app-error";
import { hashPassword } from "../identity/password";
import type { SessionService } from "../identity/session.service";
import { toSessionUser } from "../identity/session.service";

type UserRole = SessionUser["role"];

type UserRecord = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  role: UserRole;
  isActive: boolean;
  timezone: string;
  lastLoginAt: Date | null;
  createdByUserId: string | null;
};

type InvitationTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: "PASSWORD_RESET" | "USER_INVITATION";
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type InvitationTransaction = {
  authToken: {
    findUnique(args: { where: { tokenHash: string } }): Promise<InvitationTokenRecord | null>;
    update(args: {
      where: { id: string };
      data: Partial<InvitationTokenRecord>;
    }): Promise<InvitationTokenRecord>;
    updateMany(args: {
      where: {
        tokenHash: string;
        purpose: "USER_INVITATION";
        consumedAt: null;
        expiresAt: { gt: Date };
      };
      data: { consumedAt: Date };
    }): Promise<{ count: number }>;
  };
  user: {
    update(args: { where: { id: string }; data: Partial<UserRecord> }): Promise<UserRecord>;
  };
  userSession: {
    updateMany(args: {
      where: { userId: string; revokedAt?: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
};

export type InvitationDatabase = {
  authToken: {
    findUnique(args: { where: { tokenHash: string } }): Promise<InvitationTokenRecord | null>;
  };
  user: {
    findUnique(args: { where: { id: string } }): Promise<UserRecord | null>;
  };
  $transaction<T>(work: (tx: InvitationTransaction) => Promise<T>): Promise<T>;
};

function toValidationError(issues: unknown) {
  return new ValidationError("The request payload is invalid", issues);
}

function hashInvitationToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

export class InvitationService {
  constructor(
    private readonly database: InvitationDatabase,
    private readonly sessions: SessionService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async accept(token: string, password: string): Promise<SessionUser> {
    const parsed = acceptInvitationSchema.safeParse({ token, password });

    if (!parsed.success) {
      throw toValidationError(parsed.error.issues);
    }

    const tokenHash = hashInvitationToken(parsed.data.token);
    const acceptedAt = this.now();

    return this.database.$transaction(async (tx) => {
      const claim = await tx.authToken.updateMany({
        where: {
          tokenHash,
          purpose: "USER_INVITATION",
          consumedAt: null,
          expiresAt: { gt: acceptedAt },
        },
        data: { consumedAt: acceptedAt },
      });

      if (claim.count !== 1) {
        throw new AuthenticationError("Invalid invitation token");
      }

      const invitation = await tx.authToken.findUnique({
        where: { tokenHash },
      });

      if (!invitation) {
        throw new AuthenticationError("Invalid invitation token");
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const updatedUser = await tx.user.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          passwordChangedAt: acceptedAt,
        },
      });

      await this.sessions.revokeUserSessions(invitation.userId, tx.userSession, acceptedAt);

      return toSessionUser(updatedUser);
    });
  }
}
