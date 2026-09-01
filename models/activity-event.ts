import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES } from "@/constants/activity";
import { ROLES } from "@/constants/roles";

const ActivityEventSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    actorRoleSnapshot: {
      type: String,
      enum: ROLES,
      required: true,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "JobLead",
      index: true,
    },
    entityType: {
      type: String,
      enum: ACTIVITY_ENTITY_TYPES,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ACTIVITY_ACTIONS,
      required: true,
      index: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

ActivityEventSchema.index({ leadId: 1, createdAt: -1 });
ActivityEventSchema.index({ profileId: 1, createdAt: -1 });
ActivityEventSchema.index({ actorId: 1, createdAt: -1 });
ActivityEventSchema.index({ action: 1, createdAt: -1 });
ActivityEventSchema.index({ createdAt: -1 });

export type ActivityEvent = InferSchemaType<typeof ActivityEventSchema>;

export const ActivityEventModel =
  (models.ActivityEvent as Model<ActivityEvent> | undefined) ??
  model<ActivityEvent>("ActivityEvent", ActivityEventSchema);
