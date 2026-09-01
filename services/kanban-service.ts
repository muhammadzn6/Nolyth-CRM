import mongoose from "mongoose";

import { LEAD_STATUSES, type LeadStatus } from "@/constants/leads";
import { requireProfileAccess } from "@/lib/auth/authorization";
import { toLeadTableRow } from "@/lib/leads/to-table-row";
import { connectToDatabase } from "@/lib/db/mongoose";
import { NotFoundError } from "@/lib/errors/app-error";
import { buildCaseInsensitiveRegex } from "@/lib/utils/search";
import { kanbanQuerySchema } from "@/lib/validation/kanban";
import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import { ProfileModel } from "@/models/profile";
import type { AppActor } from "@/types/auth";
import type { KanbanBoardResult, KanbanCard } from "@/types/kanban";

const DEFAULT_COLUMN_LIMIT = 20;

async function getAccessibleProfile(profileId: string, actor: AppActor) {
  const profile = await ProfileModel.findById(profileId);
  if (!profile) {
    throw new NotFoundError();
  }
  requireProfileAccess(profile, actor);
  return profile;
}

function mergeFilterCondition(filter: Record<string, unknown>, condition: Record<string, unknown>) {
  const existing = { ...filter };
  Object.keys(filter).forEach((key) => {
    delete filter[key];
  });
  filter.$and = [existing, condition];
}

function buildKanbanFilter(
  profileId: string,
  query: ReturnType<typeof kanbanQuerySchema.parse>,
  status?: LeadStatus,
) {
  const filter: Record<string, unknown> = {
    profileId: new mongoose.Types.ObjectId(profileId),
  };

  if (status) {
    filter.status = status;
  }

  if (query.important !== undefined) {
    filter.isImportant = query.important;
  }

  if (query.contractType) {
    filter.contractType = query.contractType;
  }

  if (query.jobType) {
    filter.jobType = query.jobType;
  }

  if (query.rateUnit) {
    filter.rateUnit = query.rateUnit;
  }

  if (query.dateFrom || query.dateTo) {
    const appliedDate: Record<string, Date> = {};
    if (query.dateFrom) {
      appliedDate.$gte = query.dateFrom;
    }
    if (query.dateTo) {
      appliedDate.$lte = query.dateTo;
    }
    filter.appliedDate = appliedDate;
  }

  if (query.q) {
    const pattern = buildCaseInsensitiveRegex(query.q);
    filter.$or = [
      { companyName: pattern },
      { jobTitle: pattern },
      { jobUrl: pattern },
      { recruiterName: pattern },
    ];
  }

  return filter;
}

function encodeKanbanCursor(updatedAt: Date, id: mongoose.Types.ObjectId) {
  return Buffer.from(`kanban|${updatedAt.toISOString()}|${id.toString()}`).toString("base64url");
}

function decodeKanbanCursor(cursor: string) {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [kind, updatedAt, id] = decoded.split("|");

  if (kind !== "kanban" || !updatedAt || !id || !mongoose.isValidObjectId(id)) {
    return null;
  }

  return {
    updatedAt: new Date(updatedAt),
    id: new mongoose.Types.ObjectId(id),
  };
}

async function fetchKanbanColumn(
  profileId: string,
  status: LeadStatus,
  query: ReturnType<typeof kanbanQuerySchema.parse>,
): Promise<KanbanBoardResult["columns"][LeadStatus]> {
  const limit = query.limit ?? DEFAULT_COLUMN_LIMIT;
  const filter = buildKanbanFilter(profileId, query, status);

  if (query.column === status && query.cursor) {
    const decoded = decodeKanbanCursor(query.cursor);
    if (decoded) {
      mergeFilterCondition(filter, {
        $or: [
          { updatedAt: { $lt: decoded.updatedAt } },
          { updatedAt: decoded.updatedAt, _id: { $lt: decoded.id } },
        ],
      });
    }
  }

  const leads = await JobLeadModel.find(filter)
    .select(
      "companyName jobTitle jobUrl rateAmount rateUnit contractType jobType status isImportant updatedAt appliedDate",
    )
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = leads.length > limit;
  const pageLeads = hasMore ? leads.slice(0, limit) : leads;
  const leadIds = pageLeads.map((lead) => lead._id);

  const roundCounts = leadIds.length
    ? await InterviewRoundModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { leadId: { $in: leadIds } } },
        { $group: { _id: "$leadId", count: { $sum: 1 } } },
      ])
    : [];

  const countMap = new Map(roundCounts.map((entry) => [entry._id.toString(), entry.count]));

  const items: KanbanCard[] = pageLeads.map((lead) => {
    const row = toLeadTableRow({
      ...lead,
      roundCount: countMap.get(lead._id.toString()) ?? 0,
    });

    return {
      id: row.id,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      jobUrl: row.jobUrl,
      rateAmount: row.rateAmount,
      rateUnit: row.rateUnit,
      contractType: row.contractType,
      jobType: row.jobType,
      status: row.status,
      isImportant: row.isImportant,
      updatedAt: row.updatedAt,
      roundCount: row.roundCount,
    };
  });

  const lastLead = pageLeads[pageLeads.length - 1];

  return {
    items,
    hasMore,
    nextCursor:
      hasMore && lastLead ? encodeKanbanCursor(lastLead.updatedAt, lastLead._id) : null,
  };
}

export async function queryKanbanBoard(
  profileId: string,
  input: unknown,
  actor: AppActor,
): Promise<KanbanBoardResult> {
  await connectToDatabase();
  await getAccessibleProfile(profileId, actor);

  const query = kanbanQuerySchema.parse(input ?? {});
  const baseFilter = buildKanbanFilter(profileId, query);

  const countResults = await JobLeadModel.aggregate<{ _id: LeadStatus; count: number }>([
    { $match: baseFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = LEAD_STATUSES.reduce(
    (accumulator, status) => {
      accumulator[status] = countResults.find((entry) => entry._id === status)?.count ?? 0;
      return accumulator;
    },
    {} as Record<LeadStatus, number>,
  );

  const targetStatuses =
    query.column && LEAD_STATUSES.includes(query.column) ? [query.column] : LEAD_STATUSES;

  const columnEntries = await Promise.all(
    targetStatuses.map(
      async (status) => [status, await fetchKanbanColumn(profileId, status, query)] as const,
    ),
  );

  const columns = LEAD_STATUSES.reduce(
    (accumulator, status) => {
      const found = columnEntries.find(([key]) => key === status);
      accumulator[status] = found?.[1] ?? { items: [], nextCursor: null, hasMore: false };
      return accumulator;
    },
    {} as KanbanBoardResult["columns"],
  );

  return { counts, columns };
}
