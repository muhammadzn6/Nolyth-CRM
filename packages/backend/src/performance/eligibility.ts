export type EligibilityReason = "INSUFFICIENT_ELIGIBLE_WORKING_DAYS" | "INITIAL_MATURITY_WINDOW_NOT_ELAPSED" | "ADMIN_OVERRIDE_PROVISIONAL";
export type EligibilityWarning = "LOW_APPLICATION_SAMPLE" | "LOW_OUTCOME_SAMPLE" | "ADMIN_OVERRIDE_PROVISIONAL";

export type EligibilityInput = {
  eligibleWorkingDays: number;
  initialMaturityElapsed: boolean;
  qualifiedApplications: number;
  maturedApplications: number;
  evaluatedAt: Date;
  adminOverride?: {
    reason: string;
    expiresAt: Date;
  };
};

export type EligibilityResult = {
  eligible: boolean;
  rankable: boolean;
  section: "OFFICIAL" | "BUILDING_BASELINE";
  reasons: EligibilityReason[];
  warnings: EligibilityWarning[];
};

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: EligibilityReason[] = [];
  const warnings: EligibilityWarning[] = [];

  if (input.eligibleWorkingDays < 10) reasons.push("INSUFFICIENT_ELIGIBLE_WORKING_DAYS");
  if (!input.initialMaturityElapsed) reasons.push("INITIAL_MATURITY_WINDOW_NOT_ELAPSED");
  if (input.qualifiedApplications < 20) warnings.push("LOW_APPLICATION_SAMPLE");
  if (input.maturedApplications < 5) warnings.push("LOW_OUTCOME_SAMPLE");
  if (Number.isNaN(input.evaluatedAt.getTime())) throw new Error("Eligibility evaluation requires a valid time");

  if (input.adminOverride && input.adminOverride.expiresAt >= input.evaluatedAt) {
    if (!input.adminOverride.reason.trim() || Number.isNaN(input.adminOverride.expiresAt.getTime())) {
      throw new Error("Admin overrides require a reason and expiry date");
    }
    reasons.push("ADMIN_OVERRIDE_PROVISIONAL");
    warnings.push("ADMIN_OVERRIDE_PROVISIONAL");
  }

  const eligible = reasons.length === 0;
  return {
    eligible,
    rankable: eligible,
    section: eligible ? "OFFICIAL" : "BUILDING_BASELINE",
    reasons,
    warnings,
  };
}
