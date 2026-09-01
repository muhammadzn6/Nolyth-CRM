import type { ActivityAction } from "@/constants/activity";
import {
  DEAD_REASON_LABELS,
  INTERVIEW_ROUND_TYPE_LABELS,
  STATUS_LABELS,
} from "@/components/leads/types";

type ActivityEventLike = {
  action: ActivityAction | string;
  actorNameSnapshot: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date | string;
};

function labelStatus(value: unknown) {
  return typeof value === "string" ? (STATUS_LABELS[value] ?? value) : String(value);
}

function labelRoundType(value: unknown) {
  return typeof value === "string"
    ? (INTERVIEW_ROUND_TYPE_LABELS[value] ?? value)
    : String(value);
}

export function formatActivityDescription(event: ActivityEventLike) {
  const roundNumber = event.metadata?.roundNumber ?? event.newValue?.roundNumber;

  switch (event.action) {
    case "LEAD_CREATED":
      return "created this lead";
    case "LEAD_UPDATED":
      return "updated lead details";
    case "LEAD_STATUS_CHANGED":
      return `moved the lead from ${labelStatus(event.oldValue?.status)} to ${labelStatus(event.newValue?.status)}`;
    case "LEAD_MARKED_DEAD":
      return `marked the lead dead (${DEAD_REASON_LABELS[String(event.newValue?.deadReason ?? "")] ?? "reason not set"})`;
    case "LEAD_CLOSED":
      return "closed the lead";
    case "LEAD_MARKED_IMPORTANT":
      return "marked this lead important";
    case "LEAD_UNMARKED_IMPORTANT":
      return "removed important from this lead";
    case "LEAD_RATE_CHANGED":
      return "changed the rate";
    case "INTERVIEW_ROUND_CREATED":
      return `added Round ${roundNumber} · ${labelRoundType(event.newValue?.roundType ?? event.metadata?.roundType)}`;
    case "INTERVIEW_ROUND_UPDATED":
      return `updated Round ${roundNumber}`;
    case "INTERVIEW_ROUND_RESULT_CHANGED":
      return `Round ${roundNumber} result: ${event.oldValue?.result} → ${event.newValue?.result}`;
    default:
      return event.action.replaceAll("_", " ").toLowerCase();
  }
}
