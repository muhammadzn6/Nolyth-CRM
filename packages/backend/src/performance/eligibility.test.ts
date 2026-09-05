import { describe, expect, it } from "vitest";

import { evaluateEligibility } from "./eligibility";

describe("evaluateEligibility", () => {
  it("makes a BD officially eligible after ten working days and initial maturity", () => {
    expect(evaluateEligibility({
      eligibleWorkingDays: 10,
      initialMaturityElapsed: true,
      qualifiedApplications: 20,
      maturedApplications: 5,
    })).toEqual({
      eligible: true,
      rankable: true,
      section: "OFFICIAL",
      reasons: [],
      warnings: [],
    });
  });

  it("puts new BDs in Building Baseline without using small samples as a loophole", () => {
    expect(evaluateEligibility({
      eligibleWorkingDays: 9,
      initialMaturityElapsed: false,
      qualifiedApplications: 1,
      maturedApplications: 0,
    })).toEqual({
      eligible: false,
      rankable: false,
      section: "BUILDING_BASELINE",
      reasons: ["INSUFFICIENT_ELIGIBLE_WORKING_DAYS", "INITIAL_MATURITY_WINDOW_NOT_ELAPSED"],
      warnings: ["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE"],
    });
  });

  it("keeps low-volume BDs rankable once the time gates are met", () => {
    expect(evaluateEligibility({
      eligibleWorkingDays: 10,
      initialMaturityElapsed: true,
      qualifiedApplications: 8,
      maturedApplications: 2,
    })).toMatchObject({
      eligible: true,
      rankable: true,
      section: "OFFICIAL",
      warnings: ["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE"],
    });
  });

  it("keeps documented Admin exceptions provisional and unranked", () => {
    expect(evaluateEligibility({
      eligibleWorkingDays: 12,
      initialMaturityElapsed: true,
      qualifiedApplications: 25,
      maturedApplications: 8,
      adminOverride: {
        reason: "Approved data correction is still under review",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    })).toMatchObject({
      eligible: false,
      rankable: false,
      section: "BUILDING_BASELINE",
      reasons: ["ADMIN_OVERRIDE_PROVISIONAL"],
      warnings: ["ADMIN_OVERRIDE_PROVISIONAL"],
    });
  });
});
