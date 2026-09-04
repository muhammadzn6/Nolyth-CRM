import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { CalendarWorkspace } from "../../components/calendar/calendar-workspace";
import { ApiClientError, getCalendar, getCurrentActor } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarRoute({ searchParams }: { searchParams?: Promise<{ companyId?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let interviews;
  try { const params = searchParams ? await searchParams : {}; interviews = await getCalendar(params.companyId ? { companyId: params.companyId } : {}, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load the calendar."} title="Calendar unavailable" /></AppShell>; }
  return <AppShell actor={actor}><CalendarWorkspace actor={actor} interviews={interviews} /></AppShell>;
}
