import { z } from "zod";

export const uuidSchema = z.uuid();
export const requestIdSchema = z.string().trim().min(1);

export const responseMetaSchema = z.strictObject({ requestId: requestIdSchema });

export const successResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.unknown(),
  meta: responseMetaSchema,
});

export const errorResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    details: z.unknown().optional(),
  }),
  meta: responseMetaSchema,
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
