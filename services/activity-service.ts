import mongoose, { type ClientSession } from "mongoose";

import { requireAdmin } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ActivityEventModel, type ActivityEvent } from "@/models/activity-event";
import type { AppActor } from "@/types/auth";

type RecordActivityInput = {
  actor: AppActor;
  profileId?: string;
  leadId?: string;
  entityType: ActivityEvent["entityType"];
  entityId: string;
  action: ActivityEvent["action"];
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type ListActivityOptions = {
  limit?: number;
  cursor?: string;
};

export async function recordActivityEvent(
  input: RecordActivityInput,
  session: ClientSession | null = null,
) {
  await connectToDatabase();

  const event = await ActivityEventModel.create(
    [
      {
        actorId: new mongoose.Types.ObjectId(input.actor.id),
        actorNameSnapshot: input.actor.name,
        actorRoleSnapshot: input.actor.role,
        profileId: input.profileId
          ? new mongoose.Types.ObjectId(input.profileId)
          : undefined,
        leadId: input.leadId ? new mongoose.Types.ObjectId(input.leadId) : undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
      },
    ],
    { session: session ?? undefined },
  );

  return event[0];
}

export async function listProfileActivity(
  profileId: string,
  options: ListActivityOptions = {},
) {
  await connectToDatabase();

  return ActivityEventModel.find({ profileId })
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 50);
}

export async function listLeadActivity(leadId: string, options: ListActivityOptions = {}) {
  await connectToDatabase();

  const limit = options.limit ?? 50;
  const filter: Record<string, unknown> = { leadId: new mongoose.Types.ObjectId(leadId) };

  if (options.cursor) {
    const decoded = Buffer.from(options.cursor, "base64url").toString("utf8");
    const [createdAt, id] = decoded.split("|");
    if (createdAt && id && mongoose.isValidObjectId(id)) {
      filter.$or = [
        { createdAt: { $lt: new Date(createdAt) } },
        {
          createdAt: new Date(createdAt),
          _id: { $lt: new mongoose.Types.ObjectId(id) },
        },
      ];
    }
  }

  const events = await ActivityEventModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = events.length > limit;
  const items = hasMore ? events.slice(0, limit) : events;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? Buffer.from(`${last.createdAt.toISOString()}|${last._id.toString()}`).toString("base64url")
      : null;

  return { items, nextCursor, hasMore };
}

export async function listPlatformActivity(actor: AppActor, options: ListActivityOptions = {}) {
  requireAdmin(actor);
  await connectToDatabase();

  return ActivityEventModel.find()
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 100);
}

export async function listVisibleActivity(actor: AppActor, options: ListActivityOptions = {}) {
  await connectToDatabase();

  if (actor.role === "ADMIN") {
    return ActivityEventModel.find()
      .sort({ createdAt: -1 })
      .limit(options.limit ?? 100);
  }

  const { listAccessibleProfiles } = await import("@/services/profile-service");
  const profiles = await listAccessibleProfiles(actor);
  const profileIds = profiles.map((profile) => profile._id);

  return ActivityEventModel.find({
    profileId: { $in: profileIds },
  })
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 100);
}
