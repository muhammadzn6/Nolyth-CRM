import "reflect-metadata";

import type {
  AuthorizationService,
  SessionRequest,
  SessionService,
  UserManagementService,
} from "@orbit/backend";
import {
  AuthorizationError,
  ConflictError,
  ValidationError,
} from "@orbit/backend";
import type { SessionUser } from "@orbit/contracts";
import { describe, expect, it, vi } from "vitest";

import { InvitationsController } from "../invitations/invitations.controller";
import { UsersController } from "./users.controller";

const admin: SessionUser = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Admin User",
  email: "admin@orbit.test",
  role: "ADMIN",
  isActive: true,
};

const bd: SessionUser = {
  id: "10000000-0000-4000-8000-000000000002",
  displayName: "BD User",
  email: "bd@orbit.test",
  role: "BD",
  isActive: true,
};

const managedUser = {
  id: "10000000-0000-4000-8000-000000000003",
  displayName: "Managed User",
  email: "managed@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
  timezone: "UTC",
  lastLoginAt: null,
};

const trustedOrigin = "https://orbit.example.com";

type TestRequest = SessionRequest & {
  actor?: SessionUser;
  headers: { origin?: string | string[] };
};

function requestFor(actor: SessionUser): TestRequest {
  return { actor, cookies: {}, headers: { origin: trustedOrigin } };
}

function requestForOrigin(actor: SessionUser, origin: string | string[] | undefined): TestRequest {
  return { actor, cookies: {}, headers: origin === undefined ? {} : { origin } };
}

function originRequest(origin?: string | string[]): TestRequest {
  return { cookies: {}, headers: origin === undefined ? {} : { origin } };
}

function createUsersHarness() {
  const users = {
    list: vi.fn().mockResolvedValue([managedUser]),
    create: vi.fn().mockResolvedValue({
      user: managedUser,
      invitationToken: "opaque-invitation-token",
    }),
    update: vi.fn().mockResolvedValue({ ...managedUser, isActive: false }),
    revokeSessions: vi.fn().mockResolvedValue(undefined),
  };
  const authorization = {
    assertRole: vi.fn((actor: SessionUser, roles: readonly string[]) => {
      if (!actor.isActive || !roles.includes(actor.role)) {
        throw new AuthorizationError();
      }
    }),
  };

  return {
    controller: new UsersController(
      users as unknown as UserManagementService,
      authorization as unknown as AuthorizationService,
      `${trustedOrigin}/app`,
    ),
    users,
  };
}

describe("UsersController admin boundary", () => {
  it("allows BD to list users for application assignment", async () => {
    const { controller, users } = createUsersHarness();

    await expect(controller.list(requestFor(bd))).resolves.toEqual([expect.objectContaining({ role: "CLOSER" })]);
    expect(users.list).toHaveBeenCalledWith(bd);
  });

  it("rejects unknown create payload fields before calling the service", async () => {
    const { controller, users } = createUsersHarness();

    await expect(
      controller.create(
        {
          displayName: "Managed User",
          email: "managed@orbit.test",
          role: "BD",
          timezone: "UTC",
          isAdmin: true,
        },
        requestFor(admin),
      ),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(users.create).not.toHaveBeenCalled();
  });

  it("propagates duplicate email conflicts from user creation", async () => {
    const { controller, users } = createUsersHarness();
    users.create.mockRejectedValueOnce(new ConflictError("A user with this email already exists"));

    await expect(
      controller.create(
        {
          displayName: "Existing User",
          email: "existing@orbit.test",
          role: "BD",
          timezone: "UTC",
        },
        requestFor(admin),
      ),
    ).rejects.toEqual(new ConflictError("A user with this email already exists"));
  });

  it("creates, updates, deactivates, and revokes sessions for admins", async () => {
    const { controller, users } = createUsersHarness();

    await expect(
      controller.create(
        {
          displayName: "Managed User",
          email: "managed@orbit.test",
          role: "CLOSER",
          timezone: "UTC",
        },
        requestFor(admin),
      ),
    ).resolves.toEqual({
      user: managedUser,
      invitationToken: "opaque-invitation-token",
    });
    await expect(
      controller.update(managedUser.id, { displayName: "Deactivated User" }, requestFor(admin)),
    ).resolves.toEqual({ ...managedUser, isActive: false });
    await expect(
      controller.update(managedUser.id, { isActive: false }, requestFor(admin)),
    ).resolves.toEqual({ ...managedUser, isActive: false });
    await expect(controller.revokeSessions(managedUser.id, requestFor(admin))).resolves.toBeUndefined();

    expect(users.create).toHaveBeenCalledWith(admin, {
      displayName: "Managed User",
      email: "managed@orbit.test",
      role: "CLOSER",
      timezone: "UTC",
    });
    expect(users.update).toHaveBeenCalledWith(admin, managedUser.id, { displayName: "Deactivated User" });
    expect(users.update).toHaveBeenCalledWith(admin, managedUser.id, { isActive: false });
    expect(users.revokeSessions).toHaveBeenCalledWith(admin, managedUser.id);
  });

  it("rejects malformed user ids before updates", async () => {
    const { controller, users } = createUsersHarness();

    await expect(
      controller.update("not-a-uuid", { displayName: "Managed User" }, requestFor(admin)),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(users.update).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", [trustedOrigin, "https://attacker.example.com"]],
  ])("rejects a %s Origin before creating users", async (_label, origin) => {
    const { controller, users } = createUsersHarness();

    await expect(
      controller.create(
        {
          displayName: "Managed User",
          email: "managed@orbit.test",
          role: "BD",
          timezone: "UTC",
        },
        requestForOrigin(admin, origin),
      ),
    ).rejects.toEqual(new AuthorizationError("Request origin is not allowed"));
    expect(users.create).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", [trustedOrigin, "https://attacker.example.com"]],
  ])("rejects a %s Origin before updating users", async (_label, origin) => {
    const { controller, users } = createUsersHarness();

    await expect(
      controller.update(managedUser.id, { displayName: "Managed User" }, requestForOrigin(admin, origin)),
    ).rejects.toEqual(new AuthorizationError("Request origin is not allowed"));
    expect(users.update).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", [trustedOrigin, "https://attacker.example.com"]],
  ])("rejects a %s Origin before revoking sessions", async (_label, origin) => {
    const { controller, users } = createUsersHarness();

    await expect(controller.revokeSessions(managedUser.id, requestForOrigin(admin, origin))).rejects.toEqual(
      new AuthorizationError("Request origin is not allowed"),
    );
    expect(users.revokeSessions).not.toHaveBeenCalled();
  });
});

describe("InvitationsController public acceptance", () => {
  it.each([
    ["missing", undefined],
    ["cross-site", "https://attacker.example.com"],
    ["multiple", ["https://orbit.example.com", "https://attacker.example.com"]],
  ])("rejects a %s Origin before accepting an invitation", async (_label, origin) => {
    const invitation = { accept: vi.fn() };
    const sessions = { create: vi.fn() };
    const response = { cookie: vi.fn() };
    const controller = new InvitationsController(
      invitation as never,
      sessions as never,
      "https://orbit.example.com/app",
    );

    await expect(
      controller.accept(
        { token: "opaque-token", password: "correct horse battery staple" },
        originRequest(origin),
        response,
      ),
    ).rejects.toEqual(new AuthorizationError("Request origin is not allowed"));
    expect(invitation.accept).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("rejects invalid acceptance payloads before calling the service", async () => {
    const invitation = { accept: vi.fn() };
    const sessions = { create: vi.fn() };
    const response = { cookie: vi.fn() };
    const controller = new InvitationsController(
      invitation as never,
      sessions as never,
      "https://orbit.example.com/app",
    );

    await expect(
      controller.accept(
        { token: "", password: "short" },
        originRequest("https://orbit.example.com"),
        response,
      ),
    ).rejects.toEqual(expect.objectContaining({ statusCode: 422, code: new ValidationError().code }));
    expect(invitation.accept).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it("accepts an invitation and sets the new secure session cookie", async () => {
    const invitation = { accept: vi.fn().mockResolvedValue(bd) };
    const sessions = {
      create: vi.fn().mockResolvedValue({
        sessionToken: "new-session-token",
        expiresAt: new Date("2026-10-02T00:00:00.000Z"),
      }),
    };
    const response = { cookie: vi.fn() };
    const controller = new InvitationsController(
      invitation as never,
      sessions as unknown as SessionService,
      "https://orbit.example.com/app",
    );

    await expect(
      controller.accept(
        { token: "opaque-token", password: "correct horse battery staple" },
        originRequest("https://orbit.example.com"),
        response,
      ),
    ).resolves.toEqual(bd);

    expect(invitation.accept).toHaveBeenCalledWith("opaque-token", "correct horse battery staple");
    expect(sessions.create).toHaveBeenCalledWith(bd.id);
    expect(response.cookie).toHaveBeenCalledWith("orbit_session", "new-session-token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date("2026-10-02T00:00:00.000Z"),
    });
  });
});
