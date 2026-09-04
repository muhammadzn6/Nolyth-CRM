import { z } from "zod";

export const bulkImportRequestSchema = z.strictObject({ csv: z.string().min(1).max(5 * 1024 * 1024) });
export const bulkImportResultSchema = z.strictObject({ imported: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), errors: z.array(z.strictObject({ row: z.number().int().positive(), message: z.string().min(1) })) });
export type BulkImportRequest = z.infer<typeof bulkImportRequestSchema>;
export type BulkImportResult = z.infer<typeof bulkImportResultSchema>;
