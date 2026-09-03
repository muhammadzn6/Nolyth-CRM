import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ErrorState } from "@orbit/ui";
import { AppShell } from "../../../../components/layout/app-shell";
import { ClientWorkspace } from "../../../../components/clients/client-workspace";
import { ApiClientError, getCurrentActor, listCompanies } from "../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Employer workspace" };

export default async function ClientWorkspaceRoute({ params }: { params: Promise<{ clientId: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined; const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login"); if (actor.role !== "ADMIN") redirect("/unauthorized");
  const { clientId } = await params;
  const company = (await listCompanies(cookie)).find((item) => item.id === clientId); if (!company) notFound();
  try {
    return <AppShell actor={actor}><div className="mx-auto max-w-[1200px]"><ClientWorkspace company={company} /></div></AppShell>;
  } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load this employer workspace."} title="Employer workspace unavailable" /></AppShell>; }
}
