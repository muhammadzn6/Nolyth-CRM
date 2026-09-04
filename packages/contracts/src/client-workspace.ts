import { z } from "zod";
import { uuidSchema } from "./common";
import { userSummarySchema } from "./users";

export const companyCloserAssignmentSchema = z.strictObject({
  id: uuidSchema,
  companyId: uuidSchema,
  userId: uuidSchema,
  assignedById: uuidSchema,
  assignedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  closer: userSummarySchema,
});

export const createCompanyCloserAssignmentSchema = z.strictObject({ closerId: uuidSchema });

export type CompanyCloserAssignment = z.infer<typeof companyCloserAssignmentSchema>;
export type CreateCompanyCloserAssignment = z.infer<typeof createCompanyCloserAssignmentSchema>;
