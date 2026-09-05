import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getCalendarMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../components/calendar/calendar-workspace", () => ({
  CalendarWorkspace: ({ initialDate }: { initialDate?: string }) => <p>{`selected-date:${initialDate ?? "none"}`}</p>,
}));
vi.mock("../../lib/api-client", () => ({
  getCurrentActor: getCurrentActorMock,
  getCalendar: getCalendarMock,
  listLeads: vi.fn(async () => ({ items: [] })),
  listUsers: vi.fn(async () => []),
  ApiClientError: class ApiClientError extends Error {},
}));

import CalendarRoute from "./page";

describe("CalendarRoute", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", displayName: "Ayesha", email: "ayesha@orbit.test", role: "BD", isActive: true });
    getCalendarMock.mockResolvedValue([]);
  });

  it("selects the date supplied by the BD open-calendar quick action", async () => {
    const date = "2026-09-08T09:00:00.000Z";
    const html = renderToStaticMarkup(await CalendarRoute({ searchParams: Promise.resolve({ date }) }));

    expect(html).toContain(`selected-date:${date}`);
  });
});
