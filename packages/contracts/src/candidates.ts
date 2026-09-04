import { z } from "zod";

import { uuidSchema } from "./common";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const optionalTextSchema = z.string().trim().min(1);
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone");

export const candidateStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const candidateSummarySchema = z.strictObject({
  id: uuidSchema,
  linkedUserId: uuidSchema.nullable(),
  firstName: optionalTextSchema,
  lastName: optionalTextSchema,
  preferredName: optionalTextSchema.nullable(),
  email: z.email().nullable(),
  phone: optionalTextSchema.nullable(),
  timezone: timezoneSchema,
  location: optionalTextSchema.nullable(),
  status: candidateStatusSchema,
  archivedAt: z.iso.datetime().nullable(),
  archiveReason: optionalTextSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const createCandidateSchema = z.strictObject({
  linkedUserId: uuidSchema.optional(),
  firstName: optionalTextSchema,
  lastName: optionalTextSchema,
  preferredName: optionalTextSchema.optional(),
  email: emailSchema.optional(),
  phone: optionalTextSchema.optional(),
  timezone: timezoneSchema.default("UTC"),
  location: optionalTextSchema.optional(),
  internalNotes: optionalTextSchema.optional(),
});

const candidateUpdateShape = {
  linkedUserId: uuidSchema.nullable().optional(),
  firstName: optionalTextSchema.optional(),
  lastName: optionalTextSchema.optional(),
  preferredName: optionalTextSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  phone: optionalTextSchema.nullable().optional(),
  timezone: timezoneSchema.optional(),
  location: optionalTextSchema.nullable().optional(),
  internalNotes: optionalTextSchema.nullable().optional(),
};

export const updateCandidateSchema = z
  .strictObject(candidateUpdateShape)
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one candidate field must be provided",
  });

export const updateCandidateRequestSchema = z
  .strictObject({
    ...candidateUpdateShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ expectedVersion: _expectedVersion, ...update }) =>
      Object.values(update).some((value) => value !== undefined),
    { message: "At least one candidate field must be provided" },
  );

export const archiveCandidateRequestSchema = z.strictObject({
  reason: optionalTextSchema,
  expectedVersion: z.number().int().positive(),
});

export const restoreCandidateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});

export const candidateListQuerySchema = z.strictObject({
  search: optionalTextSchema.optional(),
  status: candidateStatusSchema.optional(),
  cursor: optionalTextSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export type CandidateSummary = z.infer<typeof candidateSummarySchema>;
export type CreateCandidate = z.infer<typeof createCandidateSchema>;
export type UpdateCandidate = z.infer<typeof updateCandidateSchema>;
export type UpdateCandidateRequest = z.infer<typeof updateCandidateRequestSchema>;
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;
