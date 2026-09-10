// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CloserDashboardData, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloserDashboard } from "./closer-dashboard";
import { closerStageThickness } from "./closer-lifetime-funnel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const actor: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  displayName: "Nadia Reed",
  email: "nadia@orbit.example",
  role: "CLOSER",
  isActive: true,
};

function dashboard(lifetimeFunnel: CloserDashboardData["lifetimeFunnel"]): CloserDashboardData {
  return {
    timezone: "America/New_York",
    assignedApplications: [],
    nextMeeting: null,
    todayMeetings: [],
    externalMeetings: [],
    needsFeedback: [],
    openTasks: [],
    conflicts: [],
    notifications: [],
    recentActivity: [],
    lifetimeFunnel,
    calendarConnection: {
      connected: false,
      email: null,
      calendarName: null,
      lastSyncedAt: null,
      status: "DISCONNECTED",
    },
  };
}

describe("Closer lifetime placement funnel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00.000Z"));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function renderFunnel(lifetimeFunnel: CloserDashboardData["lifetimeFunnel"]) {
    await act(async () => {
      root.render(<CloserDashboard actor={actor} data={dashboard(lifetimeFunnel)} />);
    });
  }

  it("shows the five all-time stages, record links, and adjacent conversion rates", async () => {
    await renderFunnel({
      applicationsHandled: 48,
      interviewsScheduled: 22,
      callsAttended: 14,
      interviewRounds: 37,
      attendedRounds: 29,
      cancelledRounds: 3,
      averageRoundsPerInterviewLead: 37 / 22,
      roundAttendanceRate: 29 / 37,
      offers: 6,
      placements: 2,
    });

    const funnel = container.querySelector('[aria-label="Closer lifetime placement funnel"]');
    expect(funnel).not.toBeNull();
    expect(funnel?.textContent).toContain("All time");
    expect(funnel?.textContent).toContain("Leads handled");
    expect(funnel?.textContent).toContain("48");
    expect(funnel?.textContent).toContain("Interview leads");
    expect(funnel?.textContent).toContain("22");
    expect(funnel?.textContent).toContain("Leads attended");
    expect(funnel?.textContent).toContain("14");
    expect(funnel?.textContent).toContain("Offer-stage leads");
    expect(funnel?.textContent).toContain("6");
    expect(funnel?.textContent).toContain("Placements");
    expect(funnel?.textContent).toContain("2");
    expect(funnel?.textContent).toContain("Total rounds");
    expect(funnel?.textContent).toContain("37");
    expect(funnel?.textContent).toContain("Attended rounds");
    expect(funnel?.textContent).toContain("29");
    expect(funnel?.textContent).toContain("Avg rounds / lead");
    expect(funnel?.textContent).toContain("1.7");
    expect(funnel?.textContent).toContain("Attendance rate");
    expect(funnel?.textContent).toContain("78%");
    expect(funnel?.textContent).toContain("Cancelled");
    expect(funnel?.textContent).toContain("3");
    expect(funnel?.textContent).toContain("46%");
    expect(funnel?.textContent).toContain("64%");
    expect(funnel?.textContent).toContain("43%");
    expect(funnel?.textContent).toContain("33%");
    expect(funnel?.querySelector('a[href="/leads"]')).not.toBeNull();
    expect(funnel?.querySelectorAll('a[href="/leads?pipelineStage=INTERVIEW"]')).toHaveLength(2);
    expect(funnel?.querySelector('a[href="/leads?pipelineStage=OFFER"]')).not.toBeNull();
    expect(funnel?.querySelector('a[href="/leads?pipelineStage=PLACEMENT"]')).not.toBeNull();
    expect(funnel?.querySelector('svg[aria-label="Placement flow: Leads handled 48, Interview leads 22, Leads attended 14, Offer-stage leads 6, Placements 2"]')).not.toBeNull();

    const conversions = Array.from(funnel?.querySelectorAll('[aria-label="Adjacent stage conversions"] > div') ?? []);
    expect(conversions).toHaveLength(4);
    expect(conversions[0]?.querySelector("dt")?.textContent).toBe("Leads handled → Interview leads");
    expect(conversions[0]?.querySelector("dd")?.textContent).toBe("46%");
    expect(conversions[1]?.querySelector("dt")?.textContent).toBe("Interview leads → Leads attended");
    expect(conversions[1]?.querySelector("dd")?.textContent).toBe("64%");
    expect(conversions[2]?.querySelector("dt")?.textContent).toBe("Leads attended → Offer-stage leads");
    expect(conversions[2]?.querySelector("dd")?.textContent).toBe("43%");
    expect(conversions[3]?.querySelector("dt")?.textContent).toBe("Offer-stage leads → Placements");
    expect(conversions[3]?.querySelector("dd")?.textContent).toBe("33%");

    const stageLinks = Array.from(funnel?.querySelectorAll("a") ?? []);
    expect(stageLinks[0]?.getAttribute("data-alignment")).toBe("start");
    expect(stageLinks[4]?.getAttribute("data-alignment")).toBe("end");
  });

  it("terminates the orange stream before the first zero-valued stage", async () => {
    await renderFunnel({
      applicationsHandled: 48,
      interviewsScheduled: 22,
      callsAttended: 14,
      interviewRounds: 37,
      attendedRounds: 29,
      cancelledRounds: 3,
      averageRoundsPerInterviewLead: 37 / 22,
      roundAttendanceRate: 29 / 37,
      offers: 6,
      placements: 0,
    });

    const flow = container.querySelector('[data-testid="closer-lifetime-flow"]');
    const paths = Array.from(flow?.querySelectorAll("path") ?? []);

    expect(paths).toHaveLength(4);
    expect(paths.every((path) => !path.getAttribute("d")?.includes("950"))).toBe(true);
  });

  it("renders a visible first-stage segment and stops it before a zero second stage", async () => {
    await renderFunnel({
      applicationsHandled: 48,
      interviewsScheduled: 0,
      callsAttended: 0,
      interviewRounds: 0,
      attendedRounds: 0,
      cancelledRounds: 3,
      averageRoundsPerInterviewLead: null,
      roundAttendanceRate: null,
      offers: 0,
      placements: 0,
    });

    const paths = Array.from(container.querySelectorAll('[data-testid="closer-lifetime-flow"] path'));
    expect(paths).toHaveLength(4);
    expect(paths.every((path) => path.getAttribute("d")?.includes("162.5"))).toBe(true);
    expect(paths.every((path) => !path.getAttribute("d")?.includes("275"))).toBe(true);
  });

  it("keeps nonzero stage geometry mathematically proportional", () => {
    expect(closerStageThickness(1, 10_000)).toBeCloseTo(0.0156, 8);
    expect(closerStageThickness(1, 10_000) / closerStageThickness(10_000, 10_000)).toBeCloseTo(0.0001, 8);
  });

  it("paints stream bands without any visual-expansion hook", async () => {
    await renderFunnel({
      applicationsHandled: 10_000,
      interviewsScheduled: 1,
      callsAttended: 1,
      interviewRounds: 1,
      attendedRounds: 1,
      cancelledRounds: 0,
      averageRoundsPerInterviewLead: 1,
      roundAttendanceRate: 1,
      offers: 1,
      placements: 1,
    });

    const paths = Array.from(container.querySelectorAll('[data-testid="closer-lifetime-flow"] path'));
    expect(paths).toHaveLength(4);
    expect(paths.map((path) => path.getAttributeNames().sort())).toEqual([
      ["d", "fill"],
      ["d", "fill"],
      ["d", "fill"],
      ["d", "fill"],
    ]);
  });
});
