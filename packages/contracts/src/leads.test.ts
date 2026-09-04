import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import * as contracts from "./index";

const profileId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000002";
const ownerId = "00000000-0000-4000-8000-000000000003";
const sourceId = "00000000-0000-4000-8000-000000000004";

function schema(name: string): ZodType {
  const value = (contracts as Record<string, unknown>)[name];
  expect(value, `${name} must be exported`).toBeDefined();
  return value as ZodType;
}

function validLead() {
  return {
    profileId,
    companyId,
    currentOwnerId: ownerId,
    sourceId,
    jobTitle: "  Staff Platform Engineer  ",
    rawUrl: "  https://jobs.example.com/openings/42?utm_source=orbit  ",
    appliedDate: "2026-09-02",
  };
}

describe("company, contact, and lead contracts", () => {
  it("accepts a trimmed raw job URL while keeping canonical URL and hash server-owned", () => {
    expect(schema("createLeadSchema").parse(validLead())).toEqual({
      ...validLead(),
      jobTitle: "Staff Platform Engineer",
      rawUrl: "https://jobs.example.com/openings/42?utm_source=orbit",
    });
    expect(
      schema("createLeadSchema").safeParse({
        ...validLead(),
        canonicalUrl: "https://jobs.example.com/openings/42",
        canonicalHash: "client-controlled-hash",
      }).success,
    ).toBe(false);
    expect(schema("createLeadSchema").safeParse({ ...validLead(), rawUrl: "not a URL" }).success).toBe(
      false,
    );
  });

  it.each(["profileId"])(
    "requires %s when creating a lead",
    (field) => {
      const input = validLead() as Record<string, unknown>;
      delete input[field];

      expect(schema("createLeadSchema").safeParse(input).success).toBe(false);
    },
  );

  it("accepts a first-time company name without pre-created company or source records", () => {
    const input = { ...validLead(), companyName: "NewCo", recruiterName: "Jordan Lee", recruiterEmail: "jordan@newco.example" };
    delete (input as Record<string, unknown>).companyId;
    delete (input as Record<string, unknown>).sourceId;
    expect(schema("createLeadSchema").safeParse(input).success).toBe(true);
  });

  it("allows the server to default ownership for an importing BD", () => {
    const input = { ...validLead(), companyName: "NewCo" };
    delete (input as Record<string, unknown>).companyId;
    delete (input as Record<string, unknown>).currentOwnerId;
    expect(schema("createLeadSchema").safeParse(input).success).toBe(true);
  });

  it("requires either a company id or company name", () => {
    const input = validLead() as Record<string, unknown>;
    delete input.companyId;
    expect(schema("createLeadSchema").safeParse(input).success).toBe(false);
  });

  it("requires the externally applied job identity and date", () => {
    for (const field of ["jobTitle", "rawUrl", "appliedDate"]) {
      const input = validLead() as Record<string, unknown>;
      delete input[field];
      expect(schema("createLeadSchema").safeParse(input).success, field).toBe(false);
    }
  });

  it("rejects invalid compensation ranges and calendar dates", () => {
    expect(
      schema("createLeadSchema").safeParse({
        ...validLead(),
        compensationMin: "90000.00",
        compensationMax: "80000.00",
      }).success,
    ).toBe(false);
    expect(
      schema("createLeadSchema").safeParse({ ...validLead(), compensationMin: "-1.00" }).success,
    ).toBe(false);
    expect(
      schema("createLeadSchema").safeParse({ ...validLead(), appliedDate: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("requires a reason when closing but not for ordinary forward transitions", () => {
    expect(
      schema("leadStatusTransitionSchema").safeParse({
        toStatus: "CLOSED",
        expectedVersion: 2,
      }).success,
    ).toBe(false);
    expect(
      schema("leadStatusTransitionSchema").parse({
        toStatus: "CLOSED",
        reason: "  Position closed  ",
        expectedVersion: 2,
      }),
    ).toEqual({ toStatus: "CLOSED", reason: "Position closed", expectedVersion: 2 });
    expect(
      schema("leadStatusTransitionSchema").safeParse({
        toStatus: "INTERVIEWING",
        expectedVersion: 2,
      }).success,
    ).toBe(true);
  });

  it("exports strict company/contact CRUD and lead lifecycle response contracts", () => {
    expect(schema("createCompanySchema").parse({ canonicalName: "  Orbit Labs  " })).toEqual({
      canonicalName: "Orbit Labs",
    });
    expect(
      schema("createContactSchema").parse({ companyId, name: "  Grace Hopper  " }),
    ).toEqual({ companyId, name: "Grace Hopper" });
    expect(schema("updateCompanySchema").safeParse({}).success).toBe(false);
    expect(schema("updateContactSchema").safeParse({}).success).toBe(false);

    for (const name of [
      "leadListQuerySchema",
      "transferLeadOwnershipSchema",
      "assignLeadCloserRequestSchema",
      "setLeadImportantSchema",
      "archiveLeadSchema",
      "restoreLeadSchema",
      "companySummarySchema",
      "contactSummarySchema",
      "leadSummarySchema",
      "leadDetailSchema",
    ]) {
      schema(name);
    }
  });
});
