import { z } from "zod";

import { uuidSchema } from "./common";

const optionalTextSchema = z.string().trim().min(1);
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code"));
const compensationSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Compensation must have at most two decimal places");
const preferenceListSchema = z.array(optionalTextSchema).max(50);

export const profileStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export const compensationPeriodSchema = z.enum(["HOURLY", "YEARLY"]);

export const profileSummarySchema = z.strictObject({
  id: uuidSchema,
  candidateId: uuidSchema,
  name: optionalTextSchema,
  description: optionalTextSchema.nullable(),
  status: profileStatusSchema,
  defaultCurrency: currencySchema,
  targetCompensation: compensationSchema.nullable(),
  compensationPeriod: compensationPeriodSchema.nullable(),
  targetRoles: preferenceListSchema,
  preferredLocations: preferenceListSchema,
  workplacePreferences: preferenceListSchema,
  jobTypePreferences: preferenceListSchema,
  contractPreferences: preferenceListSchema,
  archivedAt: z.iso.datetime().nullable(),
  archiveReason: optionalTextSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const createProfileSchema = z.strictObject({
  candidateId: uuidSchema,
  name: optionalTextSchema,
  description: optionalTextSchema.optional(),
  defaultCurrency: currencySchema.optional(),
  targetCompensation: compensationSchema.optional(),
  compensationPeriod: compensationPeriodSchema.optional(),
  targetRoles: preferenceListSchema.optional(),
  preferredLocations: preferenceListSchema.optional(),
  workplacePreferences: preferenceListSchema.optional(),
  jobTypePreferences: preferenceListSchema.optional(),
  contractPreferences: preferenceListSchema.optional(),
});

const profileUpdateShape = {
  name: optionalTextSchema.optional(),
  description: optionalTextSchema.nullable().optional(),
  defaultCurrency: currencySchema.optional(),
  targetCompensation: compensationSchema.nullable().optional(),
  compensationPeriod: compensationPeriodSchema.nullable().optional(),
  targetRoles: preferenceListSchema.optional(),
  preferredLocations: preferenceListSchema.optional(),
  workplacePreferences: preferenceListSchema.optional(),
  jobTypePreferences: preferenceListSchema.optional(),
  contractPreferences: preferenceListSchema.optional(),
};

export const updateProfileSchema = z
  .strictObject(profileUpdateShape)
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one profile field must be provided",
  });

export const updateProfileRequestSchema = z
  .strictObject({
    ...profileUpdateShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ expectedVersion: _expectedVersion, ...update }) =>
      Object.values(update).some((value) => value !== undefined),
    { message: "At least one profile field must be provided" },
  );

export const profileStatusRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});

export const archiveProfileRequestSchema = z.strictObject({
  reason: optionalTextSchema,
  expectedVersion: z.number().int().positive(),
});

export const assignmentUserRequestSchema = z.strictObject({ userId: uuidSchema });
export const endAssignmentRequestSchema = z.strictObject({ reason: optionalTextSchema });

export const profileListQuerySchema = z.strictObject({
  candidateId: uuidSchema.optional(),
  search: optionalTextSchema.optional(),
  status: profileStatusSchema.optional(),
  cursor: optionalTextSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const assignmentSchema = z.strictObject({
  id: uuidSchema,
  profileId: uuidSchema,
  userId: uuidSchema,
  assignedById: uuidSchema,
  assignedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  endedReason: optionalTextSchema.nullable(),
});

export const assignProfileBdSchema = z.strictObject({
  profileId: uuidSchema,
  userId: uuidSchema,
});

export const profileCloserEligibilitySchema = z.strictObject({
  profileId: uuidSchema,
  userId: uuidSchema,
  isEligible: z.boolean(),
});

export type CreateProfile = z.infer<typeof createProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type ProfileStatus = z.infer<typeof profileStatusSchema>;
export type ProfileListQuery = z.infer<typeof profileListQuerySchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignProfileBd = z.infer<typeof assignProfileBdSchema>;
export type ProfileCloserEligibility = z.infer<typeof profileCloserEligibilitySchema>;
