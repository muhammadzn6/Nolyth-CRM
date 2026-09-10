import { z } from "zod";

import { uuidSchema } from "./common";

export const userRoleSchema = z.enum(["ADMIN", "BD", "CLOSER"]);

export const loginRequestSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

export const changePasswordRequestSchema = z.strictObject({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});
export const passwordResetRequestSchema = z.strictObject({ email: z.email() });
export const passwordResetCompleteSchema = z.strictObject({ token: z.string().min(1), newPassword: z.string().min(12) });
export const passwordResetResponseSchema = z.strictObject({ accepted: z.literal(true), token: z.string().optional() });

export const sessionUserSchema = z.strictObject({
  id: uuidSchema,
  displayName: z.string().trim().min(1),
  email: z.email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  timezone: z.string().trim().min(1).optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetComplete = z.infer<typeof passwordResetCompleteSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
