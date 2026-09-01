import mongoose from "mongoose";

import { requireAdmin, requireProfileAccess } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import { runInTransaction } from "@/lib/db/transaction";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  createProfileSchema,
  updateProfileSchema,
} from "@/lib/validation/profiles";
import { ProfileModel } from "@/models/profile";
import { UserModel } from "@/models/user";
import type { AppActor } from "@/types/auth";

import { recordActivityEvent } from "@/services/activity-service";

async function getAssignableUser(userId: string, expectedRole: "BD" | "CLOSER") {
  const user = await UserModel.findById(userId);

  if (!user || !user.isActive || user.role !== expectedRole) {
    throw new ValidationError(
      `Assigned ${expectedRole === "BD" ? "BD" : "Closer"} must be an active ${expectedRole} user`,
    );
  }

  return user;
}

export async function listAccessibleProfiles(actor: AppActor) {
  await connectToDatabase();

  if (actor.role === "ADMIN") {
    return ProfileModel.find().sort({ updatedAt: -1 });
  }

  if (actor.role === "BD") {
    return ProfileModel.find({ assignedBD: actor.id }).sort({ updatedAt: -1 });
  }

  return ProfileModel.find({ assignedCloser: actor.id }).sort({ updatedAt: -1 });
}

export async function getProfileById(profileId: string, actor: AppActor) {
  await connectToDatabase();

  const profile = await ProfileModel.findById(profileId);

  if (!profile) {
    throw new NotFoundError();
  }

  requireProfileAccess(profile, actor);
  return profile;
}

export async function createProfile(input: unknown, actor: AppActor) {
  requireAdmin(actor);
  await connectToDatabase();

  const parsed = createProfileSchema.parse(input);
  await getAssignableUser(parsed.assignedBD, "BD");
  await getAssignableUser(parsed.assignedCloser, "CLOSER");

  return runInTransaction(async (session) => {
    const createdProfiles = await ProfileModel.create(
      [
        {
          name: parsed.name,
          assignedBD: new mongoose.Types.ObjectId(parsed.assignedBD),
          assignedCloser: new mongoose.Types.ObjectId(parsed.assignedCloser),
          isActive: parsed.isActive ?? true,
          createdBy: new mongoose.Types.ObjectId(actor.id),
        },
      ],
      { session: session ?? undefined },
    );

    const profile = createdProfiles[0];

    await recordActivityEvent(
      {
        actor,
        profileId: profile._id.toString(),
        entityType: "PROFILE",
        entityId: profile._id.toString(),
        action: "PROFILE_CREATED",
        newValue: {
          name: profile.name,
          assignedBD: profile.assignedBD.toString(),
          assignedCloser: profile.assignedCloser.toString(),
          isActive: profile.isActive,
        },
      },
      session,
    );

    return profile;
  });
}

export async function updateProfile(profileId: string, input: unknown, actor: AppActor) {
  requireAdmin(actor);
  await connectToDatabase();

  const parsed = updateProfileSchema.parse(input);
  const profile = await ProfileModel.findById(profileId);

  if (!profile) {
    throw new NotFoundError();
  }

  const oldValue = {
    name: profile.name,
    assignedBD: profile.assignedBD.toString(),
    assignedCloser: profile.assignedCloser.toString(),
    isActive: profile.isActive,
  };

  if (parsed.assignedBD) {
    await getAssignableUser(parsed.assignedBD, "BD");
    profile.assignedBD = new mongoose.Types.ObjectId(parsed.assignedBD);
  }

  if (parsed.assignedCloser) {
    await getAssignableUser(parsed.assignedCloser, "CLOSER");
    profile.assignedCloser = new mongoose.Types.ObjectId(parsed.assignedCloser);
  }

  if (typeof parsed.name === "string") {
    profile.name = parsed.name;
  }

  if (typeof parsed.isActive === "boolean") {
    profile.isActive = parsed.isActive;
  }

  return runInTransaction(async (session) => {
    await profile.save({ session: session ?? undefined });

    const newValue = {
      name: profile.name,
      assignedBD: profile.assignedBD.toString(),
      assignedCloser: profile.assignedCloser.toString(),
      isActive: profile.isActive,
    };

    const action =
      parsed.assignedBD || parsed.assignedCloser
        ? "PROFILE_ASSIGNMENT_CHANGED"
        : "PROFILE_UPDATED";

    await recordActivityEvent(
      {
        actor,
        profileId: profile._id.toString(),
        entityType: "PROFILE",
        entityId: profile._id.toString(),
        action,
        oldValue,
        newValue,
      },
      session,
    );

    return profile;
  });
}
