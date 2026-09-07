import { z } from "zod";

import { calendarConnectionSchema } from "./calendar";
import { interviewSummarySchema } from "./interviews";
import { activityEventSummarySchema, notificationSummarySchema } from "./notifications";
import { taskSummarySchema } from "./tasks";

const text = z.string().trim().min(1);

export const closerDashboardLifetimeFunnelSchema = z.strictObject({
  applicationsHandled: z.number().int().nonnegative(),
  interviewsScheduled: z.number().int().nonnegative(),
  callsAttended: z.number().int().nonnegative(),
  offers: z.number().int().nonnegative(),
  placements: z.number().int().nonnegative(),
});

export const closerDashboardMeetingSchema = interviewSummarySchema.extend({
  candidateName: text,
  profileName: text,
  jobTitle: text,
  companyName: text,
});

export const closerDashboardExternalMeetingSchema = z.strictObject({
  id: text,
  title: text,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: text,
  location: z.string().nullable(),
  meetingLink: z.string().url().nullable(),
  description: z.string().nullable(),
});

export const closerDashboardApplicationSchema = z.strictObject({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  candidateName: text,
  profileName: text,
  jobTitle: text,
  companyName: text,
  status: text,
  nextInterviewAt: z.string().datetime().nullable(),
});

export const closerDashboardDataSchema = z.strictObject({
  timezone: text,
  assignedApplications: z.array(closerDashboardApplicationSchema),
  nextMeeting: closerDashboardMeetingSchema.nullable(),
  todayMeetings: z.array(interviewSummarySchema),
  externalMeetings: z.array(closerDashboardExternalMeetingSchema),
  needsFeedback: z.array(interviewSummarySchema),
  openTasks: z.array(taskSummarySchema),
  conflicts: z.array(interviewSummarySchema),
  notifications: z.array(notificationSummarySchema),
  recentActivity: z.array(activityEventSummarySchema),
  lifetimeFunnel: closerDashboardLifetimeFunnelSchema,
  calendarConnection: calendarConnectionSchema,
});

export type CloserDashboardData = z.infer<typeof closerDashboardDataSchema>;
export type CloserDashboardMeeting = z.infer<typeof closerDashboardMeetingSchema>;
export type CloserDashboardExternalMeeting = z.infer<typeof closerDashboardExternalMeetingSchema>;
export type CloserDashboardApplication = z.infer<typeof closerDashboardApplicationSchema>;
export type CloserDashboardLifetimeFunnel = z.infer<typeof closerDashboardLifetimeFunnelSchema>;
