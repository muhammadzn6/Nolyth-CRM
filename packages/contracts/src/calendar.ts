import { z } from "zod";
import { uuidSchema } from "./common";

export const calendarConnectionStatusSchema = z.enum([
  "CONNECTED",
  "DISCONNECTED",
  "EXPIRED",
  "SYNCING",
]);

export const calendarConnectionSchema = z.strictObject({
  connected: z.boolean(),
  email: z.email().nullable(),
  calendarName: z.string().trim().min(1).nullable(),
  lastSyncedAt: z.iso.datetime().nullable(),
  status: calendarConnectionStatusSchema,
});

export const googleCalendarConnectSchema = z.strictObject({
  authorizationUrl: z.url(),
});

export const googleCalendarCallbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
});

export const googleCalendarBusyQuerySchema = z.strictObject({
  companyId: uuidSchema.optional(),
  profileId: uuidSchema.optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
}).refine(({ startsAt, endsAt }) => startsAt < endsAt, {
  message: "Calendar range must end after it starts",
  path: ["endsAt"],
}).refine(({ companyId, profileId }) => Boolean(companyId) !== Boolean(profileId), {
  message: "Provide exactly one calendar owner",
  path: ["profileId"],
});

export const googleCalendarBusySchema = z.strictObject({ busy: z.boolean() });

export type CalendarConnection = z.infer<typeof calendarConnectionSchema>;
export type GoogleCalendarCallbackQuery = z.infer<typeof googleCalendarCallbackQuerySchema>;
export type GoogleCalendarBusyQuery = z.infer<typeof googleCalendarBusyQuerySchema>;
