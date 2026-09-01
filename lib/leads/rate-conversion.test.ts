import {
  calculateAverageRate,
  normalizeRateAmount,
  HOURS_PER_YEAR,
} from "@/lib/leads/rate-conversion";

describe("rate conversion", () => {
  it("converts hourly rates to yearly equivalents", () => {
    expect(normalizeRateAmount(85, "HOURLY", "YEARLY")).toBe(85 * HOURS_PER_YEAR);
  });

  it("converts yearly rates to hourly equivalents", () => {
    expect(normalizeRateAmount(208000, "YEARLY", "HOURLY")).toBe(100);
  });

  it("averages mixed units into a single hourly mean", () => {
    const average = calculateAverageRate(
      [
        { rateAmount: 100, rateUnit: "HOURLY" },
        { rateAmount: 208000, rateUnit: "YEARLY" },
      ],
      "HOURLY",
    );

    expect(average).toBe(100);
  });

  it("averages mixed units into a single yearly mean", () => {
    const average = calculateAverageRate(
      [
        { rateAmount: 100, rateUnit: "HOURLY" },
        { rateAmount: 208000, rateUnit: "YEARLY" },
      ],
      "YEARLY",
    );

    expect(average).toBe(208000);
  });
});
