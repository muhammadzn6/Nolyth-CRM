import mongoose from "mongoose";

import type { LeadStatus } from "@/constants/leads";
import {
  requireLeadCreatePermission,
  requireLeadEditPermission,
  requireProfileAccess,
} from "@/lib/auth/authorization";
import { toLeadTableRow } from "@/lib/leads/to-table-row";
import { connectToDatabase } from "@/lib/db/mongoose";
import { runInTransaction } from "@/lib/db/transaction";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { buildCaseInsensitiveRegex } from "@/lib/utils/search";
import { normalizeJobUrl } from "@/lib/utils/url";
import {
  createLeadSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from "@/lib/validation/leads";
import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import { ProfileModel } from "@/models/profile";
import type { AppActor } from "@/types/auth";
import type {
  CreateLeadResult,
  LeadDuplicateWarning,
  LeadListResult,
} from "@/types/lead-table";

import { recordActivityEvent } from "@/services/activity-service";

const DEFAULT_LIST_LIMIT = 50;

type LeadDocument = Awaited<ReturnType<typeof JobLeadModel.findOne>>;

function sanitizeNullableString(value: string | null | undefined) {
  return value ?? undefined;
}

async function getAccessibleProfile(profileId: string, actor: AppActor) {
  const profile = await ProfileModel.findById(profileId);

  if (!profile) {
    throw new NotFoundError();
  }

  requireProfileAccess(profile, actor);
  return profile;
}

function viewToStatus(view?: string): LeadStatus | undefined {
  switch (view) {
    case "applied":
      return "APPLIED";
    case "in_process":
      return "IN_PROCESS";
    case "final_round":
      return "FINAL_ROUND";
    case "closed":
      return "CLOSED";
    case "dead":
      return "DEAD";
    default:
      return undefined;
  }
}

function buildLeadListFilter(
  profileId: string,
  query: ReturnType<typeof leadListQuerySchema.parse>,
) {
  const filter: Record<string, unknown> = {
    profileId: new mongoose.Types.ObjectId(profileId),
  };

  const hasSearch = Boolean(query.q);
  const statusFromView = viewToStatus(query.view);
  const status = hasSearch ? query.status : (query.status ?? statusFromView);

  if (status) {
    filter.status = status;
  }

  if (!hasSearch && query.view === "important") {
    filter.isImportant = true;
  } else if (query.important !== undefined) {
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

function buildLeadListSort(query: ReturnType<typeof leadListQuerySchema.parse>): Record<string, 1 | -1> {
  switch (query.sort) {
    case "oldest":
      return { appliedDate: 1, _id: 1 };
    case "company":
      return { companyName: 1, appliedDate: -1, _id: -1 };
    case "updated":
      return { updatedAt: -1, _id: -1 };
    case "important":
      return { isImportant: -1, appliedDate: -1, _id: -1 };
    case "newest":
    default:
      return { appliedDate: -1, _id: -1 };
  }
}

function encodeAppliedCursor(appliedDate: Date, id: mongoose.Types.ObjectId) {
  return Buffer.from(`applied|${appliedDate.toISOString()}|${id.toString()}`).toString("base64url");
}

function encodeOffsetCursor(offset: number) {
  return Buffer.from(`offset|${offset}`).toString("base64url");
}

function decodeCursor(cursor: string) {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [kind, ...rest] = decoded.split("|");

  if (kind === "offset") {
    const offset = Number(rest[0]);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError("Invalid cursor");
    }
    return { kind: "offset" as const, offset };
  }

  const [appliedDate, id] = rest;
  if (kind !== "applied" || !appliedDate || !id || !mongoose.isValidObjectId(id)) {
    throw new ValidationError("Invalid cursor");
  }

  return {
    kind: "applied" as const,
    appliedDate: new Date(appliedDate),
    id: new mongoose.Types.ObjectId(id),
  };
}

function applyAppliedCursorFilter(
  filter: Record<string, unknown>,
  cursor: ReturnType<typeof decodeCursor>,
  direction: "asc" | "desc",
) {
  if (cursor.kind !== "applied") {
    return;
  }

  const cursorCondition =
    direction === "desc"
      ? {
          $or: [
            { appliedDate: { $lt: cursor.appliedDate } },
            {
              appliedDate: cursor.appliedDate,
              _id: { $lt: cursor.id },
            },
          ],
        }
      : {
          $or: [
            { appliedDate: { $gt: cursor.appliedDate } },
            {
              appliedDate: cursor.appliedDate,
              _id: { $gt: cursor.id },
            },
          ],
        };

  mergeFilterCondition(filter, cursorCondition);
}

function mergeFilterCondition(filter: Record<string, unknown>, condition: Record<string, unknown>) {
  const existing = { ...filter };
  Object.keys(filter).forEach((key) => {
    delete filter[key];
  });
  filter.$and = [existing, condition];
}

async function attachRoundCounts(
  leads: Array<{
    _id: mongoose.Types.ObjectId;
    companyName: string;
    jobTitle?: string | null;
    jobUrl: string;
    rateAmount?: number | null;
    rateUnit?: LeadListResult["items"][number]["rateUnit"] | null;
    contractType?: LeadListResult["items"][number]["contractType"] | null;
    jobType?: LeadListResult["items"][number]["jobType"] | null;
    status: LeadListResult["items"][number]["status"];
    deadReason?: LeadListResult["items"][number]["deadReason"] | null;
    deadNotes?: string | null;
    isImportant: boolean;
    appliedDate: Date;
    updatedAt: Date;
  }>,
) {
  if (leads.length === 0) {
    return [];
  }

  const leadIds = leads.map((lead) => lead._id);
  const roundCounts = await InterviewRoundModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { leadId: { $in: leadIds } } },
    { $group: { _id: "$leadId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(roundCounts.map((entry) => [entry._id.toString(), entry.count]));

  return leads.map((lead) =>
    toLeadTableRow({
      ...lead,
      roundCount: countMap.get(lead._id.toString()) ?? 0,
    }),
  );
}

async function findDuplicateLead(profileId: string, jobUrl: string, currentLeadId?: string) {
  const normalizedJobUrl = normalizeJobUrl(jobUrl);

  return JobLeadModel.findOne({
    profileId,
    normalizedJobUrl,
    ...(currentLeadId ? { _id: { $ne: currentLeadId } } : {}),
  })
    .select("_id companyName appliedDate")
    .sort({ appliedDate: -1 });
}

function toDuplicateWarning(lead: NonNullable<Awaited<ReturnType<typeof findDuplicateLead>>>): LeadDuplicateWarning {
  return {
    code: "DUPLICATE_URL",
    message: `Possible duplicate — this URL was already added on ${lead.appliedDate.toLocaleDateString()}.`,
    existingLeadId: lead._id.toString(),
    existingCompanyName: lead.companyName,
    existingAppliedDate: lead.appliedDate.toISOString(),
  };
}

function determineLeadAction(
  oldLead: { status: string; isImportant: boolean; rateAmount?: number | null },
  newLead: { status: string; isImportant: boolean; rateAmount?: number | null },
) {
  if (oldLead.status !== newLead.status) {
    if (newLead.status === "DEAD") {
      return "LEAD_MARKED_DEAD" as const;
    }

    if (newLead.status === "CLOSED") {
      return "LEAD_CLOSED" as const;
    }

    return "LEAD_STATUS_CHANGED" as const;
  }

  if (!oldLead.isImportant && newLead.isImportant) {
    return "LEAD_MARKED_IMPORTANT" as const;
  }

  if (oldLead.isImportant && !newLead.isImportant) {
    return "LEAD_UNMARKED_IMPORTANT" as const;
  }

  if (oldLead.rateAmount !== newLead.rateAmount) {
    return "LEAD_RATE_CHANGED" as const;
  }

  return "LEAD_UPDATED" as const;
}

export async function listLeadsByProfile(profileId: string, actor: AppActor) {
  const result = await queryLeadsByProfile(profileId, {}, actor);
  return result.items;
}

export async function queryLeadsByProfile(
  profileId: string,
  input: unknown,
  actor: AppActor,
): Promise<LeadListResult> {
  await connectToDatabase();
  await getAccessibleProfile(profileId, actor);

  const query = leadListQuerySchema.parse(input ?? {});
  const limit = query.limit ?? DEFAULT_LIST_LIMIT;
  const sort = buildLeadListSort(query);
  const filter = buildLeadListFilter(profileId, query);
  const usesAppliedCursor = query.sort === "newest" || query.sort === "oldest" || !query.sort;

  let skip = 0;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (decoded.kind === "offset") {
      skip = decoded.offset;
    } else if (usesAppliedCursor) {
      applyAppliedCursorFilter(
        filter,
        decoded,
        query.sort === "oldest" ? "asc" : "desc",
      );
    }
  }

  const leads = await JobLeadModel.find(filter)
    .select(
      "companyName jobTitle jobUrl rateAmount rateUnit contractType jobType status deadReason deadNotes isImportant appliedDate updatedAt",
    )
    .sort(sort)
    .skip(usesAppliedCursor ? 0 : skip)
    .limit(limit + 1)
    .lean();

  const hasMore = leads.length > limit;
  const pageLeads = hasMore ? leads.slice(0, limit) : leads;
  const items = await attachRoundCounts(pageLeads);

  const lastLead = pageLeads[pageLeads.length - 1];
  let nextCursor: string | null = null;

  if (hasMore) {
    if (usesAppliedCursor && lastLead) {
      nextCursor = encodeAppliedCursor(lastLead.appliedDate, lastLead._id);
    } else {
      nextCursor = encodeOffsetCursor(skip + limit);
    }
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function createLead(
  profileId: string,
  input: unknown,
  actor: AppActor,
): Promise<CreateLeadResult> {
  requireLeadCreatePermission(actor);
  await connectToDatabase();

  const parsed = createLeadSchema.parse(input);
  await getAccessibleProfile(profileId, actor);

  const duplicate = await findDuplicateLead(profileId, parsed.jobUrl);
  const normalizedJobUrl = normalizeJobUrl(parsed.jobUrl);

  const lead = await runInTransaction(async (session) => {
    const createdLeads = await JobLeadModel.create(
      [
        {
          profileId: new mongoose.Types.ObjectId(profileId),
          createdBy: new mongoose.Types.ObjectId(actor.id),
          updatedBy: new mongoose.Types.ObjectId(actor.id),
          companyName: parsed.companyName,
          jobTitle: parsed.jobTitle,
          jobUrl: parsed.jobUrl,
          normalizedJobUrl,
          jobDescription: parsed.jobDescription,
          recruiterName: parsed.recruiterName,
          recruiterContact: parsed.recruiterContact,
          rateAmount: parsed.rateAmount,
          rateUnit: parsed.rateUnit,
          contractType: parsed.contractType,
          jobType: parsed.jobType,
        },
      ],
      { session: session ?? undefined },
    );

    const createdLead = createdLeads[0];

    await recordActivityEvent(
      {
        actor,
        profileId,
        leadId: createdLead._id.toString(),
        entityType: "LEAD",
        entityId: createdLead._id.toString(),
        action: "LEAD_CREATED",
        newValue: {
          companyName: createdLead.companyName,
          jobUrl: createdLead.jobUrl,
          status: createdLead.status,
          isImportant: createdLead.isImportant,
        },
      },
      session,
    );

    return createdLead;
  });

  return {
    lead: toLeadTableRow({ ...lead.toObject(), roundCount: 0 }),
    warnings: duplicate ? [toDuplicateWarning(duplicate)] : [],
  };
}

export async function getLeadById(leadId: string, actor: AppActor) {
  await connectToDatabase();

  const lead = await JobLeadModel.findById(leadId);

  if (!lead) {
    throw new NotFoundError();
  }

  await getAccessibleProfile(lead.profileId.toString(), actor);
  return lead;
}

export async function updateLead(leadId: string, input: unknown, actor: AppActor) {
  requireLeadEditPermission(actor);
  await connectToDatabase();

  const parsed = updateLeadSchema.parse(input);
  const lead = await getLeadById(leadId, actor);

  const nextStatus = parsed.status ?? lead.status;
  const nextDeadReason =
    parsed.deadReason === null ? undefined : parsed.deadReason ?? lead.deadReason ?? undefined;

  if (nextStatus === "DEAD" && !nextDeadReason) {
    throw new ValidationError("deadReason is required when status is DEAD");
  }

  const oldValue = {
    companyName: lead.companyName,
    jobUrl: lead.jobUrl,
    status: lead.status,
    deadReason: lead.deadReason,
    isImportant: lead.isImportant,
    rateAmount: lead.rateAmount ?? null,
  };

  if (typeof parsed.companyName === "string") {
    lead.companyName = parsed.companyName;
  }
  if (parsed.jobTitle !== undefined) {
    lead.jobTitle = sanitizeNullableString(parsed.jobTitle);
  }
  if (typeof parsed.jobUrl === "string") {
    lead.jobUrl = parsed.jobUrl;
    lead.normalizedJobUrl = normalizeJobUrl(parsed.jobUrl);
  }
  if (parsed.jobDescription !== undefined) {
    lead.jobDescription = sanitizeNullableString(parsed.jobDescription);
  }
  if (parsed.recruiterName !== undefined) {
    lead.recruiterName = sanitizeNullableString(parsed.recruiterName);
  }
  if (parsed.recruiterContact !== undefined) {
    lead.recruiterContact = sanitizeNullableString(parsed.recruiterContact);
  }
  if (parsed.rateAmount !== undefined) {
    lead.rateAmount = parsed.rateAmount ?? undefined;
  }
  if (parsed.rateUnit !== undefined) {
    lead.rateUnit = parsed.rateUnit ?? undefined;
  }
  if (parsed.contractType !== undefined) {
    lead.contractType = parsed.contractType ?? undefined;
  }
  if (parsed.jobType !== undefined) {
    lead.jobType = parsed.jobType ?? undefined;
  }
  if (typeof parsed.status === "string") {
    lead.status = parsed.status;
  }
  if (parsed.deadReason !== undefined) {
    lead.deadReason = parsed.deadReason ?? undefined;
  }
  if (parsed.deadNotes !== undefined) {
    lead.deadNotes = sanitizeNullableString(parsed.deadNotes);
  }
  if (typeof parsed.isImportant === "boolean") {
    lead.isImportant = parsed.isImportant;
  }
  if (parsed.appliedDate) {
    lead.appliedDate = parsed.appliedDate;
  }

  if (lead.status !== "DEAD") {
    lead.deadReason = undefined;
    lead.deadNotes = undefined;
  }

  lead.updatedBy = new mongoose.Types.ObjectId(actor.id);

  const updatedLead = await runInTransaction(async (session) => {
    await lead.save({ session: session ?? undefined });

    const newValue = {
      companyName: lead.companyName,
      jobUrl: lead.jobUrl,
      status: lead.status,
      deadReason: lead.deadReason,
      isImportant: lead.isImportant,
      rateAmount: lead.rateAmount ?? null,
    };

    await recordActivityEvent(
      {
        actor,
        profileId: lead.profileId.toString(),
        leadId: lead._id.toString(),
        entityType: "LEAD",
        entityId: lead._id.toString(),
        action: determineLeadAction(oldValue, newValue),
        oldValue,
        newValue,
      },
      session,
    );

    return lead;
  });

  const [tableRow] = await attachRoundCounts([
    {
      _id: updatedLead._id,
      companyName: updatedLead.companyName,
      jobTitle: updatedLead.jobTitle,
      jobUrl: updatedLead.jobUrl,
      rateAmount: updatedLead.rateAmount,
      rateUnit: updatedLead.rateUnit,
      contractType: updatedLead.contractType,
      jobType: updatedLead.jobType,
      status: updatedLead.status,
      deadReason: updatedLead.deadReason,
      deadNotes: updatedLead.deadNotes,
      isImportant: updatedLead.isImportant,
      appliedDate: updatedLead.appliedDate,
      updatedAt: updatedLead.updatedAt,
    },
  ]);

  return tableRow;
}

export async function checkDuplicateLeadUrl(
  profileId: string,
  jobUrl: string,
  actor: AppActor,
  currentLeadId?: string,
) {
  await connectToDatabase();
  await getAccessibleProfile(profileId, actor);

  const duplicate = await findDuplicateLead(profileId, jobUrl, currentLeadId);
  return duplicate ? toDuplicateWarning(duplicate) : null;
}

export type { LeadDocument };
