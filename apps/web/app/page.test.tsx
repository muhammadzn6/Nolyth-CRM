import { renderToStaticMarkup } from "react-dom/server";
import type { SessionUser } from "@orbit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getDashboardMock = vi.hoisted(() => vi.fn());
const getCloserDashboardMock = vi.hoisted(() => vi.fn());
const getCalendarMock = vi.hoisted(() => vi.fn());
const listLeadsMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("../components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("../components/dashboard/dashboard-overview", () => ({
  DashboardOverview: () => <p>standard-dashboard</p>,
}));

vi.mock("../components/dashboard/closer-dashboard", () => ({
  CloserDashboard: () => <p>closer-dashboard</p>,
}));

vi.mock("../components/dashboard/bd-dashboard", () => ({
  BdDashboard: ({ error, performancePeriod }: { error?: string; performancePeriod?: string }) => <p>{`bd-dashboard:${error ?? "ready"}:${performancePeriod ?? "missing-period"}`}</p>,
}));

vi.mock("../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: getCurrentActorMock,
  getDashboard: getDashboardMock,
  getCloserDashboard: getCloserDashboardMock,
  getCalendar: getCalendarMock,
  listLeads: listLeadsMock,
  listUsers: vi.fn(async () => []),
  listActivity: vi.fn(async () => []),
}));

import { businessDayPerformanceRange } from "../lib/business-day";
import HomePage from "./page";

const closer: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  displayName: "Nadia Reed",
  email: "nadia@orbit.example",
  role: "CLOSER",
  isActive: true,
};

const admin: SessionUser = { ...closer, role: "ADMIN" };
const bd: SessionUser = { ...closer, role: "BD" };

describe("HomePage", () => {
  beforeEach(() => {
    getCurrentActorMock.mockReset();
    getDashboardMock.mockReset();
    getCloserDashboardMock.mockReset();
    getCalendarMock.mockReset();
    listLeadsMock.mockReset();
    listLeadsMock.mockResolvedValue({ items: [], nextCursor: null });
    vi.unstubAllGlobals();
  });

  it("renders the shared overview only for admin actors and preserves the BD-specific shell", async () => {
    getCurrentActorMock.mockResolvedValueOnce(closer).mockResolvedValueOnce(admin).mockResolvedValueOnce(bd);
    getCloserDashboardMock.mockResolvedValue({});
    getDashboardMock.mockResolvedValue({});
    getCalendarMock.mockResolvedValue([]);

    expect(renderToStaticMarkup(await HomePage())).toContain("closer-dashboard");
    expect(renderToStaticMarkup(await HomePage())).toContain("standard-dashboard");
    expect(renderToStaticMarkup(await HomePage())).toContain("bd-dashboard:");
    expect(getCloserDashboardMock).toHaveBeenCalledTimes(1);
    expect(getDashboardMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the BD-specific dashboard shell when personal performance is unavailable", async () => {
    getCurrentActorMock.mockResolvedValue(bd);
    getDashboardMock.mockResolvedValue({});
    getCalendarMock.mockResolvedValue([]);
    listLeadsMock.mockResolvedValue({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("performance unavailable"); }));

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("bd-dashboard:Performance data is temporarily unavailable.");
    expect(html).not.toContain("standard-dashboard");
  });

  it("passes the URL-backed performance period to the BD dashboard", async () => {
    getCurrentActorMock.mockResolvedValue(bd);
    getCalendarMock.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("performance unavailable"); }));

    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({ performancePeriod: "7d" }) }));

    expect(html).toContain(":7d");
  });

  it("anchors Today to the configured business timezone instead of UTC", () => {
    expect(businessDayPerformanceRange(new Date("2026-09-08T02:00:00.000Z"), "America/New_York")).toEqual({
      from: "2026-09-07T04:00:00.000Z",
      to: "2026-09-08T02:00:00.000Z",
    });
  });
});
