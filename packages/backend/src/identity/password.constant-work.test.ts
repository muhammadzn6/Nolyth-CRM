import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();

  return { ...actual, verify: verifyMock };
});

import { verifyPassword } from "./password";

describe("constant-work password verification", () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it("verifies a fixed valid Argon2id dummy hash when the password hash is absent", async () => {
    verifyMock.mockResolvedValue(true);

    await expect(verifyPassword(null, "submitted-password")).resolves.toBe(false);

    expect(verifyMock).toHaveBeenCalledOnce();
    expect(verifyMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      "submitted-password",
    );
  });

  it("uses the dummy Argon2id hash when the stored hash is not Argon2id", async () => {
    verifyMock.mockResolvedValue(false);

    await expect(verifyPassword("not-an-argon2-hash", "submitted-password")).resolves.toBe(false);

    expect(verifyMock).toHaveBeenCalledOnce();
    expect(verifyMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      "submitted-password",
    );
  });

  it("falls back to the dummy hash when an Argon2id-looking hash cannot be verified", async () => {
    verifyMock.mockRejectedValueOnce(new Error("invalid encoded hash")).mockResolvedValueOnce(false);

    await expect(verifyPassword("$argon2id$malformed", "submitted-password")).resolves.toBe(false);

    expect(verifyMock).toHaveBeenCalledTimes(2);
    expect(verifyMock.mock.calls[1]).toEqual([
      expect.stringMatching(/^\$argon2id\$/),
      "submitted-password",
    ]);
  });
});
