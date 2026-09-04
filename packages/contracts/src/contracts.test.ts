import { describe, expect, it } from "vitest";

import {
  assignLeadCloserSchema,
  assignProfileBdSchema,
  createCandidateSchema,
  createProfileSchema,
  errorResponseSchema,
  loginRequestSchema,
  profileCloserEligibilitySchema,
  sessionUserSchema,
  successResponseSchema,
  userRoleSchema,
} from "./index";

describe("shared API contracts", () => {
  it("rejects unknown transport fields", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "password",
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("parses valid roles and rejects invalid UUIDs", () => {
    expect(userRoleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(createProfileSchema.safeParse({ candidateId: "not-a-uuid" }).success).toBe(false);
  });

  it("parses candidate and assignment inputs", () => {
    const candidate = createCandidateSchema.parse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    const profile = createProfileSchema.parse({
      candidateId: "00000000-0000-4000-8000-000000000001",
      name: "Platform Engineering",
    });

    expect(candidate.firstName).toBe("Ada");
    expect(profile.candidateId).toBe("00000000-0000-4000-8000-000000000001");
    expect(assignProfileBdSchema.parse({
      profileId: profile.candidateId,
      userId: "00000000-0000-4000-8000-000000000002",
    }).userId).toBe("00000000-0000-4000-8000-000000000002");
    expect(profileCloserEligibilitySchema.parse({
      profileId: profile.candidateId,
      userId: "00000000-0000-4000-8000-000000000002",
      isEligible: true,
    }).isEligible).toBe(true);
    expect(assignLeadCloserSchema.parse({
      leadId: profile.candidateId,
      userId: "00000000-0000-4000-8000-000000000002",
    }).leadId).toBe(profile.candidateId);
  });

  it("serializes success and structured error envelopes", () => {
    expect(successResponseSchema.parse({
      success: true,
      data: { id: "1" },
      meta: { requestId: "request-1" },
    })).toEqual({
      success: true,
      data: { id: "1" },
      meta: { requestId: "request-1" },
    });
    expect(errorResponseSchema.parse({
      success: false,
      error: { code: "CONFLICT", message: "Conflict", details: { field: "email" } },
      meta: { requestId: "request-1" },
    }).error.code).toBe("CONFLICT");
  });

  it("serializes a session user", () => {
    expect(sessionUserSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      role: "ADMIN",
      isActive: true,
    }).role).toBe("ADMIN");
  });
});
