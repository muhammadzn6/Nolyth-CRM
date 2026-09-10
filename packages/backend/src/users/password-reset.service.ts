import { createHash, randomBytes } from "node:crypto";
import { passwordResetCompleteSchema, passwordResetRequestSchema, type SessionUser } from "@orbit/contracts";
import { AuthenticationError, ValidationError } from "../errors/app-error";
import { hashPassword } from "../identity/password";
import type { SessionService } from "../identity/session.service";

type Database = { user: { findUnique(args: { where: { email: string } }): Promise<{ id: string; isActive: boolean } | null> }; authToken: { create(args: { data: Record<string, unknown> }): Promise<unknown>; updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>; findUnique(args: { where: { tokenHash: string } }): Promise<{ userId: string } | null> }; $transaction<T>(work: (tx: { authToken: Database["authToken"]; user: { update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<SessionUser> }; userSession: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> } }) => Promise<T>): Promise<T> };
const digest = (token: string) => `sha256:${createHash("sha256").update(token).digest("hex")}`;
const duration = 60 * 60 * 1000;

export class PasswordResetService {
  constructor(private readonly database: Database, private readonly sessions: SessionService, private readonly now = () => new Date()) {}
  async request(email: string): Promise<{ accepted: true }> {
    const parsed = passwordResetRequestSchema.safeParse({ email }); if (!parsed.success) throw new ValidationError("The request payload is invalid", parsed.error.issues);
    const user = await this.database.user.findUnique({ where: { email: parsed.data.email } }); if (!user?.isActive) return { accepted: true };
    const token = randomBytes(32).toString("base64url"); const createdAt = this.now();
    await this.database.authToken.create({ data: { userId: user.id, tokenHash: digest(token), purpose: "PASSWORD_RESET", expiresAt: new Date(createdAt.getTime() + duration) } }); return { accepted: true };
  }
  async complete(input: { token: string; newPassword: string }): Promise<void> {
    const parsed = passwordResetCompleteSchema.safeParse(input); if (!parsed.success) throw new ValidationError("The reset token or password is invalid", parsed.error.issues);
    const now = this.now(); const tokenHash = digest(parsed.data.token);
    await this.database.$transaction(async (tx) => { const claim = await tx.authToken.updateMany({ where: { tokenHash, purpose: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } }); if (claim.count !== 1) throw new AuthenticationError("Invalid or expired password reset token"); const record = await tx.authToken.findUnique({ where: { tokenHash } }); if (!record) throw new AuthenticationError("Invalid or expired password reset token"); await tx.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(parsed.data.newPassword), passwordChangedAt: now } }); await this.sessions.revokeUserSessions(record.userId, tx.userSession, now); });
  }
}
