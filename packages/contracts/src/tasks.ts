import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
export const taskStatusSchema = z.enum(["OPEN", "COMPLETED", "CANCELED"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const taskTypeSchema = z.enum(["FOLLOW_UP", "PREPARE_INTERVIEW", "GENERAL"]);
export const taskSummarySchema = z.strictObject({
  id: uuidSchema, profileId: uuidSchema, leadId: uuidSchema.nullable(), assigneeId: uuidSchema, creatorId: uuidSchema,
  type: taskTypeSchema, title: text, description: text.nullable(), priority: taskPrioritySchema, status: taskStatusSchema,
  dueAt: z.iso.datetime(), completedAt: z.iso.datetime().nullable(), completedNotes: text.nullable(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), version: z.number().int().positive(),
});
export const createTaskSchema = z.strictObject({ profileId: uuidSchema, leadId: uuidSchema.optional(), assigneeId: uuidSchema, type: taskTypeSchema, title: text, description: text.optional(), priority: taskPrioritySchema.default("MEDIUM"), dueAt: z.iso.datetime() });
export const updateTaskSchema = z.strictObject({ assigneeId: uuidSchema.optional(), title: text.optional(), description: text.nullable().optional(), priority: taskPrioritySchema.optional(), dueAt: z.iso.datetime().optional(), expectedVersion: z.number().int().positive() }).refine(({ expectedVersion: _expectedVersion, ...value }) => Object.values(value).some((entry) => entry !== undefined), "At least one field must be provided");
export const taskListQuerySchema = z.strictObject({ profileId: uuidSchema.optional(), leadId: uuidSchema.optional(), assigneeId: uuidSchema.optional(), status: taskStatusSchema.optional(), overdue: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const completeTaskSchema = z.strictObject({ notes: text.optional(), expectedVersion: z.number().int().positive() });
export const cancelTaskSchema = z.strictObject({ reason: text, expectedVersion: z.number().int().positive() });
export type TaskSummary = z.infer<typeof taskSummarySchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
