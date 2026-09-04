import { renderToStaticMarkup } from "react-dom/server";
import type { SessionUser } from "@orbit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getDashboardMock = vi.hoisted(() => vi.fn());
const getCloserDashboardMock = vi.hoisted(() => vi.fn());
const getCalendarMock = vi.hoisted(() => vi.fn());
const listTasksMock = vi.hoisted(() => vi.fn());

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

vi.mock("../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: getCurrentActorMock,
  getDashboard: getDashboardMock,
  getCloserDashboard: getCloserDashboardMock,
  getCalendar: getCalendarMock,
  listTasks: listTasksMock,
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
    listTasksMock.mockReset();
  });

  it("renders the calendar-first dashboard only for closer actors", async () => {
    getCurrentActorMock.mockResolvedValueOnce(closer).mockResolvedValueOnce(admin).mockResolvedValueOnce(bd);
    getCloserDashboardMock.mockResolvedValue({});
    getDashboardMock.mockResolvedValue({});
    getCalendarMock.mockResolvedValue([]);
    listTasksMock.mockResolvedValue([]);

    expect(renderToStaticMarkup(await HomePage())).toContain("closer-dashboard");
    expect(renderToStaticMarkup(await HomePage())).toContain("standard-dashboard");
    expect(renderToStaticMarkup(await HomePage())).toContain("standard-dashboard");
    expect(getCloserDashboardMock).toHaveBeenCalledTimes(1);
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
    expect(listTasksMock).toHaveBeenCalledTimes(2);
  });
});
