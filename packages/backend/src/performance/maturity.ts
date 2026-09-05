export type MaturityCohort = {
  appliedAt: Date;
  maturityAt: Date;
  isMatured: boolean;
};

export function maturityDate(appliedAt: Date, maturityDays: number): Date {
  if (Number.isNaN(appliedAt.getTime()) || !Number.isInteger(maturityDays) || maturityDays < 0) {
    throw new Error("Expected a valid application date and a non-negative whole-day maturity window");
  }
  return new Date(appliedAt.getTime() + maturityDays * 86_400_000);
}

/**
 * The cohort is anchored to the application timestamp. Callers can pass a
 * later recruiter response as observedAt without moving that cohort.
 */
export function getMaturityCohort(input: {
  appliedAt: Date;
  maturityDays: number;
  observedAt: Date;
}): MaturityCohort {
  const maturityAt = maturityDate(input.appliedAt, input.maturityDays);
  return {
    appliedAt: new Date(input.appliedAt),
    maturityAt,
    isMatured: input.observedAt >= maturityAt,
  };
}
