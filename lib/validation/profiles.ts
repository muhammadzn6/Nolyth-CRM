import { z } from "zod";

import { objectIdSchema } from "@/lib/validation/common";

export const createProfileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required"),
  assignedBD: objectIdSchema,
  assignedCloser: objectIdSchema,
  isActive: z.boolean().optional(),
});

export const updateProfileSchema = createProfileSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one field must be provided",
  },
);
