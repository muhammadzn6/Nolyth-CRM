import { describe, expect, it } from "vitest";
import { buildDashboardKpis } from "./dashboard-kpis";

describe("buildDashboardKpis", () => {
  it("builds defined, clickable operational KPIs from dashboard data", () => {
    const cards = buildDashboardKpis({
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
    }, 2);

    expect(cards.map(({ key, value }) => [key, value])).toEqual([
      ["applications", 70],
      ["responses", 12],
      ["interview-leads", 8],
      ["interview-rounds", 14],
      ["overdue", 4],
      ["conflicts", 2],
      ["offers", 3],
      ["placements", 1],
    ]);
    expect(cards.every((card) => card.href && card.definition)).toBe(true);
    expect(cards.find((card) => card.key === "responses")?.href).toBe("/leads?status=RESPONSE_RECEIVED");
    expect(cards.find((card) => card.key === "interview-leads")?.label).toBe("Interview leads");
    expect(cards.find((card) => card.key === "interview-rounds")?.definition).toContain("Cancelled rounds are excluded");
    expect(cards.find((card) => card.key === "offers")?.label).toBe("Offer-stage leads");
  });
});
