import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import * as contracts from "./index";

function schema(name: string): ZodType {
  const value = (contracts as Record<string, unknown>)[name];
  expect(value, `${name} must be exported`).toBeDefined();
  return value as ZodType;
}

describe("candidate and profile contracts", () => {
  it("normalizes candidate names and contact fields", () => {
    expect(
      schema("createCandidateSchema").parse({
        firstName: "  Ada  ",
        lastName: "  Lovelace  ",
        preferredName: "  Ada  ",
        email: "  Ada@Example.COM  ",
        phone: "  +44 20 7946 0958  ",
        timezone: "  Europe/London  ",
        location: "  London, UK  ",
        internalNotes: "  Prefers remote roles  ",
      }),
    ).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: "Ada",
      email: "ada@example.com",
      phone: "+44 20 7946 0958",
      timezone: "Europe/London",
      location: "London, UK",
      internalNotes: "Prefers remote roles",
    });
  });

  it("rejects candidate status transitions through general mutations", () => {
    expect(
      schema("createCandidateSchema").safeParse({
        firstName: "Ada",
        lastName: "Lovelace",
        status: "ARCHIVED",
      }).success,
    ).toBe(false);
    expect(
      schema("updateCandidateSchema").safeParse({ status: "ARCHIVED" }).success,
    ).toBe(false);
  });

  it("rejects an empty candidate update", () => {
    expect(schema("updateCandidateSchema").safeParse({}).success).toBe(false);
  });

  it("requires every new profile to identify its candidate and name", () => {
    const candidateId = "00000000-0000-4000-8000-000000000001";

    expect(schema("createProfileSchema").safeParse({ name: "Platform Engineering" }).success).toBe(
      false,
    );
    expect(schema("createProfileSchema").safeParse({ candidateId }).success).toBe(false);
    expect(
      schema("createProfileSchema").parse({
        candidateId,
        name: "  Platform Engineering  ",
        defaultCurrency: " usd ",
        targetRoles: ["  Staff Engineer  ", "Engineering Manager"],
        preferredLocations: ["  London  "],
        workplacePreferences: ["  REMOTE  "],
        jobTypePreferences: ["  FULL_TIME  "],
        contractPreferences: ["  PERMANENT  "],
      }),
    ).toEqual({
      candidateId,
      name: "Platform Engineering",
      defaultCurrency: "USD",
      targetRoles: ["Staff Engineer", "Engineering Manager"],
      preferredLocations: ["London"],
      workplacePreferences: ["REMOTE"],
      jobTypePreferences: ["FULL_TIME"],
      contractPreferences: ["PERMANENT"],
    });
  });

  it("rejects empty profile updates and profile status transitions", () => {
    expect(schema("updateProfileSchema").safeParse({}).success).toBe(false);
    expect(schema("updateProfileSchema").safeParse({ status: "ACTIVE" }).success).toBe(false);
  });

  it("accepts only supported candidate and profile summary statuses", () => {
    const common = {
      archivedAt: null,
      archiveReason: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      updatedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
    };

    expect(
      schema("candidateSummarySchema").safeParse({
        ...common,
        id: "00000000-0000-4000-8000-000000000001",
        linkedUserId: null,
        firstName: "Ada",
        lastName: "Lovelace",
        preferredName: null,
        email: null,
        phone: null,
        timezone: "Europe/London",
        location: null,
        status: "ACTIVE",
      }).success,
    ).toBe(true);
    expect(
      schema("candidateSummarySchema").safeParse({
        ...common,
        id: "00000000-0000-4000-8000-000000000001",
        linkedUserId: null,
        firstName: "Ada",
        lastName: "Lovelace",
        preferredName: null,
        email: null,
        phone: null,
        timezone: "Europe/London",
        location: null,
        status: "DELETED",
      }).success,
    ).toBe(false);

    const profile = {
      ...common,
      id: "00000000-0000-4000-8000-000000000002",
      candidateId: "00000000-0000-4000-8000-000000000001",
      name: "Platform Engineering",
      description: null,
      status: "PAUSED",
      defaultCurrency: "USD",
      targetCompensation: null,
      compensationPeriod: null,
      targetRoles: ["Staff Engineer"],
      preferredLocations: ["London"],
      workplacePreferences: ["REMOTE"],
      jobTypePreferences: ["FULL_TIME"],
      contractPreferences: ["PERMANENT"],
    };
    expect(schema("profileSummarySchema").safeParse(profile).success).toBe(true);
    expect(
      schema("profileSummarySchema").safeParse({ ...profile, status: "DELETED" }).success,
    ).toBe(false);
  });

  it("normalizes list query values and bounds page size", () => {
    expect(
      schema("candidateListQuerySchema").parse({
        search: "  Ada  ",
        status: "ARCHIVED",
        limit: "25",
        cursor: "  opaque-cursor  ",
      }),
    ).toEqual({
      search: "Ada",
      status: "ARCHIVED",
      limit: 25,
      cursor: "opaque-cursor",
    });
    expect(schema("profileListQuerySchema").safeParse({ limit: "101" }).success).toBe(false);
  });
});
