import "reflect-metadata";

import { AuthenticationError, ValidationError, type GoogleCalendarService, type SessionService } from "@orbit/backend";
import { describe, expect, it, vi } from "vitest";

import { CalendarController } from "./calendar.controller";
import type { AuthenticatedRequest } from "../identity/identity.guard";

const closer = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
};

function createHarness() {
  const calendar = {
    connect: vi.fn().mockReturnValue({ authorizationUrl: "https://accounts.google.test/oauth" }),
    connectForProfile: vi.fn().mockReturnValue({ authorizationUrl: "https://accounts.google.test/oauth" }),
    complete: vi.fn().mockResolvedValue(undefined),
    completeForProfile: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ connected: false, email: null, calendarName: null, lastSyncedAt: null, status: "DISCONNECTED" }),
    statusForProfile: vi.fn().mockResolvedValue({ connected: true, email: "eyong@gmail.com", calendarName: "Primary", lastSyncedAt: null, status: "CONNECTED" }),
    checkGoogleBusyFree: vi.fn().mockResolvedValue({ busy: true }),
    checkGoogleBusyFreeForProfile: vi.fn().mockResolvedValue({ busy: false }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectForProfile: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    createOAuthState: vi.fn().mockReturnValue("valid-state"),
    requireOAuthState: vi.fn(),
  };

  return {
    controller: new CalendarController(
      calendar as unknown as GoogleCalendarService,
      sessions as unknown as SessionService,
      "http://localhost:3100",
    ),
    calendar,
    sessions,
  };
}

describe("CalendarController", () => {
  it("does not exchange a Google authorization code when the session-bound state is invalid", async () => {
    const { controller, calendar, sessions } = createHarness();
    sessions.requireOAuthState.mockImplementation(() => {
      throw new AuthenticationError("Invalid Google OAuth state");
    });

    await expect(
      controller.callback(
        { actor: closer, cookies: {} },
        { code: "authorization-code", state: "invalid-state" },
        { redirect: vi.fn() },
      ),
    ).rejects.toEqual(new AuthenticationError("Invalid Google OAuth state"));
    expect(calendar.complete).not.toHaveBeenCalled();
  });

  it("accepts provider metadata appended to a successful Google callback", async () => {
    const { controller, calendar, sessions } = createHarness();
    sessions.requireOAuthState.mockReturnValue({ companyId: "30000000-0000-4000-8000-000000000001" });

    await controller.callback(
      { actor: { ...closer, role: "ADMIN" }, cookies: {} },
      { code: "authorization-code", state: "valid-state", iss: "https://accounts.google.com", scope: "openid", authuser: "0", prompt: "consent" },
      { redirect: vi.fn() },
    );

    expect(calendar.complete).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }), "authorization-code", "30000000-0000-4000-8000-000000000001");
  });

  it("binds profile calendar OAuth to the candidate profile", async () => {
    const { controller, calendar, sessions } = createHarness();
    const profileId = "50000000-0000-4000-8000-000000000001";
    sessions.requireOAuthState.mockReturnValue({ profileId });

    await controller.callback(
      { actor: { ...closer, role: "ADMIN" }, cookies: {} },
      { code: "authorization-code", state: "valid-state" },
      { redirect: vi.fn() },
    );

    expect(calendar.completeForProfile).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }), "authorization-code", profileId);
  });

  it("rejects an unauthenticated connection request before creating OAuth state", () => {
    const { controller, sessions } = createHarness();
    const request: AuthenticatedRequest = { cookies: {} };

    expect(() => controller.connect(request, "30000000-0000-4000-8000-000000000001")).toThrow(new AuthenticationError());
    expect(sessions.createOAuthState).not.toHaveBeenCalled();
  });

  it("returns only the closer's Google busy state", async () => {
    const { controller, calendar } = createHarness();

    await expect(controller.busy({ actor: closer, cookies: {} }, {
      companyId: "30000000-0000-4000-8000-000000000001",
      startsAt: "2026-09-04T14:00:00.000Z",
      endsAt: "2026-09-04T14:30:00.000Z",
    })).resolves.toEqual({ busy: true });
    expect(calendar.checkGoogleBusyFree).toHaveBeenCalledWith(
      "30000000-0000-4000-8000-000000000001",
      new Date("2026-09-04T14:00:00.000Z"),
      new Date("2026-09-04T14:30:00.000Z"),
    );
  });

  it("checks busy time on a candidate profile calendar", async () => {
    const { controller, calendar } = createHarness();
    const profileId = "50000000-0000-4000-8000-000000000001";

    await expect(controller.busy({ actor: closer, cookies: {} }, {
      profileId,
      startsAt: "2026-09-04T14:00:00.000Z",
      endsAt: "2026-09-04T14:30:00.000Z",
    })).resolves.toEqual({ busy: false });
    expect(calendar.checkGoogleBusyFreeForProfile).toHaveBeenCalledWith(profileId, new Date("2026-09-04T14:00:00.000Z"), new Date("2026-09-04T14:30:00.000Z"));
  });

  it("returns a validation error when no calendar owner is supplied", () => {
    const { controller } = createHarness();

    expect(() => controller.connect({ actor: { ...closer, role: "ADMIN" }, cookies: {} })).toThrow(new ValidationError("Provide a calendar owner"));
  });
});
