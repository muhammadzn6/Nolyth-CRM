import type { InterviewRoundRow } from "@/types/interview-round";

type RoundLike = {
  _id: { toString(): string };
  leadId: { toString(): string };
  profileId: { toString(): string };
  roundNumber: number;
  roundType: InterviewRoundRow["roundType"];
  scheduledAt?: Date | null;
  interviewerName?: string | null;
  meetingLink?: string | null;
  result: InterviewRoundRow["result"];
  notes?: string | null;
  createdBy: { toString(): string } | string;
  updatedBy: { toString(): string } | string;
  createdAt: Date;
  updatedAt: Date;
};

export function toInterviewRoundRow(
  round: RoundLike,
  users: Map<string, { name: string }>,
): InterviewRoundRow {
  const createdById =
    typeof round.createdBy === "string" ? round.createdBy : round.createdBy.toString();
  const updatedById =
    typeof round.updatedBy === "string" ? round.updatedBy : round.updatedBy.toString();

  return {
    id: round._id.toString(),
    leadId: round.leadId.toString(),
    profileId: round.profileId.toString(),
    roundNumber: round.roundNumber,
    roundType: round.roundType,
    scheduledAt: round.scheduledAt?.toISOString(),
    interviewerName: round.interviewerName ?? undefined,
    meetingLink: round.meetingLink ?? undefined,
    result: round.result,
    notes: round.notes ?? undefined,
    createdById,
    createdByName: users.get(createdById)?.name ?? "Unknown",
    updatedById,
    updatedByName: users.get(updatedById)?.name ?? "Unknown",
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };
}
