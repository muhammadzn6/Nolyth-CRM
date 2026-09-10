import type { IdentityService, SessionRequest } from "@orbit/backend";
import { AuthorizationError, ValidationError } from "@orbit/backend";
import { describe, expect, it, vi } from "vitest";

import { IdentityController } from "./identity.controller";

const APP_BASE_URL = "https://orbit.example.com/app";
const loginInput = { email: "active@example.com", password: "correct-password" };

type TestRequest = SessionRequest & { headers: { origin?: string | string[] } };

function createHarness() {
  const identity = {
    login: vi.fn().mockResolvedValue({
      user: {
        id: "10000000-0000-4000-8000-000000000001",
        displayName: "Active User",
        email: "active@example.com",
        role: "BD",
        isActive: true,
      },
      sessionToken: "session-token",
      expiresAt: new Date("2026-09-03T00:00:00.000Z"),
      accessToken: "access-token",
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const response = { cookie: vi.fn(), clearCookie: vi.fn() };
  const controller = new IdentityController(identity as unknown as IdentityService, APP_BASE_URL);

  return { controller, identity, response };
}

function requestWithOrigin(origin?: string | string[]): TestRequest {
  return { cookies: {}, headers: origin === undefined ? {} : { origin } };
}

describe("IdentityController request security", () => {
  it.each([
    ["missing", undefined],
    ["null", "null"],
    ["malformed", "://bad-origin"],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", ["https://orbit.example.com", "https://attacker.example.com"]],
  ])("rejects a %s Origin on login", async (_label, origin) => {
    const { controller, identity, response } = createHarness();

    await expect(controller.login(loginInput, requestWithOrigin(origin), response)).rejects.toEqual(
      expect.objectContaining({ statusCode: 403, code: new AuthorizationError().code }),
    );
    expect(identity.login).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["null", "null"],
    ["malformed", "://bad-origin"],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", ["https://orbit.example.com", "https://attacker.example.com"]],
  ])("rejects a %s Origin on logout", async (_label, origin) => {
    const { controller, identity, response } = createHarness();

    await expect(controller.logout(requestWithOrigin(origin), response)).rejects.toEqual(
      expect.objectContaining({ statusCode: 403, code: new AuthorizationError().code }),
    );
    expect(identity.logout).not.toHaveBeenCalled();
  });

  it("accepts the configured application Origin", async () => {
    const { controller, identity, response } = createHarness();

    await controller.login(loginInput, requestWithOrigin("https://orbit.example.com"), response);
    await controller.logout(requestWithOrigin("https://orbit.example.com"), response);

    expect(identity.login).toHaveBeenCalledOnce();
    expect(response.cookie).toHaveBeenCalledWith("orbit_access", "access-token", expect.any(Object));
    expect(identity.logout).toHaveBeenCalledOnce();
    expect(response.clearCookie).toHaveBeenCalledWith("orbit_access", expect.any(Object));
  });

  it("maps invalid login input to a validation error with status 422", async () => {
    const { controller, identity, response } = createHarness();

    await expect(
      controller.login(
        { email: "not-an-email", password: "" },
        requestWithOrigin("https://orbit.example.com"),
        response,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        statusCode: 422,
        code: new ValidationError().code,
      }),
    );
    expect(identity.login).not.toHaveBeenCalled();
  });
});
