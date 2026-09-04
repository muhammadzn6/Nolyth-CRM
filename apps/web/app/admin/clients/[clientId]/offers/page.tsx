import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ErrorState } from "@orbit/ui";
import { ClientOffers } from "../../../../../components/clients/client-offers";
import { AppShell } from "../../../../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listCompanies, listLeadOffers, listLeads } from "../../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client offers" };

export default async function ClientOffersRoute({ params }: { params: Promise<{ clientId: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/unauthorized");
  const { clientId } = await params;
  const company = (await listCompanies(cookie)).find((item) => item.id === clientId);
  if (!company) notFound();
  try {
    const leads = (await listLeads({ companyId: clientId }, cookie)).items;
    const offers = (await Promise.all(leads.map(async (lead) => (await listLeadOffers(lead.id, cookie)).map((offer) => ({ offer, lead }))))).flat();
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Client workspace</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{company.canonicalName} offers</h1><p className="mt-1.5 text-sm text-muted-foreground">Review offers and placement progression for this client.</p></div><ClientOffers offers={offers} leads={leads} /></div></AppShell>;
  } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load client offers."} title="Offers unavailable" /></AppShell>; }
}
