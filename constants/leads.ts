export const LEAD_STATUSES = [
  "APPLIED",
  "IN_PROCESS",
  "FINAL_ROUND",
  "CLOSED",
  "DEAD",
] as const;

export const DEAD_REASONS = [
  "NO_RESPONSE",
  "REJECTED",
  "POSITION_CLOSED",
  "RATE_ISSUE",
  "CLIENT_HOLD",
  "DUPLICATE",
  "CANDIDATE_WITHDREW",
  "OTHER",
] as const;

export const RATE_UNITS = ["HOURLY", "YEARLY"] as const;

export const CONTRACT_TYPES = ["W2", "C2C", "1099", "OTHER"] as const;

export const JOB_TYPES = [
  "CONTRACT",
  "FULL_TIME",
  "PART_TIME",
  "TEMPORARY",
  "OTHER",
] as const;

export const INTERVIEW_ROUND_TYPES = [
  "SCREENING",
  "TECHNICAL",
  "CODING",
  "SYSTEM_DESIGN",
  "BEHAVIORAL",
  "HIRING_MANAGER",
  "FINAL",
  "OTHER",
] as const;

export const INTERVIEW_ROUND_RESULTS = [
  "SCHEDULED",
  "COMPLETED",
  "PASSED",
  "FAILED",
  "WAITING",
  "CANCELLED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type DeadReason = (typeof DEAD_REASONS)[number];
export type RateUnit = (typeof RATE_UNITS)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type JobType = (typeof JOB_TYPES)[number];
export type InterviewRoundType = (typeof INTERVIEW_ROUND_TYPES)[number];
export type InterviewRoundResult = (typeof INTERVIEW_ROUND_RESULTS)[number];
