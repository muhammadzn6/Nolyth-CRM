import { z } from "zod";
import { uuidSchema } from "./common";

const text = z.string().trim().min(1);
const money = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);
export const offerStatusSchema = z.enum(["OFFERED", "ACCEPTED", "DECLINED"]);
export const offerSummarySchema = z.strictObject({ id: uuidSchema, leadId: uuidSchema, status: offerStatusSchema, compensationAmount: money, compensationCurrency: z.string().length(3), employmentType: text, details: text, decisionDeadline: z.iso.datetime().nullable(), acceptedAt: z.iso.datetime().nullable(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), startedAt: z.iso.datetime().nullable(), createdById: uuidSchema, version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const createOfferSchema = z.strictObject({ compensationAmount: money, compensationCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), employmentType: text, details: text, decisionDeadline: z.iso.datetime().optional() });
export const updateOfferSchema = z.strictObject({ compensationAmount: money.optional(), compensationCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(), employmentType: text.optional(), details: text.optional(), decisionDeadline: z.iso.datetime().nullable().optional(), expectedVersion: z.number().int().positive() });
export const offerDecisionSchema = z.strictObject({ decision: z.enum(["ACCEPTED", "DECLINED"]), expectedVersion: z.number().int().positive() });
export const placementDateSchema = z.strictObject({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), expectedVersion: z.number().int().positive() });
export const startPlacementSchema = z.strictObject({ expectedVersion: z.number().int().positive() });
export type OfferSummary = z.infer<typeof offerSummarySchema>;
export type CreateOffer = z.infer<typeof createOfferSchema>;
