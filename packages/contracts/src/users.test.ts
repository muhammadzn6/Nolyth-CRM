import { describe, expect, it } from "vitest";

import {
  acceptInvitationSchema,
  createUserSchema,
  updateUserSchema,
  userSummarySchema,
} from "./index";

const userSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  role: "ADMIN" as const,
  isActive: true,
  timezone: "Europe/London",
  lastLoginAt: "2026-09-02T07:00:00.000Z",
};

describe("user-management contracts", () => {
  it("exposes only the safe user summary fields", () => {
    expect(userSummarySchema.parse(userSummary)).toEqual(userSummary);
    expect(
      userSummarySchema.safeParse({ ...userSummary, passwordHash: "$argon2id$secret" }).success,
    ).toBe(false);
  });

  it("normalizes create-user email casing and surrounding whitespace", () => {
    expect(
      createUserSchema.parse({
        displayName: "  Ada Lovelace  ",
        email: "  Ada@Example.COM  ",
        role: "BD",
        timezone: "Europe/London",
      }),
    ).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      role: "BD",
      timezone: "Europe/London",
    });
  });

  it("rejects unknown create and update fields", () => {
    expect(
      createUserSchema.safeParse({
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        role: "BD",
        timezone: "UTC",
        password: "do-not-accept-admin-supplied-passwords",
      }).success,
    ).toBe(false);
    expect(
      updateUserSchema.safeParse({ role: "CLOSER", email: "replacement@example.com" }).success,
    ).toBe(false);
  });

  it("accepts only supported mutable user fields and valid IANA timezones", () => {
    expect(
      updateUserSchema.parse({
        displayName: "  Grace Hopper  ",
        role: "CLOSER",
        timezone: "America/New_York",
        isActive: false,
      }),
    ).toEqual({
      displayName: "Grace Hopper",
      role: "CLOSER",
      timezone: "America/New_York",
      isActive: false,
    });
    expect(updateUserSchema.safeParse({ timezone: "Not/A_Timezone" }).success).toBe(false);
  });

  it("rejects an empty user update", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an opaque invitation token and a new password without extra fields", () => {
    const input = {
      token: "opaque-token-value",
      password: "correct horse battery staple",
    };

    expect(acceptInvitationSchema.parse(input)).toEqual(input);
    expect(acceptInvitationSchema.safeParse({ ...input, userId: userSummary.id }).success).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({ token: input.token, password: "too-short" }).success,
    ).toBe(false);
  });
});
