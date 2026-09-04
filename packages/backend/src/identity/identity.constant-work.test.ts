import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyPasswordMock } = vi.hoisted(() => ({ verifyPasswordMock: vi.fn() }));

vi.mock("./password", () => ({ verifyPassword: verifyPasswordMock }));

import { AuthenticationError } from "../errors/app-error";
import { IdentityService } from "./identity.service";

const inactiveUser = {
  id: "10000000-0000-4000-8000-000000000002",
  displayName: "Inactive User",
  email: "inactive@example.com",
  passwordHash: "$argon2id$stored-hash",
  role: "BD" as const,
  isActive: false,
  lastLoginAt: null,
};
const activeUserWithoutPassword = {
  ...inactiveUser,
  id: "10000000-0000-4000-8000-000000000003",
  email: "no-password@example.com",
  passwordHash: null,
  isActive: true,
};
const activeUserWithUnusablePassword = {
  ...inactiveUser,
  id: "10000000-0000-4000-8000-000000000004",
  email: "bad-hash@example.com",
  passwordHash: "$argon2id$malformed",
  isActive: true,
};

function createIdentity(
  user: typeof inactiveUser | typeof activeUserWithoutPassword | typeof activeUserWithUnusablePassword | null,
) {
  const database = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn(),
    },
  };
  const sessions = { create: vi.fn() };

  return new IdentityService(database as never, sessions as never);
}

describe("IdentityService constant-work login", () => {
  beforeEach(() => {
    verifyPasswordMock.mockReset().mockResolvedValue(false);
  });

  it("runs dummy verification before rejecting an absent account", async () => {
    const identity = createIdentity(null);

    await expect(
      identity.login({ email: "missing@example.com", password: "submitted-password" }, {}),
    ).rejects.toEqual(new AuthenticationError("Invalid email or password"));

    expect(verifyPasswordMock).toHaveBeenCalledOnce();
    expect(verifyPasswordMock).toHaveBeenCalledWith(null, "submitted-password");
  });

  it("runs dummy verification before rejecting an inactive account", async () => {
    const identity = createIdentity(inactiveUser);

    await expect(
      identity.login({ email: inactiveUser.email, password: "submitted-password" }, {}),
    ).rejects.toEqual(new AuthenticationError("Invalid email or password"));

    expect(verifyPasswordMock).toHaveBeenCalledOnce();
    expect(verifyPasswordMock).toHaveBeenCalledWith(null, "submitted-password");
  });

  it("runs dummy verification before rejecting an account without a password hash", async () => {
    const identity = createIdentity(activeUserWithoutPassword);

    await expect(
      identity.login(
        { email: activeUserWithoutPassword.email, password: "submitted-password" },
        {},
      ),
    ).rejects.toEqual(new AuthenticationError("Invalid email or password"));

    expect(verifyPasswordMock).toHaveBeenCalledOnce();
    expect(verifyPasswordMock).toHaveBeenCalledWith(null, "submitted-password");
  });

  it("keeps the generic failure when an active account has an unusable hash", async () => {
    const identity = createIdentity(activeUserWithUnusablePassword);

    await expect(
      identity.login(
        { email: activeUserWithUnusablePassword.email, password: "submitted-password" },
        {},
      ),
    ).rejects.toEqual(new AuthenticationError("Invalid email or password"));

    expect(verifyPasswordMock).toHaveBeenCalledOnce();
    expect(verifyPasswordMock).toHaveBeenCalledWith("$argon2id$malformed", "submitted-password");
  });
});
