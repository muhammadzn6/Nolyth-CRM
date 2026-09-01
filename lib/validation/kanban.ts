import { z } from "zod";

import { CONTRACT_TYPES, JOB_TYPES, LEAD_STATUSES, RATE_UNITS } from "@/constants/leads";

export const kanbanQuerySchema = z.object({
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
  column: z.enum(LEAD_STATUSES).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
