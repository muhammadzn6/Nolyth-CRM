import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import {
  INTERVIEW_ROUND_RESULTS,
  INTERVIEW_ROUND_TYPES,
} from "@/constants/leads";

const InterviewRoundSchema = new Schema(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "JobLead",
      required: true,
      index: true,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      index: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    roundType: {
      type: String,
      enum: INTERVIEW_ROUND_TYPES,
      required: true,
    },
    scheduledAt: {
      type: Date,
    },
    interviewerName: {
      type: String,
      trim: true,
    },
    meetingLink: {
      type: String,
      trim: true,
    },
    result: {
      type: String,
      enum: INTERVIEW_ROUND_RESULTS,
      default: "SCHEDULED",
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

InterviewRoundSchema.index({ leadId: 1, roundNumber: 1 }, { unique: true });
InterviewRoundSchema.index({ profileId: 1, result: 1, scheduledAt: 1 });

export type InterviewRound = InferSchemaType<typeof InterviewRoundSchema>;

export const InterviewRoundModel =
  (models.InterviewRound as Model<InterviewRound> | undefined) ??
  model<InterviewRound>("InterviewRound", InterviewRoundSchema);
