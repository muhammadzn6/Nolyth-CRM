import { z } from "zod";

import { ROLES } from "@/constants/roles";
import { emailSchema } from "@/lib/validation/common";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
  isActive: z.boolean().optional(),
});
