import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
export const notificationSummarySchema = z.strictObject({ id: uuidSchema, recipientId: uuidSchema, type: text, title: text, message: text, relatedEntityType: text.nullable(), relatedEntityId: uuidSchema.nullable(), createdAt: z.iso.datetime(), readAt: z.iso.datetime().nullable() });
export const notificationListQuerySchema = z.strictObject({ unreadOnly: z.coerce.boolean().default(false), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const activityEventSummarySchema = z.strictObject({ id: uuidSchema, actorId: uuidSchema.nullable(), actorNameSnapshot: text.nullable(), actorRoleSnapshot: z.enum(["ADMIN", "BD", "CLOSER"]).nullable(), entityType: text, entityId: uuidSchema, action: text, profileId: uuidSchema.nullable(), leadId: uuidSchema.nullable(), metadata: z.record(z.string(), z.unknown()).nullable(), occurredAt: z.iso.datetime() });
export const activityListQuerySchema = z.strictObject({ companyId: uuidSchema.optional(), leadId: uuidSchema.optional(), profileId: uuidSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
export type ActivityEventSummary = z.infer<typeof activityEventSummarySchema>;
