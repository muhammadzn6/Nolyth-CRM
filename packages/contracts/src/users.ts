import { z } from "zod";

import { userRoleSchema } from "./auth";
import { uuidSchema } from "./common";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const timezoneSchema = z.string().trim().min(1).refine((timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");

export const userSummarySchema = z.strictObject({
  id: uuidSchema,
  displayName: z.string().trim().min(1),
  email: z.email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  timezone: timezoneSchema,
  lastLoginAt: z.iso.datetime().nullable(),
});

export const createUserSchema = z.strictObject({
  displayName: z.string().trim().min(1),
  email: emailSchema,
  role: userRoleSchema,
  timezone: timezoneSchema,
});

export const updateUserSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).optional(),
    role: userRoleSchema.optional(),
    timezone: timezoneSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one user field must be provided",
  });

export const acceptInvitationSchema = z.strictObject({
  token: z.string().trim().min(1),
  password: z.string().min(12),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;
