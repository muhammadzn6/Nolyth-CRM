import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("../../lib/api-client", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import CalendarRoute from "./page";

describe("CalendarRoute", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    getCurrentActorMock.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", displayName: "Ayesha", email: "ayesha@orbit.test", role: "BD", isActive: true });
  });

  it("returns authenticated users to the dashboard calendar", async () => {
    await CalendarRoute();

    expect(redirectMock).toHaveBeenCalledWith("/?calendarView=day");
  });
});
