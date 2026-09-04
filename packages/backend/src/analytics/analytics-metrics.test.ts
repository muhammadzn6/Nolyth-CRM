import { describe, expect, it } from "vitest";
import { averageResponseTimeHours } from "./analytics-metrics";

describe("averageResponseTimeHours", () => {
  it("calculates time from application to recruiter response", () => {
    expect(averageResponseTimeHours([
      { lead: { appliedDate: new Date("2026-09-01T00:00:00.000Z") }, occurredAt: new Date("2026-09-01T12:00:00.000Z") },
      { lead: { appliedDate: new Date("2026-09-02T00:00:00.000Z") }, occurredAt: new Date("2026-09-03T00:00:00.000Z") },
    ])).toBe(18);
  });
});
