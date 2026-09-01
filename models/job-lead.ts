import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import {
  CONTRACT_TYPES,
  DEAD_REASONS,
  JOB_TYPES,
  LEAD_STATUSES,
  RATE_UNITS,
} from "@/constants/leads";

const JobLeadSchema = new Schema(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      index: true,
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
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    jobUrl: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedJobUrl: {
      type: String,
      trim: true,
      index: true,
    },
    jobDescription: {
      type: String,
      trim: true,
    },
    recruiterName: {
      type: String,
      trim: true,
    },
    recruiterContact: {
      type: String,
      trim: true,
    },
    rateAmount: {
      type: Number,
      min: 0,
    },
    rateUnit: {
      type: String,
      enum: RATE_UNITS,
    },
    contractType: {
      type: String,
      enum: CONTRACT_TYPES,
    },
    jobType: {
      type: String,
      enum: JOB_TYPES,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "APPLIED",
      index: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deadReason: {
      type: String,
      enum: DEAD_REASONS,
    },
    deadNotes: {
      type: String,
      trim: true,
    },
    isImportant: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

JobLeadSchema.index({ profileId: 1, status: 1, appliedDate: -1 });
JobLeadSchema.index({ profileId: 1, isImportant: 1, appliedDate: -1 });
JobLeadSchema.index({ profileId: 1, createdAt: -1 });
JobLeadSchema.index({ profileId: 1, normalizedJobUrl: 1 });
JobLeadSchema.index({ profileId: 1, companyName: 1 });
JobLeadSchema.index({ profileId: 1, jobTitle: 1 });

export type JobLead = InferSchemaType<typeof JobLeadSchema>;
export type JobLeadDocument = JobLead & { _id: Schema.Types.ObjectId };

export const JobLeadModel =
  (models.JobLead as Model<JobLead> | undefined) ??
  model<JobLead>("JobLead", JobLeadSchema);
