import { Types, type HydratedDocument } from "mongoose";

import type { DeadReason, LeadStatus } from "@/constants/leads";
import type { Role } from "@/constants/roles";
import { hashPassword } from "@/lib/auth/password";
import { normalizeJobUrl } from "@/lib/utils/url";
import { ActivityEventModel } from "@/models/activity-event";
import { JobLeadModel } from "@/models/job-lead";
import { ProfileModel } from "@/models/profile";
import { UserModel } from "@/models/user";
import type { AppActor } from "@/types/auth";
import type { JobLead } from "@/models/job-lead";

type UserFixtureInput = {
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
};

export async function createUserFixture(input: UserFixtureInput) {
  const passwordHash = await hashPassword("password123");

  return UserModel.create({
    ...input,
    isActive: input.isActive ?? true,
    passwordHash,
  });
}

export function toActor(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}): AppActor {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function createProfileFixture(input: {
  name: string;
  assignedBD: Types.ObjectId | string;
  assignedCloser: Types.ObjectId | string;
  createdBy: Types.ObjectId | string;
  isActive?: boolean;
}) {
  return ProfileModel.create({
    ...input,
    isActive: input.isActive ?? true,
  });
}

export async function createLeadFixture(input: {
  profileId: Types.ObjectId | string;
  createdBy: Types.ObjectId | string;
  updatedBy?: Types.ObjectId | string;
  companyName: string;
  jobUrl: string;
  jobTitle?: string;
  jobDescription?: string;
  status?: LeadStatus;
  appliedDate?: Date;
  deadReason?: DeadReason;
  isImportant?: boolean;
}): Promise<HydratedDocument<JobLead>> {
  const lead = new JobLeadModel({
    ...input,
    normalizedJobUrl: normalizeJobUrl(input.jobUrl),
    updatedBy: input.updatedBy ?? input.createdBy,
  });

  await lead.save();

  return lead;
}

export async function listActivityActions() {
  const events = await ActivityEventModel.find().sort({ createdAt: 1 }).lean();
  return events.map((event) => event.action);
}
