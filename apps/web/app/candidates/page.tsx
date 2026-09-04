import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CandidateList } from "../../components/candidates/candidate-list";
import { AppShell } from "../../components/layout/app-shell";
import { getCurrentActor } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesRoute() {
  const actor = await getCurrentActor((await headers()).get("cookie") ?? undefined);
  if (!actor) redirect("/login");
  return <AppShell actor={actor}><CandidateList actor={actor} /></AppShell>;
}
