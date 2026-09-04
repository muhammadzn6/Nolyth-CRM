import { describe, expect, it } from "vitest";
import { buildCloserDashboardKpis } from "./closer-dashboard-kpis";

describe("buildCloserDashboardKpis", () => {
  it("summarizes the closer's execution queue with drill-down destinations", () => {
    const now = new Date("2026-09-04T10:00:00.000Z");
    const cards = buildCloserDashboardKpis({
      todayMeetings: [{ startsAt: "2026-09-04T12:00:00.000Z", preparationNotes: null }],
      calendarInterviews: [
        { startsAt: "2026-09-04T12:00:00.000Z", preparationNotes: null },
        { startsAt: "2026-09-08T12:00:00.000Z", preparationNotes: "Ready" },
      ],
      feedback: 3,
      conflicts: 1,
      openActions: 2,
    }, now);

    expect(cards.map(({ key, value }) => [key, value])).toEqual([
      ["today", 1], ["next7Days", 2], ["feedback", 3], ["prep", 1], ["conflicts", 1], ["actions", 2],
    ]);
    expect(cards.find((card) => card.key === "feedback")?.href).toBe("/#feedback");
    expect(cards.every((card) => card.definition)).toBe(true);
  });
});
