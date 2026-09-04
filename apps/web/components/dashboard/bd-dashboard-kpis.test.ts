import { describe, expect, it } from "vitest";
import { buildBdDashboardKpis, buildBdSecondarySignals } from "./bd-dashboard-kpis";

describe("buildBdDashboardKpis", () => {
  it("prioritizes daily application throughput and intake quality", () => {
    const cards = buildBdDashboardKpis({
      applications: [
        { appliedDate: "2026-09-04", status: "APPLIED", rawUrl: "https://jobs.example/1", companyName: "Aurora" },
        { appliedDate: "2026-09-04", status: "RESPONSE_RECEIVED", rawUrl: "https://jobs.example/2", companyName: "Ford" },
        { appliedDate: "2026-09-03", status: "APPLIED", rawUrl: "https://jobs.example/2", companyName: "Ford" },
      ],
      openFollowUps: 4,
      interviewsToSchedule: 2,
      now: new Date("2026-09-04T12:00:00.000Z"),
      dailyTarget: 70,
    });

    expect(cards.map(({ key, value }) => [key, value])).toEqual([
      ["today", 2], ["remaining", 68], ["quality", 0], ["duplicates", 1], ["responses", 1], ["active", 1], ["followUps", 4], ["interviews", 2],
    ]);
    expect(cards.find((card) => card.key === "today")?.definition).toContain("70");
  });

  it("summarizes the secondary pipeline signals without hiding zeroes", () => {
    const signals = buildBdSecondarySignals({
      applications: [
        { status: "INTERVIEWING" },
        { status: "OFFER_RECEIVED" },
        { status: "CLOSED" },
      ],
      scheduledInterviews: 4,
      interviewsToSchedule: 2,
      averageResponseTimeHours: 18.5,
    });

    expect(signals).toEqual({ scheduledInterviews: 4, interviewsToSchedule: 2, offers: 1, closed: 1, averageResponseTimeHours: 18.5 });
  });
});
