import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProfileWorkspace } from "../../../components/profiles/profile-workspace";
import { AppShell } from "../../../components/layout/app-shell";
import { getCurrentActor, getProfileGoogleCalendarStatus } from "../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile workspace" };

export default async function ProfileRoute({ params }: { params: Promise<{ profileId: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const { profileId } = await params;
  const calendar = await getProfileGoogleCalendarStatus(profileId, cookie);
  return <AppShell actor={actor}><ProfileWorkspace actor={actor} profileId={profileId} calendar={calendar} /></AppShell>;
}
