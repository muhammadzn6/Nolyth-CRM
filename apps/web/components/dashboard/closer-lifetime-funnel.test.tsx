// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CloserDashboardData, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloserDashboard } from "./closer-dashboard";

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
});
