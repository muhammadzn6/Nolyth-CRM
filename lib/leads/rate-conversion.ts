import type { RateUnit } from "@/constants/leads";

export const HOURS_PER_YEAR = 2080;

export function normalizeRateAmount(
  amount: number,
  fromUnit: RateUnit,
  toUnit: RateUnit,
): number {
  if (fromUnit === toUnit) {
    return amount;
  }

  if (fromUnit === "HOURLY" && toUnit === "YEARLY") {
    return amount * HOURS_PER_YEAR;
  }

  if (fromUnit === "YEARLY" && toUnit === "HOURLY") {
    return amount / HOURS_PER_YEAR;
  }

  return amount;
}

export function calculateAverageRate(
  rates: Array<{ rateAmount: number; rateUnit: RateUnit }>,
  targetUnit: RateUnit,
): number | null {
  if (rates.length === 0) {
    return null;
  }

  const total = rates.reduce(
    (sum, item) =>
      sum + normalizeRateAmount(item.rateAmount, item.rateUnit, targetUnit),
    0,
  );

  const average = total / rates.length;
  return targetUnit === "HOURLY"
    ? Math.round(average * 100) / 100
    : Math.round(average);
}
