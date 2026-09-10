import { describe, expect, it } from "vitest";

import { analyticsKpisSchema } from "./analytics";

describe("analytics KPI contract", () => {
  it("requires explicit lead and round interview metrics", () => {
    const kpis = {
      applications: 70,
      responses: 12,
      interviews: 8,
      interviewRounds: 14,
      attendedRounds: 9,
      cancelledRounds: 2,
      averageRoundsPerInterviewLead: 1.75,
      roundAttendanceRate: 9 / 14,
      offers: 3,
      acceptedOffers: 2,
      placements: 1,
      starts: 0,
      activePipeline: 20,
      overdueTasks: 4,
      responseRate: 12 / 70,
    };

    expect(analyticsKpisSchema.parse(kpis)).toEqual(kpis);
    expect(analyticsKpisSchema.safeParse({ ...kpis, interviewRounds: -1 }).success).toBe(false);
    expect(analyticsKpisSchema.safeParse({ ...kpis, roundAttendanceRate: 1.1 }).success).toBe(false);
    expect(analyticsKpisSchema.safeParse({ ...kpis, attendedRounds: undefined }).success).toBe(false);
  });
});
