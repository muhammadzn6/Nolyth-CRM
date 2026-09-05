import { describe, expect, it } from "vitest";

import { getMaturityCohort, maturityDate } from "./maturity";

describe("maturityDate", () => {
  it("advances calendar time through weekends, holidays, and leave", () => {
    expect(maturityDate(new Date("2026-09-04T12:00:00.000Z"), 21)).toEqual(
      new Date("2026-09-25T12:00:00.000Z"),
    );
  });
});

describe("getMaturityCohort", () => {
  it("keeps a late recruiter response in the application's original cohort", () => {
    expect(getMaturityCohort({
      appliedAt: new Date("2026-09-01T00:00:00.000Z"),
      maturityDays: 21,
      observedAt: new Date("2026-10-15T12:00:00.000Z"),
    })).toEqual({
      appliedAt: new Date("2026-09-01T00:00:00.000Z"),
      maturityAt: new Date("2026-09-22T00:00:00.000Z"),
      isMatured: true,
    });
  });
});
