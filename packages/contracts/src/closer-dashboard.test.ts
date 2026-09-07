import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import * as contracts from "./index";

function schema(name: string): ZodType {
  const value = (contracts as Record<string, unknown>)[name];
  expect(value, `${name} must be exported`).toBeDefined();
  return value as ZodType;
}

describe("closer dashboard lifetime funnel contract", () => {
  it("accepts a strict lifetime funnel aggregate and rejects missing or negative values", () => {
    const lifetimeFunnel = {
      applicationsHandled: 14,
      interviewsScheduled: 9,
      callsAttended: 7,
      offers: 3,
      placements: 2,
    };

    expect(schema("closerDashboardLifetimeFunnelSchema").parse(lifetimeFunnel)).toEqual(lifetimeFunnel);
    expect(
      schema("closerDashboardLifetimeFunnelSchema").safeParse({
        ...lifetimeFunnel,
        offers: -1,
      }).success,
    ).toBe(false);
    expect(
      schema("closerDashboardDataSchema").safeParse({
        timezone: "UTC",
        assignedApplications: [],
        nextMeeting: null,
        todayMeetings: [],
        externalMeetings: [],
        needsFeedback: [],
        openTasks: [],
        conflicts: [],
        notifications: [],
        recentActivity: [],
        calendarConnection: {
          connected: false,
          email: null,
          calendarName: null,
          lastSyncedAt: null,
          status: "DISCONNECTED",
        },
      }).success,
    ).toBe(false);
  });
});
