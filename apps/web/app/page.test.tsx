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
  BdDashboard: ({ error }: { error?: string }) => <p>{`bd-dashboard:${error ?? "ready"}`}</p>,
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
});
