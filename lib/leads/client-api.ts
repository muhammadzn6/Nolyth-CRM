import type { LeadWorkspaceView } from "@/components/leads/types";
import type { LeadDetail } from "@/types/lead-detail";
import type { InterviewRoundRow } from "@/types/interview-round";
import type { KanbanBoardResult } from "@/types/kanban";
import type { LeadListResult, LeadTableRow } from "@/types/lead-table";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type LeadListQuery = {
  view?: LeadWorkspaceView;
  q?: string;
  important?: boolean;
  contractType?: string;
  jobType?: string;
  rateUnit?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
};

export type KanbanQuery = Omit<LeadListQuery, "view" | "sort"> & {
  column?: string;
};

export type ActivityListResult = {
  items: Array<{
    _id: string;
    action: string;
    actorNameSnapshot: string;
    actorRoleSnapshot: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiSuccess<T> | ApiError;

  if (!response.ok || !payload.success) {
    const message =
      !payload.success && payload.error?.message
        ? payload.error.message
        : "Request failed";
    throw new Error(message);
  }

  return payload.data;
}

function buildQueryString(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchProfileLeads(profileId: string, query: LeadListQuery = {}) {
  const response = await fetch(`/api/profiles/${profileId}/leads${buildQueryString(query)}`);
  return parseResponse<LeadListResult>(response);
}

export async function fetchProfileKanban(profileId: string, query: KanbanQuery = {}) {
  const response = await fetch(`/api/profiles/${profileId}/kanban${buildQueryString(query)}`);
  return parseResponse<KanbanBoardResult>(response);
}

export async function createProfileLead(
  profileId: string,
  input: {
    companyName: string;
    jobUrl: string;
    jobTitle?: string;
    rateAmount?: number;
    rateUnit?: string;
    contractType?: string;
    jobType?: string;
  },
) {
  const response = await fetch(`/api/profiles/${profileId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<{ lead: LeadTableRow; warnings: Array<{ message: string }> }>(response);
}

export async function fetchLeadDetail(leadId: string) {
  const response = await fetch(`/api/leads/${leadId}`);
  return parseResponse<LeadDetail>(response);
}

export async function patchLead(leadId: string, patch: Record<string, unknown>) {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  return parseResponse<LeadTableRow>(response);
}

export async function fetchLeadRounds(leadId: string) {
  const response = await fetch(`/api/leads/${leadId}/rounds`);
  return parseResponse<InterviewRoundRow[]>(response);
}

export async function createLeadRound(leadId: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/leads/${leadId}/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<InterviewRoundRow>(response);
}

export async function patchLeadRound(
  leadId: string,
  roundId: string,
  patch: Record<string, unknown>,
) {
  const response = await fetch(`/api/leads/${leadId}/rounds/${roundId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  return parseResponse<InterviewRoundRow>(response);
}

export async function fetchLeadActivity(leadId: string, cursor?: string) {
  const response = await fetch(
    `/api/leads/${leadId}/activity${buildQueryString({ cursor, limit: 30 })}`,
  );
  return parseResponse<ActivityListResult>(response);
}
