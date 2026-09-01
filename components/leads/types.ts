export type LeadWorkspaceView =
  | "all"
  | "applied"
  | "in_process"
  | "final_round"
  | "closed"
  | "dead"
  | "important";

export type LeadWorkspaceMode = "table" | "kanban";

export type LeadWorkspaceSort = "newest" | "oldest" | "company" | "updated" | "important";

export type LeadSaveState = "idle" | "saving" | "saved" | "error";

export type DraftLeadRow = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  rateAmount: string;
  rateUnit: string;
  contractType: string;
  jobType: string;
};

export const LEAD_WORKSPACE_VIEWS: Array<{
  id: LeadWorkspaceView;
  label: string;
}> = [
  { id: "all", label: "All Leads" },
  { id: "applied", label: "Applied" },
  { id: "in_process", label: "In Process" },
  { id: "final_round", label: "Final Round" },
  { id: "closed", label: "Closed" },
  { id: "dead", label: "Dead" },
  { id: "important", label: "Important" },
];

export const STATUS_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  FINAL_ROUND: "Final Round",
  CLOSED: "Closed",
  DEAD: "Dead",
};

export const RATE_UNIT_LABELS: Record<string, string> = {
  HOURLY: "/hr",
  YEARLY: "/year",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  W2: "W2",
  C2C: "C2C",
  "1099": "1099",
  OTHER: "Other",
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  TEMPORARY: "Temporary",
  OTHER: "Other",
};

export const INTERVIEW_ROUND_TYPE_LABELS: Record<string, string> = {
  SCREENING: "Screening",
  TECHNICAL: "Technical",
  CODING: "Coding",
  SYSTEM_DESIGN: "System Design",
  BEHAVIORAL: "Behavioral",
  HIRING_MANAGER: "Hiring Manager",
  FINAL: "Final",
  OTHER: "Other",
};

export const INTERVIEW_ROUND_RESULT_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
  WAITING: "Waiting",
  CANCELLED: "Cancelled",
};

export const DEAD_REASON_LABELS: Record<string, string> = {
  NO_RESPONSE: "No Response",
  REJECTED: "Rejected",
  POSITION_CLOSED: "Position Closed",
  RATE_ISSUE: "Rate Issue",
  CLIENT_HOLD: "Client Hold",
  DUPLICATE: "Duplicate",
  CANDIDATE_WITHDREW: "Candidate Withdrew",
  OTHER: "Other",
};

export function createDraftRow(): DraftLeadRow {
  return {
    id: `draft-${crypto.randomUUID()}`,
    companyName: "",
    jobTitle: "",
    jobUrl: "",
    rateAmount: "",
    rateUnit: "",
    contractType: "",
    jobType: "",
  };
}
