import { z } from "zod";
import { uuidSchema } from "./common";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const text = z.string().trim().min(1);
export const availabilityRuleSchema = z.strictObject({ id: uuidSchema, closerId: uuidSchema, dayOfWeek: z.number().int().min(0).max(6), localStart: time, localEnd: time, timezone: text, effectiveFrom: z.iso.datetime().nullable(), effectiveTo: z.iso.datetime().nullable() });
export const availabilityRuleInputSchema = z.strictObject({ dayOfWeek: z.number().int().min(0).max(6), localStart: time, localEnd: time, timezone: text, effectiveFrom: z.iso.datetime().optional(), effectiveTo: z.iso.datetime().optional() }).refine(({ localStart, localEnd }) => localStart < localEnd, { message: "Availability must end after it starts", path: ["localEnd"] });
export const availabilityExceptionSchema = z.strictObject({ id: uuidSchema, closerId: uuidSchema, startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), type: z.enum(["AVAILABLE_OVERRIDE", "UNAVAILABLE", "LEAVE"]), reason: text.nullable() });
export const availabilityExceptionInputSchema = z.strictObject({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), type: z.enum(["AVAILABLE_OVERRIDE", "UNAVAILABLE", "LEAVE"]), reason: text.optional() }).refine(({ startsAt, endsAt }) => startsAt < endsAt, { message: "Exception must end after it starts", path: ["endsAt"] });
export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;
export type AvailabilityException = z.infer<typeof availabilityExceptionSchema>;
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionInputSchema>;
