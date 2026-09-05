import { describe, expect, it } from "vitest";

import {
  calculateBalancedScore,
  calculateEffectiveAttainment,
  calculateOutcomeScore,
} from "./score";

describe("calculateEffectiveAttainment", () => {
  it.each([
    [100, 100],
    [120, 120],
    [160, 130],
    [200, 140],
  ])("maps %s%% raw attainment to %s%% effective attainment", (rawPercent, expected) => {
    expect(calculateEffectiveAttainment(rawPercent)).toBe(expected);
  });
});

describe("calculateOutcomeScore", () => {
  it("uses the highest reached stage only", () => {
    expect(calculateOutcomeScore([
      { highestStage: "POSITIVE_REPLY" },
      { highestStage: "INTERVIEW" },
      { highestStage: "OFFER" },
      { highestStage: "NONE" },
    ])).toBe(45);
  });

  it("uses positive non-decreasing configurable points without exceeding 100 percent", () => {
    expect(calculateOutcomeScore([
      { highestStage: "POSITIVE_REPLY" },
      { highestStage: "SCREENING" },
      { highestStage: "INTERVIEW" },
      { highestStage: "OFFER" },
    ], {
      POSITIVE_REPLY: 2,
      SCREENING: 2,
      INTERVIEW: 4,
      OFFER: 4,
    })).toBe(75);
  });

  it("rejects non-positive or decreasing Admin outcome points", () => {
    expect(() => calculateOutcomeScore([], {
      POSITIVE_REPLY: 0,
      SCREENING: 2,
      INTERVIEW: 3,
      OFFER: 5,
    })).toThrow("Outcome points must be positive and non-decreasing");
    expect(() => calculateOutcomeScore([], {
      POSITIVE_REPLY: 3,
      SCREENING: 2,
      INTERVIEW: 4,
      OFFER: 5,
    })).toThrow("Outcome points must be positive and non-decreasing");
  });
});

describe("calculateBalancedScore", () => {
  it("uses 45/25/30 when every component is measurable", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: 100,
      followUpSlaCompliancePercent: 80,
      outcome: { scorePercent: 50, maturityElapsed: true },
    })).toEqual({
      score: 80,
      componentWeights: { applications: 45, followUps: 25, outcomes: 30 },
      coveragePercent: 100,
      status: "COMPLETE",
      components: { applications: 100, followUps: 80, outcomes: 50 },
    });
  });

  it("excludes unavailable follow-ups and rebalances applications/outcomes", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: 110,
      followUpSlaCompliancePercent: null,
      outcome: { scorePercent: 60, maturityElapsed: true },
    })).toMatchObject({
      score: 90,
      componentWeights: { applications: 60, followUps: 0, outcomes: 40 },
      coveragePercent: 75,
      status: "PARTIAL_MEASUREMENT",
    });
  });

  it("uses zero outcomes after maturity when the BD has no matured applications", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: 100,
      followUpSlaCompliancePercent: 100,
      outcome: { scorePercent: null, maturityElapsed: true },
    })).toMatchObject({
      score: 70,
      componentWeights: { applications: 45, followUps: 25, outcomes: 30 },
      coveragePercent: 100,
      status: "COMPLETE",
      components: { outcomes: 0 },
    });
  });

  it("marks an audited outcome exception unavailable and rebalances the remaining score", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: 100,
      followUpSlaCompliancePercent: 100,
      outcome: { scorePercent: null, maturityElapsed: true, auditedException: true },
    })).toMatchObject({
      score: 100,
      componentWeights: { applications: 64.3, followUps: 35.7, outcomes: 0 },
      coveragePercent: 70,
      status: "PARTIAL_MEASUREMENT",
    });
  });

  it("returns a provisional application-only score", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: 100,
      followUpSlaCompliancePercent: null,
      outcome: { scorePercent: null, maturityElapsed: false },
    })).toMatchObject({
      score: 100,
      componentWeights: { applications: 100, followUps: 0, outcomes: 0 },
      coveragePercent: 45,
      status: "PROVISIONAL",
    });
  });

  it("returns insufficient data when no component is measurable", () => {
    expect(calculateBalancedScore({
      effectiveAttainmentPercent: null,
      followUpSlaCompliancePercent: null,
      outcome: { scorePercent: null, maturityElapsed: false },
    })).toEqual({
      score: null,
      componentWeights: { applications: 0, followUps: 0, outcomes: 0 },
      coveragePercent: 0,
      status: "INSUFFICIENT_DATA",
      components: { applications: null, followUps: null, outcomes: null },
    });
  });
});
