import { describe, expect, it } from "vitest";
import { buildDashboardKpis } from "./dashboard-kpis";

describe("buildDashboardKpis", () => {
  it("builds defined, clickable operational KPIs from dashboard data", () => {
    const cards = buildDashboardKpis({
      applications: 70,
      responses: 12,
      interviews: 8,
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
      ["interviews", 8],
      ["overdue", 4],
      ["conflicts", 2],
      ["offers", 3],
      ["placements", 1],
    ]);
    expect(cards.every((card) => card.href && card.definition)).toBe(true);
    expect(cards.find((card) => card.key === "responses")?.href).toBe("/leads?status=RESPONSE_RECEIVED");
  });
});
