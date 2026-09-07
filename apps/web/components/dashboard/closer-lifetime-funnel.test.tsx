// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CloserDashboardData, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloserDashboard } from "./closer-dashboard";
import { closerStageThickness } from "./closer-lifetime-funnel";

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
      offers: 6,
      placements: 2,
    });

    const funnel = container.querySelector('[aria-label="Closer lifetime placement funnel"]');
    expect(funnel).not.toBeNull();
    expect(funnel?.textContent).toContain("All time");
    expect(funnel?.textContent).toContain("Applications handled");
    expect(funnel?.textContent).toContain("48");
    expect(funnel?.textContent).toContain("Interviews scheduled");
    expect(funnel?.textContent).toContain("22");
    expect(funnel?.textContent).toContain("Calls attended");
    expect(funnel?.textContent).toContain("14");
    expect(funnel?.textContent).toContain("Offers");
    expect(funnel?.textContent).toContain("6");
    expect(funnel?.textContent).toContain("Placements");
    expect(funnel?.textContent).toContain("2");
    expect(funnel?.textContent).toContain("46%");
    expect(funnel?.textContent).toContain("64%");
    expect(funnel?.textContent).toContain("43%");
    expect(funnel?.textContent).toContain("33%");
    expect(funnel?.querySelector('a[href="/leads"]')).not.toBeNull();
    expect(funnel?.querySelectorAll('a[href="/leads?pipelineStage=INTERVIEW"]')).toHaveLength(2);
    expect(funnel?.querySelector('a[href="/leads?pipelineStage=OFFER"]')).not.toBeNull();
    expect(funnel?.querySelector('a[href="/leads?pipelineStage=PLACEMENT"]')).not.toBeNull();
    expect(funnel?.querySelector('svg[aria-label="Placement flow: Applications handled 48, Interviews scheduled 22, Calls attended 14, Offers 6, Placements 2"]')).not.toBeNull();

    const conversions = Array.from(funnel?.querySelectorAll('[aria-label="Adjacent stage conversions"] > div') ?? []);
    expect(conversions).toHaveLength(4);
    expect(conversions[0]?.querySelector("dt")?.textContent).toBe("Applications handled → Interviews scheduled");
    expect(conversions[0]?.querySelector("dd")?.textContent).toBe("46%");
    expect(conversions[1]?.querySelector("dt")?.textContent).toBe("Interviews scheduled → Calls attended");
    expect(conversions[1]?.querySelector("dd")?.textContent).toBe("64%");
    expect(conversions[2]?.querySelector("dt")?.textContent).toBe("Calls attended → Offers");
    expect(conversions[2]?.querySelector("dd")?.textContent).toBe("43%");
    expect(conversions[3]?.querySelector("dt")?.textContent).toBe("Offers → Placements");
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
});
