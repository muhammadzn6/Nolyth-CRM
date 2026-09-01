import type { InterviewRoundResult, InterviewRoundType } from "@/constants/leads";

export type InterviewRoundRow = {
  id: string;
  leadId: string;
  profileId: string;
  roundNumber: number;
  roundType: InterviewRoundType;
  scheduledAt?: string;
  interviewerName?: string;
  meetingLink?: string;
  result: InterviewRoundResult;
  notes?: string;
  createdById: string;
  createdByName: string;
  updatedById: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
};
