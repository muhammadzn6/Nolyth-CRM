import { notFound } from "next/navigation";

import { ProfileLeadWorkspace } from "@/components/leads/profile-lead-workspace";
import { canCreateLead } from "@/lib/auth/authorization";
import { AppError } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/lib/auth/session";
import { UserModel } from "@/models/user";
import { getProfileById } from "@/services/profile-service";
import type { AppActor } from "@/types/auth";

export const dynamic = "force-dynamic";

async function loadProfileWorkspace(profileId: string, actor: AppActor) {
  try {
    const profile = await getProfileById(profileId, actor);
    const [assignedBd, assignedCloser] = await Promise.all([
      UserModel.findById(profile.assignedBD).select("name"),
      UserModel.findById(profile.assignedCloser).select("name"),
    ]);

    return {
      profile,
      assignedBdName: assignedBd?.name,
      assignedCloserName: assignedCloser?.name,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }
}

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const actor = await requireActiveUser();
  const { profileId } = await params;
  const { profile, assignedBdName, assignedCloserName } = await loadProfileWorkspace(
    profileId,
    actor,
  );

  return (
    <ProfileLeadWorkspace
      profileId={profileId}
      profileName={profile.name}
      assignedBd={assignedBdName}
      assignedCloser={assignedCloserName}
      canCreateLeads={canCreateLead(actor)}
      canEdit={actor.role === "ADMIN" || actor.role === "BD" || actor.role === "CLOSER"}
    />
  );
}
