export type OutcomeStage = "NONE" | "POSITIVE_REPLY" | "SCREENING" | "INTERVIEW" | "OFFER";

export type OutcomeStagePoints = Record<Exclude<OutcomeStage, "NONE">, number>;

export const defaultOutcomeStagePoints: OutcomeStagePoints = {
  POSITIVE_REPLY: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 5,
};

export type MaturedApplicationOutcome = {
  highestStage: OutcomeStage;
};

const defaultWeights = {
  applications: 45,
  followUps: 25,
  outcomes: 30,
} as const;

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number`);
}

export function calculateEffectiveAttainment(
  rawPercent: number,
  thresholdPercent = 120,
  aboveThresholdMultiplierPercent = 25,
): number {
  assertNonNegative(rawPercent, "Raw attainment");
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) throw new Error("Attainment threshold must be non-negative");
  if (!Number.isFinite(aboveThresholdMultiplierPercent) || aboveThresholdMultiplierPercent < 0) {
    throw new Error("Attainment multiplier must be non-negative");
  }
  if (rawPercent <= thresholdPercent) return rawPercent;
  return thresholdPercent + (rawPercent - thresholdPercent) * (aboveThresholdMultiplierPercent / 100);
}

export function calculateOutcomeScore(
  maturedApplications: readonly MaturedApplicationOutcome[],
  stagePoints: OutcomeStagePoints = defaultOutcomeStagePoints,
): number {
  if (maturedApplications.length === 0) return 0;
  const maximum = stagePoints.OFFER;
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error("Offer points must be positive");
  const totalPoints = maturedApplications.reduce((total, application) => (
    total + (application.highestStage === "NONE" ? 0 : stagePoints[application.highestStage])
  ), 0);
  return roundToOneDecimal((totalPoints / (maturedApplications.length * maximum)) * 100);
}

export type BalancedScoreInput = {
  effectiveAttainmentPercent: number | null;
  followUpSlaCompliancePercent: number | null;
  outcome: {
    scorePercent: number | null;
    maturityElapsed: boolean;
    auditedException?: boolean;
  };
  weights?: {
    applications: number;
    followUps: number;
    outcomes: number;
  };
};

export type BalancedScoreResult = {
  score: number | null;
  componentWeights: { applications: number; followUps: number; outcomes: number };
  coveragePercent: number;
  status: "COMPLETE" | "PARTIAL_MEASUREMENT" | "PROVISIONAL" | "INSUFFICIENT_DATA";
  components: { applications: number | null; followUps: number | null; outcomes: number | null };
};

function normalizeScoreValue(value: number | null, label: string, maximum?: number): number | null {
  if (value === null) return null;
  assertNonNegative(value, label);
  if (maximum !== undefined && value > maximum) throw new Error(`${label} cannot exceed ${maximum}`);
  return value;
}

export function calculateBalancedScore(input: BalancedScoreInput): BalancedScoreResult {
  const weights = input.weights ?? defaultWeights;
  const applications = normalizeScoreValue(input.effectiveAttainmentPercent, "Effective attainment");
  const followUps = normalizeScoreValue(input.followUpSlaCompliancePercent, "Follow-up SLA compliance", 100);
  const outcomes = input.outcome.scorePercent !== null
    ? normalizeScoreValue(input.outcome.scorePercent, "Outcome score", 100)
    : input.outcome.auditedException || !input.outcome.maturityElapsed
      ? null
      : 0;
  const components = { applications, followUps, outcomes };
  const available = (Object.keys(components) as Array<keyof typeof components>)
    .filter((key) => components[key] !== null);
  const availableWeight = available.reduce((sum, key) => sum + weights[key], 0);

  if (availableWeight === 0) {
    return {
      score: null,
      componentWeights: { applications: 0, followUps: 0, outcomes: 0 },
      coveragePercent: 0,
      status: "INSUFFICIENT_DATA",
      components,
    };
  }

  const componentWeights = {
    applications: applications === null ? 0 : roundToOneDecimal((weights.applications / availableWeight) * 100),
    followUps: followUps === null ? 0 : roundToOneDecimal((weights.followUps / availableWeight) * 100),
    outcomes: outcomes === null ? 0 : roundToOneDecimal((weights.outcomes / availableWeight) * 100),
  };
  const unboundedScore = available.reduce((sum, key) => sum + (components[key] as number) * (weights[key] / availableWeight), 0);
  const status = available.length === 3
    ? "COMPLETE"
    : available.length === 1 && applications !== null
      ? "PROVISIONAL"
      : "PARTIAL_MEASUREMENT";

  return {
    score: Math.min(100, roundToOneDecimal(unboundedScore)),
    componentWeights,
    coveragePercent: roundToOneDecimal(availableWeight),
    status,
    components,
  };
}
