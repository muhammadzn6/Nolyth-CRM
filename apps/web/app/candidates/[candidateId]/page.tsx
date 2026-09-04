import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CandidateDetailView } from "../../../components/candidates/candidate-detail";
import { AppShell } from "../../../components/layout/app-shell";
import { getCurrentActor } from "../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidate" };

export default async function CandidateRoute({ params }: { params: Promise<{ candidateId: string }> }) {
  const actor = await getCurrentActor((await headers()).get("cookie") ?? undefined);
  if (!actor) redirect("/login");
  const { candidateId } = await params;
  return <AppShell actor={actor}><CandidateDetailView actor={actor} candidateId={candidateId} /></AppShell>;
}
