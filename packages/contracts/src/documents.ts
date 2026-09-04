import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
export const documentTypeSchema = z.enum(["CV", "COVER_LETTER", "SUPPORTING", "OTHER"]);
export const documentUsageTypeSchema = z.enum(["CV", "SUPPORTING"]);
export const documentVersionSchema = z.strictObject({ id: uuidSchema, documentId: uuidSchema, versionNumber: z.number().int().positive(), storageKey: text, originalFilename: text, mimeType: text, sizeBytes: z.number().int().positive(), checksum: text, uploadedById: uuidSchema, createdAt: z.iso.datetime() });
export const documentSummarySchema = z.strictObject({ id: uuidSchema, profileId: uuidSchema, type: documentTypeSchema, title: text, currentVersionId: uuidSchema.nullable(), archivedAt: z.iso.datetime().nullable(), version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), versions: z.array(documentVersionSchema).optional() });
export const createDocumentSchema = z.strictObject({ type: documentTypeSchema, title: text, originalFilename: text, mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]), sizeBytes: z.number().int().positive().max(25_000_000), storageKey: text, checksum: text });
export const createDocumentVersionSchema = z.strictObject({ originalFilename: text, mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]), sizeBytes: z.number().int().positive().max(25_000_000), storageKey: text, checksum: text });
export const archiveDocumentSchema = z.strictObject({ reason: text });
export const attachDocumentUsageSchema = z.strictObject({ documentVersionId: uuidSchema, usageType: documentUsageTypeSchema });
export const documentUploadIntentSchema = z.strictObject({ filename: text, contentType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]), contentLength: z.number().int().positive().max(25_000_000), idempotencyKey: uuidSchema });
export const documentUploadIntentResultSchema = z.strictObject({ storageKey: text, uploadUrl: z.url(), expiresAt: z.iso.datetime() });
export const documentDownloadResultSchema = z.strictObject({ downloadUrl: z.url(), expiresAt: z.iso.datetime() });
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type CreateDocument = z.infer<typeof createDocumentSchema>;
export type CreateDocumentVersion = z.infer<typeof createDocumentVersionSchema>;
