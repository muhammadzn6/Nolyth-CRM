import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, getDashboard } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsRoute({ searchParams }: { searchParams?: Promise<{ companyId?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const companyId = (await searchParams)?.companyId;
  let dashboard;
  try { dashboard = await getDashboard(cookie, { companyId }); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load analytics."} title="Analytics unavailable" /></AppShell>; }
  const kpis = [["Applications", dashboard.kpis.applications], ["Responses", dashboard.kpis.responses], ["Interviews", dashboard.kpis.interviews], ["Offers", dashboard.kpis.offers], ["Placements", dashboard.kpis.placements], ["Starts", dashboard.kpis.starts], ["Active pipeline", dashboard.kpis.activePipeline], ["Overdue tasks", dashboard.kpis.overdueTasks]] as const;
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Performance</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Analytics</h1><p className="mt-1.5 text-sm text-muted-foreground">Live metrics calculated from the workspace records visible to you.</p></div><section aria-label="Key performance indicators" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(([label, value]) => <Card className="p-5" key={label}><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground">{value.toLocaleString()}</p></Card>)}</section><div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><h2 className="text-base font-bold text-foreground">Pipeline by status</h2><div className="mt-4 space-y-3">{dashboard.breakdowns.statuses.length ? dashboard.breakdowns.statuses.map((item) => <div className="flex items-center justify-between text-sm" key={item.key}><span className="text-muted-foreground">{item.key.replaceAll("_", " ")}</span><span className="font-bold text-foreground">{item.count}</span></div>) : <EmptyState description="Status data will appear as leads are added." title="No pipeline data" />}</div></Card><Card className="p-5"><h2 className="text-base font-bold text-foreground">Applications by source</h2><div className="mt-4 space-y-3">{dashboard.breakdowns.sources.length ? dashboard.breakdowns.sources.map((item) => <div className="flex items-center justify-between text-sm" key={item.key}><span className="text-muted-foreground">{item.key}</span><span className="font-bold text-foreground">{item.count}</span></div>) : <EmptyState description="Source data will appear as leads are added." title="No source data" />}</div></Card></div></div></AppShell>;
}
