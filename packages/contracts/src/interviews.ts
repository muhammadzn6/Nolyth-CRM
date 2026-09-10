import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
export const interviewStatusSchema = z.enum(["SCHEDULED", "RESCHEDULE_REQUIRED", "CANCELLED", "NO_SHOW", "COMPLETED", "WAITING_FEEDBACK", "PASSED", "FAILED"]);
export const interviewRoundTypeSchema = z.enum(["PRE_SCREEN", "RECRUITER", "HR", "TECHNICAL", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "HIRING_MANAGER", "FINAL", "OTHER"]);
export const googleCalendarSyncStatusSchema = z.enum(["SYNCED", "FAILED", "CANCELLED"]);
export const interviewSummarySchema = z.strictObject({
  id: uuidSchema, leadId: uuidSchema, roundNumber: z.number().int().positive(), roundType: interviewRoundTypeSchema,
  status: interviewStatusSchema, closerId: uuidSchema, creatorId: uuidSchema, startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  timezone: text, originalDatetimeText: text, interviewer: text.nullable(), meetingLink: z.url().nullable(), location: text.nullable(),
  preparationNotes: text.nullable(), closerNotes: text.nullable(), officialFeedback: text.nullable(), officialResult: text.nullable(),
  attendance: z.enum(["ATTENDED", "MISSED", "UNKNOWN"]).nullable(), googleSyncStatus: googleCalendarSyncStatusSchema.nullable(), version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const createInterviewSchema = z.strictObject({
  closerId: uuidSchema, roundType: interviewRoundTypeSchema, startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), timezone: text,
  originalDatetimeText: text, interviewer: text.optional(), meetingLink: z.url().optional(), location: text.optional(), preparationNotes: text.optional(),
}).refine(({ startsAt, endsAt }) => startsAt < endsAt, { message: "Interview must end after it starts", path: ["endsAt"] });
export const updateInterviewSchema = z.strictObject({
  startsAt: z.iso.datetime().optional(), endsAt: z.iso.datetime().optional(), timezone: text.optional(), originalDatetimeText: text.optional(),
  interviewer: text.nullable().optional(), meetingLink: z.url().nullable().optional(), location: text.nullable().optional(), preparationNotes: text.nullable().optional(), expectedVersion: z.number().int().positive(),
});
export const rescheduleInterviewSchema = z.strictObject({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), timezone: text, originalDatetimeText: text, expectedVersion: z.number().int().positive() }).refine(({ startsAt, endsAt }) => startsAt < endsAt, { message: "Interview must end after it starts", path: ["endsAt"] });
export const reportInterviewConflictSchema = z.strictObject({ reason: text, alternatives: text.optional(), expectedVersion: z.number().int().positive() });
export const calendarQuerySchema = z.strictObject({ companyId: uuidSchema.optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }).refine(({ from, to }) => !from || !to || from < to, { message: "Calendar range must end after it starts", path: ["to"] });
export const interviewStatusActionSchema = z.strictObject({ reason: text.optional(), expectedVersion: z.number().int().positive() });
export const interviewAttendanceSchema = z.strictObject({ attendance: z.enum(["ATTENDED", "MISSED"]), expectedVersion: z.number().int().positive() });
export const interviewNotesSchema = z.strictObject({ notes: text, expectedVersion: z.number().int().positive() });
export const officialResultSchema = z.strictObject({ outcome: z.enum(["PASSED", "FAILED"]), notes: text.optional(), expectedVersion: z.number().int().positive() });
export type InterviewSummary = z.infer<typeof interviewSummarySchema>;
export type CreateInterview = z.infer<typeof createInterviewSchema>;
export type UpdateInterview = z.infer<typeof updateInterviewSchema>;
