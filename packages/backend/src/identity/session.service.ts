import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { SessionUser, UserRole } from "@orbit/contracts";

import { AuthenticationError } from "../errors/app-error";
import { ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_DURATION_MS, JwtAccessTokenService } from "./jwt.service";

export const SESSION_COOKIE_NAME = "orbit_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const OAUTH_STATE_DURATION_MS = 1000 * 60 * 10;

export type Actor = SessionUser;

export type IdentityUserRecord = Actor & {
  passwordHash: string | null;
  lastLoginAt: Date | null;
};

export type IdentityDatabase = {
  user: {
    findUnique(args: { where: { email?: string; id?: string } }): Promise<IdentityUserRecord | null>;
    update(args: { where: { id: string }; data: Partial<IdentityUserRecord> }): Promise<IdentityUserRecord>;
  };
  userSession: UserSessionPersistence;
  profileBdAssignment: {
    findFirst(args: { where: { profileId: string; userId: string; endedAt: null } }): Promise<unknown | null>;
  };
  profileCloserEligibility: {
    findFirst(args: {
      where: { profileId: string; userId: string; isEligible: true; endedAt: null };
    }): Promise<unknown | null>;
  };
};

export type SessionRequest = {
  cookies?: Record<string, string | undefined>;
  headers?: { cookie?: string | string[] | undefined };
};

export type CreatedSession = {
  sessionToken: string;
  expiresAt: Date;
  sessionId?: string;
  accessToken?: string;
};

export type UserSessionPersistence = {
  updateMany(args: {
    where: { userId: string; revokedAt?: null };
    data: { revokedAt: Date };
  }): Promise<{ count: number }>;
  create(args: {
    data: { userId: string; sessionTokenHash: string; expiresAt: Date };
  }): Promise<unknown>;
  findUnique(args: { where: { sessionTokenHash: string }; include: { user: true } }): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    user: IdentityUserRecord | null;
  } | null>;
  update(args: { where: { id: string }; data: { revokedAt: Date } }): Promise<unknown>;
};

function readCookie(request: SessionRequest, name: string) {
  const directValue = request.cookies?.[name];

  if (directValue) {
    return directValue;
  }

  const header = request.headers?.cookie;
  const value = Array.isArray(header) ? header.join("; ") : header;

  return value
    ?.split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([key]) => key === name)?.[1];
}

export class SessionService {
  private readonly accessTokens: JwtAccessTokenService;

  constructor(
    private readonly database: IdentityDatabase,
    private readonly sessionSecret: string,
    private readonly durationMs = SESSION_DURATION_MS,
  ) {
    this.accessTokens = new JwtAccessTokenService(sessionSecret);
  }

  private hashToken(token: string) {
    return createHmac("sha256", this.sessionSecret).update(token).digest("hex");
  }

  private invalidOAuthState(): never {
    throw new AuthenticationError("Invalid Google OAuth state");
  }

  createOAuthState(actor: Actor, request: SessionRequest, context: Record<string, string> = {}): string {
    const token = readCookie(request, SESSION_COOKIE_NAME);

    if (!token) {
      throw new AuthenticationError();
    }

    const payload = Buffer.from(JSON.stringify({
      userId: actor.id,
      sessionTokenHash: this.hashToken(token),
      expiresAt: Date.now() + OAUTH_STATE_DURATION_MS,
      nonce: randomBytes(16).toString("base64url"),
      context,
    })).toString("base64url");
    const signature = createHmac("sha256", this.sessionSecret).update(payload).digest("base64url");

    return `${payload}.${signature}`;
  }

  requireOAuthState(actor: Actor, request: SessionRequest, state: string): Record<string, string> {
    const [payload, signature, ...rest] = state.split(".");
    const token = readCookie(request, SESSION_COOKIE_NAME);

    if (!payload || !signature || rest.length || !token) {
      this.invalidOAuthState();
    }

    const expectedSignature = createHmac("sha256", this.sessionSecret).update(payload).digest("base64url");

    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      this.invalidOAuthState();
    }

    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        userId?: unknown;
        sessionTokenHash?: unknown;
        expiresAt?: unknown;
        context?: unknown;
      };

      if (
        parsed.userId !== actor.id ||
        parsed.sessionTokenHash !== this.hashToken(token) ||
        typeof parsed.expiresAt !== "number" ||
        parsed.expiresAt <= Date.now()
      ) {
        this.invalidOAuthState();
      }
      return typeof parsed.context === "object" && parsed.context !== null
        ? Object.fromEntries(Object.entries(parsed.context).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"))
        : {};
    } catch {
      this.invalidOAuthState();
    }
  }

  async revokeUserSessions(
    userId: string,
    userSession: Pick<UserSessionPersistence, "updateMany"> = this.database.userSession,
    revokedAt = new Date(),
  ): Promise<number> {
    const result = await userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
    return result.count;
  }

  async create(userId: string): Promise<CreatedSession> {
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.durationMs);

    await this.revokeUserSessions(userId);
    const created = await this.database.userSession.create({
      data: { userId, sessionTokenHash: this.hashToken(sessionToken), expiresAt },
    });

    const sessionId = typeof created === "object" && created !== null && "id" in created && typeof created.id === "string"
      ? created.id
      : undefined;

    return {
      sessionToken,
      expiresAt,
      sessionId,
      accessToken: sessionId ? this.accessTokens.create({ userId, sessionId }) : undefined,
    };
  }

  accessTokenCookieName() {
    return ACCESS_TOKEN_COOKIE_NAME;
  }

  async refreshAccessToken(request: SessionRequest): Promise<{ accessToken: string; expiresAt: Date }> {
    const token = readCookie(request, SESSION_COOKIE_NAME);
    if (!token) throw new AuthenticationError();

    const session = await this.database.userSession.findUnique({
      where: { sessionTokenHash: this.hashToken(token) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user?.isActive) {
      throw new AuthenticationError();
    }

    return {
      accessToken: this.accessTokens.create({ userId: session.userId, sessionId: session.id }),
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_DURATION_MS),
    };
  }

  async revoke(request: SessionRequest): Promise<void> {
    const token = readCookie(request, SESSION_COOKIE_NAME);

    if (!token) {
      return;
    }

    const session = await this.database.userSession.findUnique({
      where: { sessionTokenHash: this.hashToken(token) },
      include: { user: true },
    });

    if (session && !session.revokedAt) {
      await this.database.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async requireActiveUser(request: SessionRequest): Promise<Actor> {
    const accessToken = readCookie(request, ACCESS_TOKEN_COOKIE_NAME);

    if (accessToken) {
      try {
        return await this.requireActiveUserFromAccessToken(accessToken);
      } catch (error) {
        // The opaque session is the revocable refresh/session record. Falling back
        // to it prevents a stale access JWT from logging a browser out mid-session.
        if (!(error instanceof AuthenticationError) || !readCookie(request, SESSION_COOKIE_NAME)) {
          throw error;
        }
      }
    }

    const token = readCookie(request, SESSION_COOKIE_NAME);

    if (!token) {
      throw new AuthenticationError();
    }

    const session = await this.database.userSession.findUnique({
      where: { sessionTokenHash: this.hashToken(token) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user?.isActive) {
      throw new AuthenticationError();
    }

    return toSessionUser(session.user);
  }

  private async requireActiveUserFromAccessToken(accessToken: string): Promise<Actor> {
    const claims = this.accessTokens.verify(accessToken);
    const persistence = this.database.userSession as UserSessionPersistence & {
      findUnique(args: { where: { id: string }; include: { user: true }}): Promise<{
        id: string;
        userId: string;
        expiresAt: Date;
        revokedAt: Date | null;
        user: IdentityUserRecord | null;
      } | null>;
    };
    const session = await persistence.findUnique({ where: { id: claims.sid }, include: { user: true } });

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user?.isActive
    ) {
      throw new AuthenticationError();
    }

    return toSessionUser(session.user);
  }
}

export function toSessionUser(user: IdentityUserRecord): SessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role as UserRole,
    isActive: user.isActive,
    timezone: user.timezone ?? "UTC",
  };
}
