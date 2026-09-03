import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
const visibility = z.enum(["INTERNAL_TEAM", "SHARED_WITH_CLOSER"]);
export const communicationTypeSchema = z.enum(["EMAIL", "PHONE", "LINKEDIN", "JOB_PLATFORM", "NOTE"]);
export const communicationDirectionSchema = z.enum(["INBOUND", "OUTBOUND", "INTERNAL"]);
export const communicationSummarySchema = z.strictObject({
  id: uuidSchema, leadId: uuidSchema, contactId: uuidSchema.nullable(), authorId: uuidSchema,
  type: communicationTypeSchema, direction: communicationDirectionSchema, subject: text.nullable(), body: text,
  occurredAt: z.iso.datetime(), outcome: text.nullable(), visibility, nextActionSummary: text.nullable(),
  nextActionDueAt: z.iso.datetime().nullable(), archivedAt: z.iso.datetime().nullable(), version: z.number().int().positive(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const createCommunicationSchema = z.strictObject({
  contactId: uuidSchema.optional(), type: communicationTypeSchema, direction: communicationDirectionSchema,
  subject: text.optional(), body: text, occurredAt: z.iso.datetime(), outcome: text.optional(), visibility,
  nextActionSummary: text.optional(), nextActionDueAt: z.iso.datetime().optional(),
});
export const updateCommunicationSchema = z.strictObject({
  subject: text.nullable().optional(), body: text.optional(), occurredAt: z.iso.datetime().optional(),
  outcome: text.nullable().optional(), visibility: visibility.optional(), nextActionSummary: text.nullable().optional(),
  nextActionDueAt: z.iso.datetime().nullable().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), "At least one field must be provided");
export const updateCommunicationRequestSchema = z.strictObject({
  subject: text.nullable().optional(), body: text.optional(), occurredAt: z.iso.datetime().optional(),
  outcome: text.nullable().optional(), visibility: visibility.optional(), nextActionSummary: text.nullable().optional(),
  nextActionDueAt: z.iso.datetime().nullable().optional(), expectedVersion: z.number().int().positive(),
}).refine(({ expectedVersion: _expectedVersion, ...value }) => Object.values(value).some((entry) => entry !== undefined), "At least one field must be provided");
export const communicationListQuerySchema = z.strictObject({ archived: z.coerce.boolean().default(false), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const archiveCommunicationSchema = z.strictObject({ reason: text });

export const commentVisibilitySchema = visibility;
export const commentSummarySchema = z.strictObject({
  id: uuidSchema, leadId: uuidSchema, authorId: uuidSchema, body: text, visibility,
  archivedAt: z.iso.datetime().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), version: z.number().int().positive(),
});
export const createCommentSchema = z.strictObject({ body: text, visibility });
export const updateCommentSchema = z.strictObject({ body: text.optional(), visibility: visibility.optional(), expectedVersion: z.number().int().positive() }).refine(({ body, visibility: value }) => body !== undefined || value !== undefined, "At least one field must be provided");
export type CommunicationSummary = z.infer<typeof communicationSummarySchema>;
export type CreateCommunication = z.infer<typeof createCommunicationSchema>;
export type UpdateCommunication = z.infer<typeof updateCommunicationSchema>;
export type CommunicationListQuery = z.infer<typeof communicationListQuerySchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;
export type CommentSummary = z.infer<typeof commentSummarySchema>;
export type UpdateComment = z.infer<typeof updateCommentSchema>;
