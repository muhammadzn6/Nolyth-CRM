import { describe, expect, it } from "vitest";
import { averageResponseTimeHours, summarizeInterviewRounds } from "./analytics-metrics";

describe("averageResponseTimeHours", () => {
  it("calculates time from application to recruiter response", () => {
    expect(averageResponseTimeHours([
      { lead: { appliedDate: new Date("2026-09-01T00:00:00.000Z") }, occurredAt: new Date("2026-09-01T12:00:00.000Z") },
      { lead: { appliedDate: new Date("2026-09-02T00:00:00.000Z") }, occurredAt: new Date("2026-09-03T00:00:00.000Z") },
    ])).toBe(18);
  });
});

describe("summarizeInterviewRounds", () => {
  it("separates unique interview leads from rounds and excludes cancellations", () => {
    expect(summarizeInterviewRounds([
      { leadId: "lead-a", status: "SCHEDULED", attendance: null },
      { leadId: "lead-a", status: "COMPLETED", attendance: "ATTENDED" },
      { leadId: "lead-a", status: "CANCELLED", attendance: "ATTENDED" },
      { leadId: "lead-b", status: "WAITING_FEEDBACK", attendance: "MISSED" },
      { leadId: "lead-c", status: "CANCELLED", attendance: null },
    ])).toEqual({
      interviewLeads: 2,
      interviewRounds: 3,
      attendedRounds: 1,
      cancelledRounds: 2,
      averageRoundsPerInterviewLead: 1.5,
      roundAttendanceRate: 1 / 3,
    });
  });

  it("returns unavailable ratios when there are no non-cancelled rounds", () => {
    expect(summarizeInterviewRounds([
      { leadId: "lead-a", status: "CANCELLED", attendance: null },
    ])).toEqual({
      interviewLeads: 0,
      interviewRounds: 0,
      attendedRounds: 0,
      cancelledRounds: 1,
      averageRoundsPerInterviewLead: null,
      roundAttendanceRate: null,
    });
  });
});
