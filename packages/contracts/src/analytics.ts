import { z } from "zod";

export const analyticsQuerySchema = z.strictObject({ companyId: z.string().uuid().optional(), profileId: z.string().uuid().optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional() });
export const analyticsKpisSchema = z.strictObject({ applications: z.number().int().nonnegative(), responses: z.number().int().nonnegative(), interviews: z.number().int().nonnegative(), offers: z.number().int().nonnegative(), acceptedOffers: z.number().int().nonnegative(), placements: z.number().int().nonnegative(), starts: z.number().int().nonnegative(), activePipeline: z.number().int().nonnegative(), overdueTasks: z.number().int().nonnegative(), responseRate: z.number().nonnegative().nullable() });
export const analyticsBreakdownSchema = z.array(z.strictObject({ key: z.string(), count: z.number().int().nonnegative() }));
export type AnalyticsKpis = z.infer<typeof analyticsKpisSchema>;
