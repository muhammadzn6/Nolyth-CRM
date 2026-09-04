import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ErrorState } from "@orbit/ui";
import { ClientPlacements } from "../../../../../components/clients/client-placements";
import { AppShell } from "../../../../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listCompanies, listLeadOffers, listLeads } from "../../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client placements" };

export default async function ClientPlacementsRoute({ params }: { params: Promise<{ clientId: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/unauthorized");
  const { clientId } = await params;
  const company = (await listCompanies(cookie)).find((item) => item.id === clientId);
  if (!company) notFound();
  try {
    const leads = (await listLeads({ companyId: clientId }, cookie)).items;
    const placements = (await Promise.all(leads.map(async (lead) => (await listLeadOffers(lead.id, cookie)).filter((offer) => offer.status === "ACCEPTED" && (offer.startDate || offer.startedAt)).map((offer) => ({ offer, lead }))))).flat();
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Client workspace</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{company.canonicalName} placements</h1><p className="mt-1.5 text-sm text-muted-foreground">Track accepted offers through start for this client.</p></div><ClientPlacements placements={placements} /></div></AppShell>;
  } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load client placements."} title="Placements unavailable" /></AppShell>; }
}
