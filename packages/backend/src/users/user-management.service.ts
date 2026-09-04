import { createHash } from "node:crypto";

import {
  createUserSchema,
  type CreateUser,
  type SessionUser,
  type UpdateUser,
  updateUserSchema,
  type UserSummary,
} from "@orbit/contracts";

import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../errors/app-error";
import type { SessionService } from "../identity/session.service";

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

type AuthTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: "PASSWORD_RESET" | "USER_INVITATION";
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type ActivityEventRecord = {
  action: string;
  actorId: string | null;
  actorNameSnapshot: string | null;
  actorRoleSnapshot: UserRole | null;
  entityId: string;
  entityType: string;
  metadata: Record<string, unknown> | null;
  oldSnapshot?: Record<string, unknown> | null;
  newSnapshot: Record<string, unknown> | null;
  requestId: string | null;
};

type UserMutationTransaction = {
  user: {
    create(args: {
      data: Omit<UserRecord, "id" | "lastLoginAt" | "passwordChangedAt"> & {
        lastLoginAt?: Date | null;
        passwordChangedAt?: Date | null;
      };
    }): Promise<UserRecord>;
    update(args: { where: { id: string }; data: Partial<UserRecord> }): Promise<UserRecord>;
  };
  authToken: {
    create(args: {
      data: Omit<AuthTokenRecord, "id" | "consumedAt" | "createdAt"> & {
        consumedAt?: Date | null;
        createdAt?: Date;
      };
    }): Promise<AuthTokenRecord>;
    updateMany(args: { where: Record<string, unknown>; data: Partial<AuthTokenRecord> }): Promise<{ count: number }>;
  };
  userSession: {
    updateMany(args: {
      where: { userId: string; revokedAt?: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }>;
  };
  activityEvent: {
    create(args: { data: ActivityEventRecord }): Promise<ActivityEventRecord>;
  };
  outboxEvent: {
    upsert(args: {
      where: { idempotencyKey: string };
      create: {
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        idempotencyKey: string;
        payload: unknown;
      };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
};

export type UserManagementDatabase = {
  user: {
    findMany(args?: unknown): Promise<UserRecord[]>;
    findUnique(args: { where: { email?: string; id?: string } }): Promise<UserRecord | null>;
  };
  $transaction<T>(work: (tx: UserMutationTransaction) => Promise<T>): Promise<T>;
};

const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;

function requireAdmin(actor: SessionUser) {
  if (!actor.isActive || actor.role !== "ADMIN") {
    throw new AuthorizationError();
  }
}

function toValidationError(issues: unknown) {
  return new ValidationError("The request payload is invalid", issues);
}

function toUserSummary(user: UserRecord): UserSummary {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    timezone: user.timezone,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

function hashInvitationToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function isUniqueEmailConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== "P2002") return false;

  const target = candidate.meta?.target;
  return Array.isArray(target) ? target.includes("email") : target === "email";
}

function duplicateEmailError() {
  return new ConflictError("A user with this email already exists");
}

function mutationAction(wasActive: boolean, isActive: boolean) {
  if (wasActive && !isActive) return "user.deactivated";
  if (!wasActive && isActive) return "user.reactivated";
  return "user.updated";
}

export class UserManagementService {
  constructor(
    private readonly database: UserManagementDatabase,
    private readonly sessions: SessionService,
    private readonly now: () => Date = () => new Date(),
    private readonly createInvitationToken: () => string,
  ) {}

  async list(actor: SessionUser): Promise<UserSummary[]> {
    if (!actor.isActive || !["ADMIN", "BD"].includes(actor.role)) {
      throw new AuthorizationError();
    }

    const users = await this.database.user.findMany();
    return users.map(toUserSummary);
  }

  async create(
    actor: SessionUser,
    input: CreateUser,
  ): Promise<{ user: UserSummary; invitationToken: string }> {
    requireAdmin(actor);

    const parsed = createUserSchema.safeParse(input);

    if (!parsed.success) {
      throw toValidationError(parsed.error.issues);
    }

    const existing = await this.database.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      throw duplicateEmailError();
    }

    const invitationToken = this.createInvitationToken();
    const tokenHash = hashInvitationToken(invitationToken);
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + INVITATION_DURATION_MS);

    try {
      return await this.database.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            createdByUserId: actor.id,
            displayName: parsed.data.displayName,
            email: parsed.data.email,
            isActive: true,
            passwordHash: null,
            role: parsed.data.role,
            timezone: parsed.data.timezone,
          },
        });

        await tx.authToken.create({
          data: {
            userId: user.id,
            tokenHash,
            purpose: "USER_INVITATION",
            expiresAt,
          },
        });

        const userSummary = toUserSummary(user);

        await tx.activityEvent.create({
          data: {
            action: "user.created",
            actorId: actor.id,
            actorNameSnapshot: actor.displayName,
            actorRoleSnapshot: actor.role,
            entityId: user.id,
            entityType: "user",
            metadata: { invited: true },
            newSnapshot: userSummary,
            requestId: null,
          },
        });

        await tx.outboxEvent.upsert({
          where: { idempotencyKey: `user-invitation:${user.id}` },
          create: {
            aggregateType: "user",
            aggregateId: user.id,
            eventType: "email.send_requested",
            idempotencyKey: `user-invitation:${user.id}`,
            payload: {
              recipientUserId: user.id,
              to: user.email,
              subject: "Your Orbit invitation",
              text: "Open Orbit to accept your invitation.",
            },
          },
          update: {},
        });

        return { user: userSummary, invitationToken };
      });
    } catch (error) {
      if (isUniqueEmailConflict(error)) {
        throw duplicateEmailError();
      }
      throw error;
    }
  }

  async update(actor: SessionUser, userId: string, input: UpdateUser): Promise<UserSummary> {
    requireAdmin(actor);

    const parsed = updateUserSchema.safeParse(input);

    if (!parsed.success) {
      throw toValidationError(parsed.error.issues);
    }

    if (actor.id === userId && parsed.data.isActive === false) {
      throw new ConflictError("Administrators cannot deactivate themselves");
    }

    const existing = await this.database.user.findUnique({ where: { id: userId } });

    if (!existing) {
      throw new NotFoundError("The requested user was not found");
    }

    const oldSummary = toUserSummary(existing);
    const revokedAt = this.now();

    return this.database.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: parsed.data,
      });

      let revokedActiveSessionCount = 0;
      if (parsed.data.isActive !== undefined) {
        revokedActiveSessionCount = await this.sessions.revokeUserSessions(userId, tx.userSession, revokedAt);
      }

      const userSummary = toUserSummary(updated);
      await tx.activityEvent.create({
        data: {
          action: mutationAction(oldSummary.isActive, updated.isActive),
          actorId: actor.id,
          actorNameSnapshot: actor.displayName,
          actorRoleSnapshot: actor.role,
          entityId: updated.id,
          entityType: "user",
          metadata:
            parsed.data.isActive === undefined
              ? null
              : { revokedActiveSessionCount },
          oldSnapshot: oldSummary,
          newSnapshot: userSummary,
          requestId: null,
        },
      });

      return userSummary;
    });
  }

  async revokeSessions(actor: SessionUser, userId: string): Promise<void> {
    requireAdmin(actor);

    const existing = await this.database.user.findUnique({ where: { id: userId } });

    if (!existing) {
      throw new NotFoundError("The requested user was not found");
    }

    await this.database.$transaction(async (tx) => {
      const revokedActiveSessionCount = await this.sessions.revokeUserSessions(userId, tx.userSession, this.now());

      await tx.activityEvent.create({
        data: {
          action: "user.sessions_revoked",
          actorId: actor.id,
          actorNameSnapshot: actor.displayName,
          actorRoleSnapshot: actor.role,
          entityId: existing.id,
          entityType: "user",
          metadata: { revokedActiveSessionCount },
          oldSnapshot: toUserSummary(existing),
          newSnapshot: toUserSummary(existing),
          requestId: null,
        },
      });
    });
  }

  async resendInvitation(actor: SessionUser, userId: string): Promise<{ user: UserSummary; invitationToken: string }> {
    requireAdmin(actor);
    const existing = await this.database.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError("The requested user was not found");
    if (existing.passwordHash) throw new ConflictError("This user has already accepted an invitation");
    const invitationToken = this.createInvitationToken(); const createdAt = this.now(); const expiresAt = new Date(createdAt.getTime() + INVITATION_DURATION_MS); const idempotencyKey = `user-invitation-resend:${userId}:${createdAt.toISOString()}`;
    return this.database.$transaction(async (tx) => {
      await tx.authToken.updateMany({ where: { userId, purpose: "USER_INVITATION", consumedAt: null }, data: { consumedAt: createdAt } });
      await tx.authToken.create({ data: { userId, tokenHash: hashInvitationToken(invitationToken), purpose: "USER_INVITATION", expiresAt } });
      await tx.outboxEvent.upsert({ where: { idempotencyKey }, create: { aggregateType: "user", aggregateId: userId, eventType: "email.send_requested", idempotencyKey, payload: { recipientUserId: userId, to: existing.email, subject: "Your Orbit invitation", text: "Open Orbit to accept your invitation." } }, update: {} });
      return { user: toUserSummary(existing), invitationToken };
    });
  }
}
