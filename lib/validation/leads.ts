import { z } from "zod";

import {
  CONTRACT_TYPES,
  DEAD_REASONS,
  JOB_TYPES,
  LEAD_STATUSES,
  RATE_UNITS,
} from "@/constants/leads";
import {
  optionalNullableTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from "@/lib/validation/common";

export const LEAD_LIST_SORTS = [
  "newest",
  "oldest",
  "company",
  "updated",
  "important",
] as const;

export const LEAD_WORKSPACE_VIEWS = [
  "all",
  "applied",
  "in_process",
  "final_round",
  "closed",
  "dead",
  "important",
] as const;

export const createLeadSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  jobTitle: optionalTrimmedStringSchema,
  jobUrl: z.string().trim().url("Job URL must be a valid URL"),
  jobDescription: optionalTrimmedStringSchema,
  recruiterName: optionalTrimmedStringSchema,
  recruiterContact: optionalTrimmedStringSchema,
  rateAmount: z.number().nonnegative().optional(),
  rateUnit: z.enum(RATE_UNITS).optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  jobType: z.enum(JOB_TYPES).optional(),
});

export const updateLeadSchema = z
  .object({
    companyName: z.string().trim().min(1).optional(),
    jobTitle: optionalNullableTrimmedStringSchema,
    jobUrl: z.string().trim().url().optional(),
    jobDescription: optionalNullableTrimmedStringSchema,
    recruiterName: optionalNullableTrimmedStringSchema,
    recruiterContact: optionalNullableTrimmedStringSchema,
    rateAmount: z.number().nonnegative().nullable().optional(),
    rateUnit: z.enum(RATE_UNITS).nullable().optional(),
    contractType: z.enum(CONTRACT_TYPES).nullable().optional(),
    jobType: z.enum(JOB_TYPES).nullable().optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    deadReason: z.enum(DEAD_REASONS).nullable().optional(),
    deadNotes: optionalNullableTrimmedStringSchema,
    isImportant: z.boolean().optional(),
    appliedDate: z.coerce.date().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const leadListQuerySchema = z.object({
  view: z.enum(LEAD_WORKSPACE_VIEWS).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  q: z.string().trim().min(1).optional(),
  important: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  jobType: z.enum(JOB_TYPES).optional(),
  rateUnit: z.enum(RATE_UNITS).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(LEAD_LIST_SORTS).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
