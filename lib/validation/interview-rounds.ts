import { z } from "zod";

import { INTERVIEW_ROUND_RESULTS, INTERVIEW_ROUND_TYPES } from "@/constants/leads";
import { optionalNullableTrimmedStringSchema, optionalUrlSchema } from "@/lib/validation/common";

export const createInterviewRoundSchema = z.object({
  roundType: z.enum(INTERVIEW_ROUND_TYPES),
  scheduledAt: z.coerce.date().optional(),
  interviewerName: optionalNullableTrimmedStringSchema,
  meetingLink: optionalUrlSchema,
  result: z.enum(INTERVIEW_ROUND_RESULTS).optional(),
  notes: optionalNullableTrimmedStringSchema,
});

export const updateInterviewRoundSchema = createInterviewRoundSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided" },
);
