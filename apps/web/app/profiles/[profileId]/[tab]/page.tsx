import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "../../../../components/layout/app-shell";
import { ProfileWorkspace, type ProfileWorkspaceTab } from "../../../../components/profiles/profile-workspace";
import { getCurrentActor, getProfileGoogleCalendarStatus } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile workspace" };

const tabs: ProfileWorkspaceTab[] = ["leads", "interviews", "tasks", "documents", "team", "activity", "analytics"];

export default async function ProfileTabRoute({ params }: { params: Promise<{ profileId: string; tab: string }> }) {
  const { profileId, tab } = await params;
  if (!tabs.includes(tab as ProfileWorkspaceTab)) notFound();

  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (tab === "team" && actor.role !== "ADMIN") notFound();

  const calendar = await getProfileGoogleCalendarStatus(profileId, cookie);

  return (
    <AppShell actor={actor}>
      <ProfileWorkspace actor={actor} profileId={profileId} calendar={calendar} activeTab={tab} />
    </AppShell>
  );
}
